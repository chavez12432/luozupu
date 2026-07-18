/**
 * 从谱文备注解析配偶信息
 * 支持：配/配妻/娶/继娶/续娶/元配/继配/次配/续配/复配
 */

const COMMON_SURNAMES = [
  '欧阳', '上官', '皇甫', '诸葛', '司马', '司徒', '尉迟', '公孙',
  '王', '李', '张', '刘', '陈', '杨', '黄', '赵', '吴', '徐', '孙', '胡', '朱', '高',
  '林', '何', '郭', '马', '罗', '梁', '宋', '郑', '谢', '韩', '唐', '冯', '于', '董',
  '肖', '萧', '程', '曹', '袁', '邓', '许', '傅', '沈', '曾', '彭', '吕', '苏', '卢',
  '蒋', '蔡', '贾', '丁', '魏', '薛', '叶', '阎', '余', '潘', '杜', '戴', '夏', '钟',
  '汪', '田', '任', '姜', '范', '方', '石', '姚', '谭', '廖', '邹', '熊', '金', '陆',
  '郝', '孔', '白', '崔', '康', '毛', '邱', '秦', '江', '史', '顾', '侯', '邵', '孟',
  '龙', '万', '段', '钱', '汤', '尹', '黎', '易', '常', '武', '乔', '贺', '赖', '龚',
  '文', '邬', '周', '毛', '聂', '蓝', '涂', '温', '章', '颜', '倪'
];

const TYPE_MAP = {
  元配: '元配',
  继配: '继配',
  次配: '继配',
  续配: '续配',
  复配: '复配',
  继娶: '继娶',
  续娶: '续娶',
  配妻: '配',
  娶: '娶',
  配: '配'
};

function normalizeSpouseName(name) {
  if (name == null) return '';
  let text = String(name).trim();
  if (!text || text === 'null' || text === 'undefined') return '';
  // 配妻肖氏 → 妻肖氏 → 肖氏
  text = text.replace(/^妻+/, '');
  text = text.replace(/^(?:的|与|和)/, '');
  if (!text || text === '氏') return '';
  return text;
}

function mapMarriageType(rawType) {
  if (TYPE_MAP[rawType]) return TYPE_MAP[rawType];
  if (/^[一二三四五六七八九十]+配$/.test(rawType)) return rawType;
  return '配';
}

function isChildClause(text) {
  return /子[女]?[一二三四五六七八九十百千万\d]+/.test(text);
}

function cleanRawSpouseText(raw) {
  if (!raw) return '';
  let text = String(raw).trim();
  // 截断子女、出嗣等后续
  text = text.split(/(?:子[女]?[一二三四五六七八九十百千万\d]|出嗣|承继|无出|葬|痙)/)[0] || '';
  text = text.replace(/[（(].*?[）)]/g, '');
  text = text.replace(/[，,。；;\s]+$/g, '');
  text = text.trim();
  // 去掉开头的「生…」残留
  text = text.replace(/^生[^，,]{0,20}[，,]?/, '');
  return text.trim();
}

/**
 * 从“竹江乡清水岸刘岚 / 永新墙边刘氏 / 王氏 / 本村青兰”拆出姓名与籍贯
 * 策略：优先匹配末尾「姓氏」，且复姓优先，避免把地名中的「江」「山」当成姓。
 */
function extractWifeInfo(rawText) {
  let text = normalizeSpouseName(rawText);
  if (!text) return null;

  let isSameVillage = false;
  if (text.startsWith('本村')) {
    isSameVillage = true;
    text = text.slice(2).trim();
  }

  const surnames = COMMON_SURNAMES.slice().sort((a, b) => b.length - a.length);

  const withVillage = (info) => {
    if (!info) return null;
    const hometown = isSameVillage
      ? (info.hometown ? `本村${info.hometown}` : '本村')
      : (info.hometown || '');
    return Object.assign({}, info, {
      hometown,
      isSameVillage,
      // 族内检索名：全名 + 去本姓「罗」后的名
      lookupNames: buildLookupNames(info.name, isSameVillage)
    });
  };

  // 本村短名：青兰、活英（无姓氏标记）
  if (isSameVillage && text && !text.includes('氏') && text.length <= 3) {
    const hasSurnamePrefix = surnames.some(s => text.startsWith(s) && text.length > s.length);
    if (!hasSurnamePrefix) {
      return withVillage({ name: text, maidenName: text, hometown: '' });
    }
  }

  // 纯 X氏 / 欧阳氏
  for (const surname of surnames) {
    if (text === `${surname}氏`) {
      return withVillage({ name: `${surname}氏`, maidenName: surname, hometown: '' });
    }
  }

  // 地名 + X氏：丰塘彭氏、荷山刘氏、彭田李氏
  for (const surname of surnames) {
    const suffix = `${surname}氏`;
    if (text.endsWith(suffix) && text.length > suffix.length) {
      const hometown = text.slice(0, text.length - suffix.length).replace(/[的与和]$/, '').trim();
      return withVillage({
        name: suffix,
        maidenName: surname,
        hometown: hometown.length >= 1 ? hometown : ''
      });
    }
  }

  // 地名 + X氏 + 名：槎江朱氏香英
  for (const surname of surnames) {
    const marker = `${surname}氏`;
    const idx = text.indexOf(marker);
    if (idx >= 0) {
      const after = text.slice(idx + marker.length);
      const before = text.slice(0, idx).replace(/[的与和]$/, '').trim();
      if (after.length >= 1 && after.length <= 3) {
        return withVillage({
          name: `${surname}氏${after}`,
          maidenName: surname + after,
          hometown: before
        });
      }
    }
  }

  // 地名 + 现代姓名：竹江乡清水岸刘岚（姓后留给名 1–3 字）
  let best = null;
  for (const surname of surnames) {
    let from = 0;
    while (from < text.length) {
      const idx = text.indexOf(surname, from);
      if (idx < 0) break;
      const given = text.slice(idx + surname.length);
      const hometown = text.slice(0, idx).replace(/[的与和]$/, '').trim();
      // 现代名：姓后 1–3 字且不再含「氏」
      if (given.length >= 1 && given.length <= 3 && !given.includes('氏')) {
        const score = hometown.length * 10 + surname.length;
        if (idx === 0 || hometown.length >= 2) {
          if (!best || score > best.score) {
            best = {
              score,
              name: surname + given,
              maidenName: surname + given,
              hometown: idx === 0 ? '' : hometown
            };
          }
        }
      }
      from = idx + 1;
    }
  }
  if (best) return withVillage(best);

  // 姓在开头、无地名的现代名：刘岚 / 本村罗友兰
  for (const surname of surnames) {
    if (text.startsWith(surname)) {
      const given = text.slice(surname.length);
      if (given.length >= 1 && given.length <= 3 && !given.includes('氏')) {
        return withVillage({ name: text, maidenName: text, hometown: '' });
      }
    }
  }

  // 兜底：整段作为姓名（保留氏）
  return withVillage({ name: text, maidenName: text.replace(/氏$/, ''), hometown: '' });
}

/** 族内匹配用候选名：青兰；罗友兰→友兰 */
function buildLookupNames(name, isSameVillage) {
  const names = [];
  const n = normalizeSpouseName(name);
  if (!n) return names;
  names.push(n);
  if (isSameVillage && n.startsWith('罗') && n.length > 1) {
    names.push(n.slice(1));
  }
  return [...new Set(names)];
}

/**
 * 解析女方「适本村某某」
 */
function parseHusbandFromRemark(remark) {
  if (!remark) return null;
  const m = remark.match(/适本村([^\s，。,；;（）\n]{1,12})/);
  if (!m) return null;
  const raw = cleanRawSpouseText(m[1]);
  if (!raw) return null;
  return {
    name: raw,
    isSameVillage: true,
    hometown: '本村',
    lookupNames: buildLookupNames(raw, true),
    sourceText: `本村${raw}`
  };
}

/**
 * @returns {Array<{name, maidenName, hometown, marriageType, marriageOrder, sourceText}>}
 */
function parseSpousesFromRemark(remark) {
  if (!remark || typeof remark !== 'string') return [];

  const results = [];
  const seen = new Set();
  const re = /(元配|继配|次配|续配|复配|继娶|续娶|配妻|[一二三四五六七八九十]+配|娶|配)\s*([^，。,；;\n]{1,40})/g;
  let match;

  while ((match = re.exec(remark)) !== null) {
    const rawType = match[1];
    const rawText = cleanRawSpouseText(match[2]);
    if (!rawText || rawText.length < 1) continue;
    if (isChildClause(rawText)) continue;
    // 过滤误匹配：配置、配套等
    if (/^(?:置|合|套|额|发)/.test(rawText)) continue;

    const info = extractWifeInfo(rawText);
    if (!info || !info.name) continue;

    const name = normalizeSpouseName(info.name);
    if (!name) continue;

    const marriageType = mapMarriageType(rawType);
    const key = `${name}|${marriageType}|${info.hometown || ''}|${rawText}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      name,
      maidenName: info.maidenName || name.replace(/氏$/, ''),
      hometown: info.hometown || '',
      isSameVillage: !!info.isSameVillage,
      lookupNames: info.lookupNames || [name],
      marriageType,
      marriageOrder: results.length + 1,
      sourceText: rawText
    });
  }

  return results;
}

function spousesToSpouseInfo(spouses) {
  return (spouses || []).map(s => ({
    name: s.name,
    type: s.marriageType,
    hometown: s.hometown || '',
    isSameVillage: !!s.isSameVillage,
    memberOriginalId: s.memberOriginalId || '',
    memberDocId: s.memberDocId || ''
  }));
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 在族谱成员中匹配「本村」配偶（配本村青兰 ↔ 适本村双平）
 * @returns 命中成员或 null
 */
function findClanSpouseMember(self, spouseMeta, allMembers) {
  if (!self || !spouseMeta || !allMembers || !allMembers.length) return null;

  const selfName = self.name;
  const reverseRe = new RegExp(
    `(?:配|娶|继娶|续娶|适)本村(?:罗)?${escapeRegExp(selfName)}(?:[，。,；;]|$)`
  );

  // 1) 备注反向互指（最可靠）
  const reverseHits = allMembers.filter(m =>
    m &&
    String(m.originalId) !== String(self.originalId) &&
    reverseRe.test(m.remark || '')
  );
  if (reverseHits.length === 1) return reverseHits[0];
  if (reverseHits.length > 1) {
    const lookup = new Set(spouseMeta.lookupNames || [spouseMeta.name]);
    const byName = reverseHits.filter(m => lookup.has(m.name));
    if (byName.length === 1) return byName[0];
    // 同世代优先
    const sameGen = reverseHits.filter(m => m.generation === self.generation);
    if (sameGen.length === 1) return sameGen[0];
    return reverseHits[0];
  }

  // 2) 仅本村配偶才按姓名检索族人
  if (!spouseMeta.isSameVillage) return null;

  const byName = Object.create(null);
  allMembers.forEach(m => {
    if (!m || !m.name) return;
    if (!byName[m.name]) byName[m.name] = [];
    byName[m.name].push(m);
  });

  const lookupNames = spouseMeta.lookupNames || [spouseMeta.name];
  for (const n of lookupNames) {
    const cands = byName[n] || [];
    if (!cands.length) continue;
    const others = cands.filter(c => String(c.originalId) !== String(self.originalId));
    const opposite = others.filter(c => c.gender && self.gender && c.gender !== self.gender);
    const pool = opposite.length ? opposite : others;
    if (pool.length === 1) return pool[0];
    if (pool.length > 1) {
      const genClose = pool.filter(c =>
        Math.abs((c.generation || 0) - (self.generation || 0)) <= 1
      );
      if (genClose.length === 1) return genClose[0];
      // 对方备注提到本村
      const mentioned = pool.filter(c => /本村/.test(c.remark || ''));
      if (mentioned.length === 1) return mentioned[0];
    }
  }

  return null;
}

/**
 * 批量为成员写入本村配偶双向 spouseId / spouseName
 */
function linkSameVillageSpouses(members) {
  const list = members || [];
  const linked = [];

  const applyLink = (a, b, via) => {
    a.spouseId = String(b.originalId);
    a.spouseName = b.name;
    b.spouseId = String(a.originalId);
    b.spouseName = a.name;

    // 刷新 a 的 spouseInfo 本村项
    const parsed = parseSpousesFromRemark(a.remark || '');
    if (parsed.length) {
      a.spouseInfo = spousesToSpouseInfo(parsed.map(s => {
        if (s.isSameVillage) {
          return Object.assign({}, s, {
            name: b.name,
            memberOriginalId: String(b.originalId),
            memberDocId: b._id || ''
          });
        }
        return s;
      }));
    }

    linked.push({ from: a.name, to: b.name, via });
  };

  for (const member of list) {
    const remark = member.remark || '';
    if (!remark.includes('本村')) continue;

    // 配/娶本村…
    const spouses = parseSpousesFromRemark(remark).filter(s => s.isSameVillage);
    for (const sp of spouses) {
      const hit = findClanSpouseMember(member, sp, list);
      if (!hit) continue;
      applyLink(member, hit, '配本村');
    }

    // 适本村…
    const husbandMeta = parseHusbandFromRemark(remark);
    if (husbandMeta) {
      const hit = findClanSpouseMember(member, husbandMeta, list);
      if (hit) applyLink(member, hit, '适本村');
    }
  }

  return linked;
}

module.exports = {
  COMMON_SURNAMES,
  normalizeSpouseName,
  extractWifeInfo,
  parseSpousesFromRemark,
  parseHusbandFromRemark,
  spousesToSpouseInfo,
  cleanRawSpouseText,
  buildLookupNames,
  findClanSpouseMember,
  linkSameVillageSpouses
};
