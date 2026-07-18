/**
 * 纠正：谱传/备注文字被误写入 residence（现居地）
 * - 若 residence 像备注（配/生/殁/子…），迁回 remark（remark 空时写入），并清空 residence
 * - 若 residence 像葬地碎片且 remark 已有内容，仅清空 residence
 * - 保留合法短地名 / 省市现居地
 *
 * 用法：
 *   node scripts/fixResidenceMisplacedRemark.js          # 只修本地 JSON
 *   node scripts/fixResidenceMisplacedRemark.js --cloud  # 本地 + 云库
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { PATHS, parseMembersFile, writeSplitFiles } = require('../utils/memberDbSplit');
const MEMBERS_PATH = PATHS.membersAll;
const DO_CLOUD = process.argv.includes('--cloud');

function looksLikeRemark(r) {
  if (!r || !String(r).trim()) return false;
  const s = String(r).trim();
  if (
    /字|号|配|适|生\s*\d|生民国|生元|生明|生清|生宋|生癸|生丁|殁|子一|子二|子三|子四|子五|女一|女二|女三|出继|抚嗣|同葬|葬对门|葬潭源|葬北乡|乡试|进士|主治医师|职称|被抓|去无音讯/.test(
      s
    )
  ) {
    return true;
  }
  if (s.length >= 25 && /葬/.test(s)) return true;
  if (s.length >= 40) return true;
  return false;
}

function looksLikeBurialFragment(r) {
  const s = String(r || '').trim();
  return /改葬|葬/.test(s) && s.length >= 10 && !looksLikePlaceKeep(s);
}

function looksLikePlaceKeep(r) {
  const s = String(r || '').trim();
  if (!s || looksLikeRemark(s)) return false;
  // 葬地碎片不算现居地
  if (/葬|改葬/.test(s)) return false;
  if (/^(江西省|广东省|北京市|云南省|陕西省|澳大利亚)/.test(s)) return true;
  if (s.length <= 20 && !/配|生|殁|子|女|字/.test(s)) return true;
  // 含括号的短地名
  if (s.length <= 30 && /[县乡村都]|高州|鹧湖|东西塘|安福/.test(s) && !/配|生|殁|子一|女一/.test(s)) {
    return true;
  }
  return false;
}

function shouldFixResidence(residence) {
  const r = String(residence || '').trim();
  if (!r) return false;
  if (looksLikePlaceKeep(r)) return false;
  return looksLikeRemark(r) || looksLikeBurialFragment(r);
}

function applyFix(member) {
  const residence = String(member.residence || '').trim();
  if (!shouldFixResidence(residence)) return null;

  const remark = String(member.remark || '').trim();
  const next = { ...member, residence: '' };

  if (!remark) {
    next.remark = residence;
  }
  // remark 已有内容：只清空错误的 residence，避免重复粘贴

  return next;
}

function fixLocal() {
  const members = parseMembersFile(MEMBERS_PATH);
  let moved = 0;
  let clearedOnly = 0;
  const samples = [];

  const fixed = members.map((m) => {
    const beforeRes = String(m.residence || '').trim();
    const beforeRem = String(m.remark || '').trim();
    const next = applyFix(m);
    if (!next) return m;

    if (!beforeRem) moved++;
    else clearedOnly++;

    if (samples.length < 8) {
      samples.push({
        name: m.name,
        generation: m.generation,
        action: beforeRem ? 'clear_residence' : 'move_to_remark',
        preview: beforeRes.slice(0, 60)
      });
    }
    return next;
  });

  writeSplitFiles(fixed);
  return { total: members.length, moved, clearedOnly, samples };
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
  const _ = db.command;

  // 拉取所有有 residence 的记录（分批）
  const PAGE = 100;
  let skip = 0;
  const toUpdate = [];

  for (;;) {
    const res = await db
      .collection('members')
      .where({ residence: _.neq('') })
      .skip(skip)
      .limit(PAGE)
      .field({ _id: true, name: true, residence: true, remark: true })
      .get();
    const rows = res.data || [];
    if (!rows.length) break;

    for (const row of rows) {
      const patched = applyFix(row);
      if (!patched) continue;
      toUpdate.push({
        _id: row._id,
        name: row.name,
        residence: '',
        remark: patched.remark
      });
    }

    if (rows.length < PAGE) break;
    skip += PAGE;
  }

  let ok = 0;
  for (const item of toUpdate) {
    const data = { residence: '' };
    if (item.remark != null) data.remark = item.remark;
    await db.collection('members').doc(item._id).update(data);
    ok++;
    if (ok % 20 === 0) console.log(`  cloud updated ${ok}/${toUpdate.length}`);
  }

  return { scannedNeedUpdate: toUpdate.length, updated: ok };
}

(async () => {
  console.log('修复本地 members_export.json ...');
  const local = fixLocal();
  console.log(JSON.stringify(local, null, 2));

  if (DO_CLOUD) {
    console.log('\n同步修复云库 members ...');
    const cloud = await fixCloud();
    console.log(JSON.stringify(cloud, null, 2));
  } else {
    console.log('\n(未传 --cloud，跳过云库。需要时再运行: node scripts/fixResidenceMisplacedRemark.js --cloud)');
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
