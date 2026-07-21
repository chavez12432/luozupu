/**
 * 学历榜归类规则：科举功名 / 民国—2000 / 2000年后（含1997年后考大学一代）
 */

const IMPERIAL_DYNASTIES = ['宋', '元', '明', '清'];

const IMPERIAL_DEGREES = [
  '秀才', '举人', '进士', '贡生', '翰林', '博学鸿儒',
  '状元', '榜眼', '探花', '监生', '廩生', '廪生', '增生', '附生',
  '解元', '会元', '武举', '武进士'
];

/** 民国—2000：凡收录学历均展示 */
const SCHOOL_LEVEL_DEGREES = [
  '小学', '初中', '高中', '中专', '中师', '技校', '职高',
  '专科', '大专', '本科', '大学', '学士', '函大', '夜大',
  '硕士', '博士', '博士后'
];

/** 第三类：仅专科及以上 */
const COLLEGE_PLUS = [
  '专科', '大专', '本科', '大学', '学士', '硕士', '博士', '博士后', '函大', '研究生'
];

/** 约 1979 年生 → 1997 年前后考大学，归第三类 */
const MODERN_BIRTH_FROM = 1979;

function matchAny(text, keywords) {
  if (!text) return false;
  const s = String(text);
  return keywords.some(k => s.includes(k));
}

function splitMultiValues(val) {
  if (val == null || val === '') return [];
  if (Array.isArray(val)) {
    return val.map(v => String(v).trim()).filter(Boolean);
  }
  return String(val)
    .split(/[,，;；、|/]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function normalizeEdu(edu) {
  if (typeof edu === 'string') {
    const line = edu.trim();
    return { degree: line, school: '', major: '', year: null, display: line };
  }
  if (!edu || typeof edu !== 'object') {
    return { degree: '', school: '', major: '', year: null, display: '' };
  }
  const degree = edu.degree != null ? String(edu.degree).trim() : '';
  const school = edu.school != null ? String(edu.school).trim() : '';
  const major = edu.major != null ? String(edu.major).trim() : '';
  let year = edu.year;
  if (year != null && year !== '') {
    const n = Number(String(year).replace(/年.*/, ''));
    year = Number.isFinite(n) && n > 0 ? n : year;
  } else {
    year = null;
  }
  const display = [degree, school, year].filter(v => v != null && String(v).trim() !== '').join(' ');
  return { degree, school, major, year, display };
}

/** 与个人详情 educationList 一致：拆分 degree/school/year 三字段 */
function expandStructuredEducation(education) {
  const out = [];
  (education || []).forEach(e => {
    if (!e) return;
    if (typeof e === 'string') {
      const n = normalizeEdu(e);
      if (n.display) out.push(n);
      return;
    }
    const degrees = splitMultiValues(e.degree);
    const schools = splitMultiValues(e.school);
    const yearsRaw = splitMultiValues(e.year);
    const years = yearsRaw.map(y => {
      const n = Number(String(y).replace(/年.*/, ''));
      return Number.isFinite(n) && n > 0 ? n : y;
    });
    const n = Math.max(degrees.length, schools.length, years.length, 1);
    if (!degrees.length && !schools.length && !years.length && !(e.degree || e.school || e.year)) {
      return;
    }
    for (let i = 0; i < n; i++) {
      const degree = degrees[i] || (n === 1 ? (e.degree || '') : '') || '';
      const school = schools[i] || (schools.length === 1 ? schools[0] : '') || (n === 1 ? (e.school || '') : '') || '';
      let year = years[i] != null ? years[i] : (years.length === 1 ? years[0] : null);
      if (year == null && n === 1 && e.year != null && e.year !== '') year = e.year;
      const item = normalizeEdu({ degree, school, year, major: e.major || '' });
      if (!item.display) continue;
      out.push(item);
    }
  });
  return out;
}

/** 归类用：无学位但校名含大学/学院时，按「大学」归入专科及以上 */
function degreeForClassify(edu) {
  const d = (edu && edu.degree) || '';
  if (d) return d;
  const school = (edu && edu.school) || '';
  if (/大学|学院|师大|党校|地质大学/.test(school)) return '大学';
  return '';
}

function getBirthYear(member) {
  const y = member && member.birthDate && member.birthDate.gregorian
    ? member.birthDate.gregorian.year
    : null;
  return y != null && y !== '' ? Number(y) : null;
}

function getDynasty(member) {
  return (member && member.birthDate && member.birthDate.dynasty) || '';
}

function formatBirthText(member) {
  const bd = member && member.birthDate;
  if (!bd) return '—';
  if (bd.gregorian && bd.gregorian.formatted) return bd.gregorian.formatted;
  const g = bd.gregorian || {};
  if (g.year) {
    const m = g.month != null ? `${g.month}月` : '';
    const d = g.day != null ? `${g.day}日` : '';
    return `${g.year}年${m}${d}` || String(g.year);
  }
  if (bd.lunar && bd.lunar.formatted) return bd.lunar.formatted;
  return '—';
}

function formatDynastyEra(member) {
  const bd = member && member.birthDate;
  if (!bd) return '—';
  const dynasty = bd.dynasty || '';
  const eraName = bd.eraName || '';
  const eraYear = bd.eraYear;
  const ganzhi = bd.ganzhi || '';
  const gy = bd.gregorian && bd.gregorian.year;

  if (dynasty && eraName) {
    const ey = eraYear != null ? `${eraYear}年` : '';
    return `${dynasty}·${eraName}${ey}`;
  }
  if (dynasty) {
    if (ganzhi) return `${dynasty}·${ganzhi}`;
    if (gy) return `${dynasty}·${gy}年`;
    return dynasty;
  }
  if (gy) return `${gy}年`;
  return '—';
}

function isImperialEra(member) {
  const dynasty = getDynasty(member);
  if (IMPERIAL_DYNASTIES.some(d => dynasty.includes(d))) return true;
  const birthYear = getBirthYear(member);
  return birthYear != null && birthYear < 1912;
}

/**
 * 从谱文备注中抽取专科及以上学历（education 字段常为空）
 */
function extractEducationFromRemark(remark) {
  if (!remark || typeof remark !== 'string') return [];
  const text = remark.replace(/\s+/g, '');
  const found = [];

  const push = (degree, school, year) => {
    if (!degree) return;
    if (!matchAny(degree, COLLEGE_PLUS) && degree !== '大学') return;
    const item = {
      degree: degree === '研究生' ? '硕士' : degree,
      school: (school || '').replace(/[，,。；;].*$/, '').trim(),
      major: '',
      year: year != null ? Number(year) : null
    };
    if (!item.school) item.school = '';
    const key = `${item.degree}|${item.school}|${item.year || ''}`;
    if (!found.some(x => `${x.degree}|${x.school}|${x.year || ''}` === key)) {
      found.push(item);
    }
  };

  // 明确考入年份：2000年考入… / 2007年…考入…大学
  const enterRe = /(19|20)(\d{2})年[^。]{0,20}考入([^，,。；;]{2,30}?(?:大学|学院|师大|党校))/g;
  let m;
  while ((m = enterRe.exec(text)) !== null) {
    const year = Number(m[1] + m[2]);
    const school = m[3];
    let degree = '大学';
    if (text.includes('硕士') || text.includes('研究生')) degree = '硕士';
    else if (text.includes('本科')) degree = '本科';
    else if (text.includes('大专') || text.includes('专科')) degree = '大专';
    push(degree, school, year >= 1997 ? year : null);
  }

  // 留学…大学
  const abroad = text.match(/留学([^，,。；;]{2,40}?大学)/);
  if (abroad) push('大学', abroad[1], null);

  // A大学/学院，硕士|大专|本科
  const schoolDeg = /([\u4e00-\u9fa5A-Za-z0-9]{2,40}?(?:大学|学院|科技大学|理工大学|师范大学|师范学院|师大|党校|航空学院|指挥学院|警校))[，,]?(硕士|博士|博士后|本科|大专|专科|大学|研究生)/g;
  while ((m = schoolDeg.exec(text)) !== null) {
    push(m[2], m[1], null);
  }

  // 硕士|本科|大专，…大学/学院毕业
  const degSchool = /(硕士|博士|博士后|本科|大专|专科|大学)[，,]?([\u4e00-\u9fa5A-Za-z0-9]{2,40}?(?:大学|学院|科技大学|理工大学|师范大学|师范学院|师大|警校))(?:毕业)?/g;
  while ((m = degSchool.exec(text)) !== null) {
    push(m[1], m[2], null);
  }

  // …大学毕业 / …学院毕业（默认大学/大专；排除「2004年大学毕业」这类年份误抓）
  const gradOnly = /([\u4e00-\u9fa5A-Za-z0-9]{2,40}?(?:大学|学院|师大))毕业/g;
  while ((m = gradOnly.exec(text)) !== null) {
    const school = m[1];
    if (/\d/.test(school) || school.includes('年') || school.length < 3) continue;
    let degree = '大学';
    if (text.includes('硕士')) degree = '硕士';
    else if (text.includes('大专') || text.includes('专科')) degree = '大专';
    else if (text.includes('本科')) degree = '本科';
    push(degree, school, null);
  }

  // 获大学毕业证书 / 大学毕业证书
  if (/大学毕业证书|获大学毕业/.test(text) && !found.length) {
    push('大学', '', null);
  }

  // 自学大专 / 仅写大专、本科、硕士（无校名）
  if (!found.length) {
    if (text.includes('博士后')) push('博士后', '', null);
    else if (text.includes('博士')) push('博士', '', null);
    else if (text.includes('硕士') || text.includes('研究生')) push('硕士', '', null);
    else if (text.includes('本科')) push('本科', '', null);
    else if (text.includes('大专') || text.includes('专科') || text.includes('自学大专')) push('大专', '', null);
    else if (text.includes('大学')) push('大学', '', null);
  }

  // 过滤：仅中专/技校且无专科以上关键词
  if (!matchAny(text, COLLEGE_PLUS) && !/大学|学院|师大/.test(text)) {
    return [];
  }

  return found;
}

/** 从备注抽取科举功名（岁贡/廪生/进士等） */
function extractImperialFromRemark(remark) {
  if (!remark || typeof remark !== 'string') return [];
  const text = remark.replace(/\s+/g, '');
  const found = [];
  const push = (degree) => {
    if (degree && !found.includes(degree)) found.push(degree);
  };

  if (/进士/.test(text)) push('进士');
  if (/举人/.test(text)) push('举人');
  if (/状元/.test(text)) push('状元');
  if (/榜眼/.test(text)) push('榜眼');
  if (/探花/.test(text)) push('探花');
  if (/翰林(?!院)/.test(text)) push('翰林');
  if (/岁贡|歲贡|贡生|由贡举|贡举/.test(text)) push('贡生');
  if (/廪生|廩生|郡廪|程廪|增广生|增生/.test(text)) push('廪生');
  if (/监生|国学生/.test(text)) push('监生');
  if (/秀才|生员/.test(text) && !found.includes('廪生') && !found.includes('贡生')) push('秀才');

  return found.map(degree => ({ degree, school: '', major: '', year: null }));
}

/** 合并结构化学历 + 备注解析；有 education 三字段时以个人资料为准，不与备注打架 */
function getEffectiveEducations(member) {
  const structured = expandStructuredEducation(member && member.education);
  if (structured.length) {
    return structured;
  }

  const list = [];
  const seen = new Set();
  const add = (edu) => {
    const n = normalizeEdu(edu);
    if (!n.display) return;
    const key = `${n.degree}|${n.school}|${n.year || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push(n);
  };

  const gm = String((member && member.gongming) || '').trim();
  if (gm) {
    gm.split(/[、,，;；/|]/).map(s => s.trim()).filter(Boolean).forEach(degree => add({ degree }));
  }

  extractEducationFromRemark((member && member.remark) || '').forEach(add);

  if (isImperialEra(member)) {
    extractImperialFromRemark((member && member.remark) || '').forEach(add);
  }

  return list;
}

/**
 * 判定单条学历归属时段：imperial | republican | modern | null
 */
function classifyEduBucket(member, edu) {
  const degree = degreeForClassify(edu);
  const year = edu && edu.year;
  if (!degree && !(edu && edu.school)) return null;

  if (isImperialEra(member) && matchAny(degree, IMPERIAL_DEGREES)) {
    return 'imperial';
  }

  if (isImperialEra(member)) return null;

  const birthYear = getBirthYear(member);

  if (birthYear != null && birthYear >= 1912 && birthYear < MODERN_BIRTH_FROM) {
    return matchAny(degree, SCHOOL_LEVEL_DEGREES) || edu.school
      ? 'republican'
      : null;
  }

  if (birthYear != null && birthYear >= MODERN_BIRTH_FROM) {
    return matchAny(degree, COLLEGE_PLUS) ? 'modern' : null;
  }

  if (year != null && !Number.isNaN(Number(year))) {
    const y = Number(year);
    if (y >= 1997) {
      return matchAny(degree, COLLEGE_PLUS) ? 'modern' : null;
    }
    if (y >= 1912 && y < 1997) {
      return matchAny(degree, SCHOOL_LEVEL_DEGREES) || edu.school ? 'republican' : null;
    }
  }

  const dynasty = getDynasty(member);
  if (dynasty.includes('民国') || dynasty.includes('中华人民共和国') || dynasty.includes('共和国')) {
    if (matchAny(degree, COLLEGE_PLUS) || matchAny(degree, SCHOOL_LEVEL_DEGREES) || edu.school) {
      return 'republican';
    }
  }

  return null;
}

function classifyMemberEducations(member) {
  const result = { imperial: null, republican: null, modern: null };
  const educations = getEffectiveEducations(member || {});
  const birthText = formatBirthText(member);
  const dynastyEra = formatDynastyEra(member);
  const base = {
    _id: member._id != null ? String(member._id) : '',
    originalId: member.originalId || member.memberId || '',
    name: member.name || '',
    birthText,
    dynastyEra,
    gongming: member.gongming || '',
    guanzhi: member.guanzhi || (
      Array.isArray(member.positions) && member.positions.length
        ? member.positions.map(p => (typeof p === 'string' ? p : (p.title || ''))).filter(Boolean).join('；')
        : ''
    ),
    educationRaw: educations
  };

  if (!educations.length) {
    if (isImperialEra(member) && (base.gongming || base.guanzhi)) {
      const t = base.gongming || base.guanzhi;
      result.imperial = { ...base, titles: [t], titleText: t };
    }
    return result;
  }

  const titles = [];
  const republicanEdus = [];
  const modernEdus = [];

  for (const edu of educations) {
    const bucket = classifyEduBucket(member, edu);
    const display = edu.display || [edu.degree, edu.school, edu.year].filter(v => v != null && String(v).trim() !== '').join(' ');
    if (bucket === 'imperial') {
      if (edu.degree && !titles.includes(edu.degree)) titles.push(edu.degree);
      else if (!edu.degree && display && !titles.includes(display)) titles.push(display);
    } else if (bucket === 'republican') {
      republicanEdus.push({
        school: edu.school || '',
        degree: edu.degree || '',
        year: edu.year,
        display
      });
    } else if (bucket === 'modern') {
      modernEdus.push({
        school: edu.school || '',
        degree: edu.degree || '',
        year: edu.year,
        display
      });
    }
  }

  if (titles.length) {
    result.imperial = { ...base, titles, titleText: titles.join('、') };
  } else if (isImperialEra(member) && (member.gongming || member.guanzhi)) {
    // 仅有功名/官职字段、未结构化成 education 时也收录
    const t = member.gongming || member.guanzhi;
    result.imperial = {
      ...base,
      titles: [t],
      titleText: t
    };
  }
  if (republicanEdus.length) {
    result.republican = { ...base, educations: republicanEdus };
  }
  if (modernEdus.length) {
    result.modern = { ...base, educations: modernEdus };
  }

  return result;
}

function buildEducationHonorLists(members) {
  const imperial = [];
  const republican = [];
  const modern = [];

  for (const member of members || []) {
    const classified = classifyMemberEducations(member);
    if (classified.imperial) imperial.push(classified.imperial);
    if (classified.republican) republican.push(classified.republican);
    if (classified.modern) modern.push(classified.modern);
  }

  const { mergeZanyingyinEducation } = require('./zanyingyinHonor');
  const merged = mergeZanyingyinEducation({ imperial, republican, modern });

  const byNameGen = (a, b) => {
    const ga = (a.dynastyEra || '') + (a.name || '');
    const gb = (b.dynastyEra || '') + (b.name || '');
    return ga.localeCompare(gb, 'zh');
  };

  merged.imperial.sort(byNameGen);
  merged.republican.sort((a, b) => (a.birthText || '').localeCompare(b.birthText || '', 'zh') || (a.name || '').localeCompare(b.name || '', 'zh'));
  merged.modern.sort((a, b) => (a.birthText || '').localeCompare(b.birthText || '', 'zh') || (a.name || '').localeCompare(b.name || '', 'zh'));

  return merged;
}

module.exports = {
  IMPERIAL_DEGREES,
  SCHOOL_LEVEL_DEGREES,
  COLLEGE_PLUS,
  normalizeEdu,
  expandStructuredEducation,
  formatBirthText,
  formatDynastyEra,
  extractEducationFromRemark,
  extractImperialFromRemark,
  getEffectiveEducations,
  classifyMemberEducations,
  buildEducationHonorLists
};
