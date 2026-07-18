/**
 * 完善配偶/母亲 ID 关联：
 * - members.wifeIds + spouseInfo[].wifeId ← wives.wifeId（按 husbandId）
 * - members.motherId ← 父亲媳妇中与 motherName 唯一匹配的 wifeId
 * - 不改写本村 spouseId
 *
 * 用法：
 *   node scripts/linkWifeAndMotherIds.js
 *   node scripts/linkWifeAndMotherIds.js --cloud
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { PATHS, parseMembersFile, writeSplitFiles } = require('../utils/memberDbSplit');
const MEMBERS_PATH = PATHS.membersAll;
const WIVES_PATH = path.join(ROOT, 'database', 'wives_export.json');
const DO_CLOUD = process.argv.includes('--cloud');

function normName(s) {
  return String(s || '')
    .replace(/[氏罗\s·・]/g, '')
    .toLowerCase();
}

function namesMatch(a, b) {
  const x = normName(a);
  const y = normName(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

function buildWivesByHusband(wives) {
  const map = Object.create(null);
  for (const w of wives) {
    const key = String(w.husbandId != null ? w.husbandId : '');
    if (!key) continue;
    if (!map[key]) map[key] = [];
    map[key].push(w);
  }
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => (a.marriageOrder || 0) - (b.marriageOrder || 0));
  }
  return map;
}

function attachWifeIds(member, husbandWives) {
  if (!husbandWives || !husbandWives.length) {
    return { changed: false, member };
  }

  const wifeIds = husbandWives.map((w) => w.wifeId || w._id).filter(Boolean);
  let spouseInfo = Array.isArray(member.spouseInfo) ? member.spouseInfo.map((s) => ({ ...s })) : [];

  if (!spouseInfo.length && member.spouseName) {
    spouseInfo = [{ name: member.spouseName, type: '配' }];
  }

  // 按顺序对齐；若姓名能匹配则优先按名挂 wifeId
  const used = new Set();
  spouseInfo = spouseInfo.map((info, idx) => {
    const next = { ...info };
    let hit =
      husbandWives.find((w, i) => !used.has(i) && namesMatch(w.name, info.name)) ||
      husbandWives.find((w, i) => !used.has(i) && namesMatch(w.maidenName, info.name));
    if (!hit && husbandWives[idx] && !used.has(idx)) hit = husbandWives[idx];
    if (hit) {
      const i = husbandWives.indexOf(hit);
      if (i >= 0) used.add(i);
      next.wifeId = hit.wifeId || hit._id;
      if (!next.hometown && hit.hometown) next.hometown = hit.hometown;
      if (!next.type && hit.marriageType) next.type = hit.marriageType;
    }
    return next;
  });

  // 未写入 spouseInfo 的媳妇补上
  husbandWives.forEach((w, i) => {
    if (used.has(i)) return;
    spouseInfo.push({
      name: w.name,
      type: w.marriageType || '配',
      hometown: w.hometown || '',
      wifeId: w.wifeId || w._id
    });
  });

  const before = JSON.stringify({
    wifeIds: member.wifeIds || [],
    spouseInfo: member.spouseInfo || [],
    spouseId: member.spouseId || ''
  });

  const nextMember = {
    ...member,
    wifeIds,
    spouseInfo,
    spouseName: member.spouseName || (spouseInfo[0] && spouseInfo[0].name) || ''
  };
  // 外村媳妇：配偶ID 写入 W…（不覆盖已有本村数字 spouseId）
  const curSid = String(member.spouseId || '').trim();
  if (!curSid && wifeIds[0]) {
    nextMember.spouseId = wifeIds[0];
  } else if (/^W/i.test(curSid)) {
    nextMember.spouseId = curSid;
  }

  const after = JSON.stringify({
    wifeIds: nextMember.wifeIds,
    spouseInfo: nextMember.spouseInfo,
    spouseId: nextMember.spouseId || ''
  });
  if (before === after) return { changed: false, member };

  return {
    changed: true,
    member: nextMember
  };
}

function resolveMotherId(member, membersByOid, wivesByHusband) {
  const motherName = String(member.motherName || '').trim();
  if (!motherName) return { motherId: member.motherId || '', changed: false, status: 'no_name' };

  const fatherOid = member.fatherId != null ? String(member.fatherId) : '';
  if (!fatherOid) return { motherId: member.motherId || '', changed: false, status: 'no_father' };

  const fatherWives = wivesByHusband[fatherOid] || [];
  if (!fatherWives.length) return { motherId: member.motherId || '', changed: false, status: 'no_wives' };

  const hits = fatherWives.filter(
    (w) => namesMatch(w.name, motherName) || namesMatch(w.maidenName, motherName)
  );

  if (hits.length === 1) {
    const id = hits[0].wifeId || hits[0]._id;
    const prev = String(member.motherId || '');
    return {
      motherId: id,
      changed: prev !== String(id),
      status: 'linked'
    };
  }
  if (hits.length === 0 && fatherWives.length === 1) {
    // 仅一位正室且子有母亲名：仍要求姓名可对上，避免误挂
    return { motherId: member.motherId || '', changed: false, status: 'no_match' };
  }
  if (hits.length > 1) {
    return { motherId: member.motherId || '', changed: false, status: 'ambiguous' };
  }
  return { motherId: member.motherId || '', changed: false, status: 'no_match' };
}

function fixLocal() {
  const members = parseMembersFile(MEMBERS_PATH);
  const wives = JSON.parse(fs.readFileSync(WIVES_PATH, 'utf8'));
  const wivesByHusband = buildWivesByHusband(wives);
  const membersByOid = new Map(members.map((m) => [String(m.originalId), m]));

  let wifeLinked = 0;
  let motherLinked = 0;
  const motherStats = { linked: 0, ambiguous: 0, no_match: 0, no_name: 0, no_father: 0, no_wives: 0 };
  const samples = { wife: [], mother: [], ambiguous: [] };

  const fixed = members.map((m) => {
    let next = m;
    const hw = wivesByHusband[String(m.originalId)] || [];
    const wifeRes = attachWifeIds(next, hw);
    if (wifeRes.changed) {
      wifeLinked++;
      next = wifeRes.member;
      if (samples.wife.length < 5) {
        samples.wife.push({
          name: next.name,
          memberId: next.memberId,
          wifeIds: next.wifeIds
        });
      }
    }

    const mom = resolveMotherId(next, membersByOid, wivesByHusband);
    motherStats[mom.status] = (motherStats[mom.status] || 0) + 1;
    if (mom.changed) {
      motherLinked++;
      next = { ...next, motherId: mom.motherId };
      if (samples.mother.length < 5) {
        samples.mother.push({
          name: next.name,
          motherName: next.motherName,
          motherId: next.motherId
        });
      }
    } else if (mom.status === 'ambiguous' && samples.ambiguous.length < 8) {
      samples.ambiguous.push({
        name: next.name,
        motherName: next.motherName,
        fatherId: next.fatherId
      });
    }

    return next;
  });

  writeSplitFiles(fixed);

  // 校验冬香
  const dong = fixed.find((x) => x.memberId === 'M000409' || x.originalId === 409);
  return {
    total: fixed.length,
    wifeLinked,
    motherLinked,
    motherStats,
    samples,
    dongxiang: dong
      ? {
          memberId: dong.memberId,
          spouseName: dong.spouseName,
          wifeIds: dong.wifeIds,
          spouseInfo: dong.spouseInfo
        }
      : null
  };
}

async function fixCloud() {
  const dotenv = require(path.join(ROOT, 'admin-vite', 'proxy-server', 'node_modules', 'dotenv'));
  dotenv.config({ path: path.join(ROOT, 'admin-vite', 'proxy-server', '.env') });
  const tcb = require(path.join(ROOT, 'admin-vite', 'proxy-server', 'node_modules', '@cloudbase/node-sdk'));

  const app = tcb.init({
    env: process.env.CLOUDBASE_ENV_ID,
    secretId: process.env.CLOUDBASE_SECRETID,
    secretKey: process.env.CLOUDBASE_SECRETKEY
  });
  const db = app.database();

  const local = JSON.parse(fs.readFileSync(MEMBERS_PATH, 'utf8'));
  let updated = 0;
  const BATCH_LOG = 50;

  for (const m of local) {
    if (!m._id) continue;
    const hasWife = Array.isArray(m.wifeIds) && m.wifeIds.length;
    const hasMother = !!(m.motherId && String(m.motherId).trim());
    if (!hasWife && !hasMother) continue;

    const data = {};
    if (hasWife) {
      data.wifeIds = m.wifeIds;
      data.spouseInfo = m.spouseInfo || [];
      if (m.spouseName) data.spouseName = m.spouseName;
    }
    if (hasMother) data.motherId = m.motherId;

    await db.collection('members').doc(m._id).update(data);
    updated++;
    if (updated % BATCH_LOG === 0) console.log(`  cloud updated ${updated}`);
  }

  return { updated };
}

(async () => {
  console.log('关联本地 members ...');
  const local = fixLocal();
  console.log(JSON.stringify(local, null, 2));

  if (DO_CLOUD) {
    console.log('\n同步云库 ...');
    const cloud = await fixCloud();
    console.log(JSON.stringify(cloud, null, 2));
  } else {
    console.log('\n(未传 --cloud。需要时: node scripts/linkWifeAndMotherIds.js --cloud)');
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
