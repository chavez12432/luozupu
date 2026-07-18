/**
 * 按出生年 1912 划分古今，补全年号干支、墓葬处、荣誉、现代人扩展字段
 * 用法：node scripts/enrichMembersAncientModern.js
 */
const fs = require('fs');
const path = require('path');

const {
  isModernMember,
  enrichDateEra,
  extractBurialPlace,
  extractHonorsFromRemark,
  extractWorkplacesFromRemark,
  MODERN_FROM_YEAR
} = require('../utils/memberEra');

const { getEffectiveEducations } = require('../utils/educationHonor');

const ROOT = path.join(__dirname, '..');
const MEMBERS_PATH = path.join(ROOT, 'database', 'members_export.json');
const ERAS_PATH = path.join(ROOT, 'database', 'dynasty_eras.json');
const { writeSplitFiles, writeCompactJson } = require('../utils/memberDbSplit');

function loadJsonl(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return [];
  if (raw.startsWith('[')) {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }
  return raw.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}

function writeJsonl(filePath, rows) {
  writeCompactJson(filePath, rows);
}

function normalizeEducation(list) {
  if (!list || !list.length) return [];
  return list.map(e => {
    if (typeof e === 'string') {
      return { degree: e, school: '', major: '', year: null, isDefault: false };
    }
    return {
      degree: e.degree || '',
      school: e.school || '',
      major: e.major || '',
      year: e.year != null && e.year !== '' ? Number(e.year) : null,
      isDefault: !!e.isDefault
    };
  }).filter(e => e.degree || e.school);
}

function main() {
  const eras = JSON.parse(fs.readFileSync(ERAS_PATH, 'utf8'));
  const members = loadJsonl(MEMBERS_PATH);

  let ancientCount = 0;
  let modernCount = 0;
  let burialFilled = 0;
  let honorFilled = 0;
  let eraFilled = 0;

  const enriched = members.map(m => {
    const row = Object.assign({}, m);
    const modern = isModernMember(row);
    row.eraCategory = modern ? 'modern' : 'ancient';

    if (row.birthDate && typeof row.birthDate === 'object') {
      const before = row.birthDate.eraName;
      row.birthDate = enrichDateEra(row.birthDate, eras);
      if (!before && row.birthDate.eraName) eraFilled += 1;
    }
    if (row.deathDate && typeof row.deathDate === 'object') {
      row.deathDate = enrichDateEra(row.deathDate, eras);
    }

    if (!modern) {
      ancientCount += 1;
      const burial = row.burialPlace || extractBurialPlace(row.remark || '');
      if (burial) {
        if (!row.burialPlace) burialFilled += 1;
        row.burialPlace = burial;
      }
      // 每次从备注重抽荣誉（保留非 remark 来源）
      const fromRemark = extractHonorsFromRemark(row.remark || '', { gender: row.gender });
      const kept = (Array.isArray(row.honors) ? row.honors : []).filter(h => h && h.type && h.type !== 'remark');
      row.honors = kept.concat(fromRemark);
      if (fromRemark.length) honorFilled += 1;
      // 古人保留原字段；籍贯展示层隐藏
    } else {
      modernCount += 1;
      // 现代人扩展字段骨架
      if (row.phone == null) row.phone = '';
      if (!row.photo && row.avatar) row.photo = row.avatar;
      if (row.photo == null) row.photo = '';
      if (!Array.isArray(row.photoGallery)) row.photoGallery = [];

      let education = normalizeEducation(row.education);
      if (!education.length) {
        education = normalizeEducation(getEffectiveEducations(row));
      }
      row.education = education;

      let workplaces = Array.isArray(row.workplaces) ? row.workplaces.slice() : [];
      if (!workplaces.length) {
        workplaces = extractWorkplacesFromRemark(row.remark || '');
      }
      if (Array.isArray(row.positions)) {
        row.positions.forEach(p => {
          if (!p || typeof p === 'string') return;
          const org = p.organization || p.unit || '';
          if (!org) return;
          if (!workplaces.some(w => (w.name || w) === org)) {
            workplaces.push({
              name: org,
              title: p.title || '',
              isCurrent: !!p.isCurrent
            });
          }
        });
      }
      row.workplaces = workplaces;

      const fromRemark = extractHonorsFromRemark(row.remark || '', { gender: row.gender });
      const kept = (Array.isArray(row.honors) ? row.honors : []).filter(h => h && h.type && h.type !== 'remark');
      row.honors = kept.concat(fromRemark);
    }

    return row;
  });

  writeJsonl(MEMBERS_PATH, enriched);
  const splitStats = writeSplitFiles(enriched);

  console.log(JSON.stringify({
    total: enriched.length,
    modernFromYear: MODERN_FROM_YEAR,
    ancientCount,
    modernCount,
    eraNameFilled: eraFilled,
    burialFilled,
    honorFilledFromRemark: honorFilled,
    split: splitStats,
    wrote: [MEMBERS_PATH, 'pkg-local/database/members_ancient_export.json', 'pkg-local/database/members_modern_export.json']
  }, null, 2));

  // 抽检：善（明宏治进士）
  const shan = enriched.find(m => m.name === '善' && m.generation === 20);
  if (shan) {
    console.log('sample 善', {
      eraCategory: shan.eraCategory,
      birthEra: shan.birthDate && {
        eraName: shan.birthDate.eraName,
        eraYear: shan.birthDate.eraYear,
        ganzhi: shan.birthDate.ganzhi
      },
      burialPlace: shan.burialPlace,
      honors: shan.honors
    });
  }
}

main();
