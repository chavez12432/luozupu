const {
  normalizeSpouseName,
  parseSpousesFromRemark,
  spousesToSpouseInfo
} = require('./spouseParser');

function dedupeSpouses(spouses) {
  const result = [];
  const seenIds = new Set();
  const seenKeys = new Set();

  (spouses || []).forEach(spouse => {
    const name = normalizeSpouseName(spouse.name);
    if (!name) return;

    if (spouse._id) {
      if (seenIds.has(spouse._id)) return;
      seenIds.add(spouse._id);
    }

    const order = spouse.marriageOrder != null ? spouse.marriageOrder : '';
    const type = spouse.marriageType || spouse.type || '';
    // 同名可并存（三配王氏/四配王氏），按 名+序+类型 去重
    const nameKey = `${name}|${order}|${type}`;
    if (seenKeys.has(nameKey)) return;
    seenKeys.add(nameKey);

    result.push(Object.assign({}, spouse, {
      name,
      marriageType: type || (result.length === 0 ? '配' : '继配'),
      marriageOrder: spouse.marriageOrder != null ? spouse.marriageOrder : (result.length + 1)
    }));
  });

  return result.sort((a, b) => (a.marriageOrder || 0) - (b.marriageOrder || 0));
}

function buildSpousesFromMember(member) {
  // 优先从备注解析（最可信）
  const fromRemark = parseSpousesFromRemark(member.remark || '');
  if (fromRemark.length) {
    return dedupeSpouses(fromRemark.map(s => ({
      name: s.name,
      maidenName: s.maidenName,
      hometown: s.hometown,
      marriageType: s.marriageType,
      marriageOrder: s.marriageOrder
    })));
  }

  const spouses = [];

  if (member.spouseInfo && member.spouseInfo.length) {
    member.spouseInfo.forEach((info, index) => {
      const name = typeof info === 'string'
        ? normalizeSpouseName(info)
        : normalizeSpouseName(info.name);
      if (!name) return;

      spouses.push({
        name,
        marriageType: typeof info === 'object' && (info.type || info.marriageType)
          ? (info.type || info.marriageType)
          : (index === 0 ? '配' : '继配'),
        marriageOrder: index + 1,
        hometown: typeof info === 'object' ? (info.hometown || '') : ''
      });
    });
  } else if (member.spouseName) {
    const name = normalizeSpouseName(member.spouseName);
    if (name) spouses.push({ name, marriageType: '配', marriageOrder: 1 });
  }

  return dedupeSpouses(spouses);
}

/**
 * 合并 wives 表记录与备注解析。
 * 已有妻子表记录时以库为准（保留 _id / 同名多配）；否则再回退备注/成员字段。
 */
function mergeWivesWithRemark(dbWives, member) {
  const fromDb = dedupeSpouses(dbWives || []);
  if (fromDb.length) return fromDb;
  return buildSpousesFromMember(member);
}

module.exports = {
  normalizeSpouseName,
  dedupeSpouses,
  buildSpousesFromMember,
  mergeWivesWithRemark,
  parseSpousesFromRemark,
  spousesToSpouseInfo
};
