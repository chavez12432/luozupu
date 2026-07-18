/**
 * 根据 remark 修正本地 members / wives 导出数据
 * 用法：node scripts/repairSpouseData.js
 */
const fs = require('fs');
const path = require('path');
const {
  parseSpousesFromRemark,
  spousesToSpouseInfo,
  normalizeSpouseName,
  linkSameVillageSpouses
} = require('../utils/spouseParser');

const ROOT = path.join(__dirname, '..');
const MEMBERS_FILE = path.join(ROOT, 'database', 'members_export.json');
const WIVES_FILE = path.join(ROOT, 'database', 'wives_export.json');

function readJsonl(file) {
  const raw = fs.readFileSync(file, 'utf8').trim();
  if (!raw) return [];
  if (raw.startsWith('[')) {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }
  return raw.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}

function writeJsonl(file, rows) {
  const body = '[\n' + rows.map(r => JSON.stringify(r)).join(',\n') + '\n]\n';
  fs.writeFileSync(file, body, 'utf8');
}

function makeWifeId(husbandOriginalId, order) {
  return `W${String(husbandOriginalId).padStart(6, '0')}_${order}`;
}

function main() {
  const members = readJsonl(MEMBERS_FILE);
  const byOriginalId = new Map();
  members.forEach(m => byOriginalId.set(String(m.originalId), m));

  const newWives = [];
  let spouseUpdated = 0;
  let motherFixed = 0;
  const samples = [];

  for (const member of members) {
    const spouses = parseSpousesFromRemark(member.remark || '');

    if (spouses.length) {
      const spouseInfo = spousesToSpouseInfo(spouses);
      const spouseName = spouses[0].name;
      const before = JSON.stringify({
        spouseName: member.spouseName,
        spouseInfo: member.spouseInfo
      });
      member.spouseName = spouseName;
      member.spouseInfo = spouseInfo;
      const after = JSON.stringify({
        spouseName: member.spouseName,
        spouseInfo: member.spouseInfo
      });
      if (before !== after) spouseUpdated++;

      spouses.forEach((s, idx) => {
        const order = idx + 1;
        newWives.push({
          _id: makeWifeId(member.originalId, order),
          wifeId: makeWifeId(member.originalId, order),
          name: s.name,
          maidenName: s.maidenName,
          hometown: s.hometown || '',
          generation: member.generation,
          husbandId: String(member.originalId),
          husbandName: member.name,
          marriageType: s.marriageType,
          marriageOrder: order,
          marriageStatus: 'married',
          burialPlace: '',
          remark: (member.remark || '').slice(0, 200),
          sourceMemberId: member._id,
          sourceText: s.sourceText,
          createdAt: member.updatedAt || member.createdAt || null,
          updatedAt: new Date().toISOString()
        });
      });

      if (samples.length < 8) {
        samples.push({
          name: member.name,
          spouses: spouses.map(s => `${s.marriageType}${s.name}`).join('、'),
          remark: (member.remark || '').slice(0, 60)
        });
      }
    } else {
      // 清理明显错误的「妻X氏」前缀
      if (member.spouseName) {
        const cleaned = normalizeSpouseName(member.spouseName);
        if (cleaned && cleaned !== member.spouseName) {
          member.spouseName = cleaned;
          spouseUpdated++;
        }
      }
      if (Array.isArray(member.spouseInfo)) {
        member.spouseInfo = member.spouseInfo.map(info => {
          if (typeof info === 'string') return normalizeSpouseName(info);
          if (info && info.name) return Object.assign({}, info, { name: normalizeSpouseName(info.name) });
          return info;
        }).filter(info => (typeof info === 'string' ? info : (info && info.name)));
      }
    }
  }

  // 修正母亲：motherId 误等于 fatherId；尽量用父亲首任配偶填 motherName
  for (const member of members) {
    const fatherId = member.fatherId != null ? String(member.fatherId) : '';
    const motherId = member.motherId != null ? String(member.motherId) : '';

    if (fatherId && motherId && fatherId === motherId) {
      member.motherId = '';
      motherFixed++;
    }
    if (member.motherName && fatherId) {
      const father = byOriginalId.get(fatherId);
      if (father && member.motherName === father.name) {
        member.motherName = '';
        motherFixed++;
      }
    }

    if (fatherId) {
      const father = byOriginalId.get(fatherId);
      if (father) {
        const fatherSpouses = parseSpousesFromRemark(father.remark || '');
        const resolved = fatherSpouses.length
          ? fatherSpouses[0].name
          : normalizeSpouseName(father.spouseName || '');
        if (resolved && resolved !== member.motherName) {
          member.motherName = resolved;
          motherFixed++;
        } else if (resolved && !member.motherName) {
          member.motherName = resolved;
          motherFixed++;
        }
      }
    }
  }

  // 本村配偶双向匹配（配本村青兰 ↔ 适本村双平）
  const villageLinks = linkSameVillageSpouses(members);

  // 本村已匹配到族人的，wives 用真名并写入关联；避免留下「本村青兰」
  const wivesFinal = [];
  const wifeKey = new Set();
  for (const member of members) {
    const spouses = parseSpousesFromRemark(member.remark || '');
    if (!spouses.length && member.spouseName) {
      // 已由本村匹配写了 spouseName/spouseId，仍生成一条展示用 wife
      if (member.spouseId) {
        const key = `${member.originalId}|${member.spouseName}`;
        if (!wifeKey.has(key)) {
          wifeKey.add(key);
          wivesFinal.push({
            _id: makeWifeId(member.originalId, 1),
            wifeId: makeWifeId(member.originalId, 1),
            name: member.spouseName,
            maidenName: member.spouseName,
            hometown: '本村',
            generation: member.generation,
            husbandId: String(member.originalId),
            husbandName: member.name,
            marriageType: '配',
            marriageOrder: 1,
            marriageStatus: 'married',
            linkedMemberId: String(member.spouseId),
            burialPlace: '',
            remark: (member.remark || '').slice(0, 200),
            sourceMemberId: member._id,
            sourceText: '本村',
            createdAt: null,
            updatedAt: new Date().toISOString()
          });
        }
      }
      continue;
    }

    spouses.forEach((s, idx) => {
      let name = s.name;
      let linkedMemberId = '';
      if (s.isSameVillage && member.spouseId && (name === member.spouseName || s.lookupNames.includes(member.spouseName))) {
        name = member.spouseName;
        linkedMemberId = String(member.spouseId);
      } else if (s.isSameVillage) {
        // 重新在已链接结果上取
        const hitOid = member.spouseId;
        if (hitOid) {
          name = member.spouseName || name;
          linkedMemberId = String(hitOid);
        }
      }
      const order = idx + 1;
      const key = `${member.originalId}|${name}|${order}`;
      if (wifeKey.has(key)) return;
      wifeKey.add(key);
      wivesFinal.push({
        _id: makeWifeId(member.originalId, order),
        wifeId: makeWifeId(member.originalId, order),
        name,
        maidenName: s.maidenName,
        hometown: s.hometown || '',
        generation: member.generation,
        husbandId: String(member.originalId),
        husbandName: member.name,
        marriageType: s.marriageType,
        marriageOrder: order,
        marriageStatus: 'married',
        linkedMemberId,
        burialPlace: '',
        remark: (member.remark || '').slice(0, 200),
        sourceMemberId: member._id,
        sourceText: s.sourceText,
        createdAt: null,
        updatedAt: new Date().toISOString()
      });
    });
  }

  writeJsonl(MEMBERS_FILE, members);
  writeJsonl(WIVES_FILE, wivesFinal.length ? wivesFinal : newWives);

  console.log('修复完成');
  console.log({
    members: members.length,
    wives: (wivesFinal.length ? wivesFinal : newWives).length,
    spouseUpdated,
    motherFixed,
    villageLinks: villageLinks.length
  });
  console.log('本村匹配:');
  villageLinks.forEach(l => console.log(`- ${l.from} ↔ ${l.to} (${l.via})`));
  console.log('样本:');
  samples.forEach(s => console.log(`- ${s.name}: ${s.spouses}`));

  // 关键校验
  const checks = ['双平', '青兰', '记香', '活英', '洪香', '有兰', '花兰', '铁顺', '宝先', '宝青'];
  for (const name of checks) {
    const m = members.find(x => x.name === name);
    if (!m) continue;
    console.log(`校验 ${name}: spouseName=${m.spouseName} spouseId=${m.spouseId}`);
  }
}

main();
