/**
 * 古今族人分类、年号干支纪年、墓葬/荣誉等详情页展示辅助
 * 现代人：出生年 >= 1912（民国元年起）
 */

const MODERN_FROM_YEAR = 1912;

const LUNAR_MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const LUNAR_DAYS = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
];

const DYNASTY_LABEL = {
  宋: '宋朝',
  元: '元朝',
  明: '明朝',
  清: '清朝',
  民国: '民国',
  中华人民共和国: '中华人民共和国'
};

function toChineseNumeral(n) {
  n = Number(n);
  if (!n || n < 1) return '';
  const d = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  if (n <= 10) return ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][n];
  if (n < 20) return '十' + (n % 10 ? d[n % 10] : '');
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return d[t] + '十' + (o ? d[o] : '');
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    return d[h] + '百' + (rest ? (rest < 10 ? '零' + d[rest] : toChineseNumeral(rest)) : '');
  }
  return String(n);
}

function getLunarParts(dateObj) {
  if (!dateObj) return null;
  if (dateObj.lunar && dateObj.lunar.year) return dateObj.lunar;
  if (dateObj.gregorian && dateObj.gregorian.year) return dateObj.gregorian;
  if (dateObj.year) return dateObj;
  return null;
}

function getBirthYear(member) {
  if (!member || !member.birthDate) return null;
  const lunar = member.birthDate.lunar;
  if (lunar && lunar.year != null && lunar.year !== '') return Number(lunar.year);
  const g = member.birthDate.gregorian;
  if (g && g.year != null && g.year !== '') return Number(g.year);
  return null;
}

function hasValidDeathDate(dateObj) {
  const p = getLunarParts(dateObj);
  return !!(p && p.year != null && p.year !== '' && !Number.isNaN(Number(p.year)));
}

function isAliveMember(member) {
  if (!member) return false;
  // 仅今人可作「在世」内部标记；展示层绝不用「尚在世」文案
  if (!isModernMember(member)) return false;
  if (member.isAlive === true) return true;
  if (member.isAlive === false) return false;
  if (member.lifespan != null && member.lifespan !== '' && !Number.isNaN(Number(member.lifespan))) {
    return false;
  }
  return !hasValidDeathDate(member.deathDate);
}

/**
 * 逝世日期展示：无卒年一律留空。绝对禁止「尚在世」。
 */
function formatDeathDisplay(member, isModern) {
  if (!hasValidDeathDate(member && member.deathDate)) return '';
  if (isModern) {
    // 今人有卒年：农历+公历分行由页面组合；此处返回农历简写，公历用 deathDateGregorian
    return formatModernLunarLine(member.deathDate) || formatModernDate(member.deathDate);
  }
  return formatNumericDate(member.deathDate);
}

/** 数字年 → 中文数字串，如 1986 → 一九八六 */
function yearToChineseDigits(year) {
  const d = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  return String(year).split('').map(c => (/^\d$/.test(c) ? d[Number(c)] : c)).join('');
}

/** 从今人生卒对象取农历 Lunar 实例；失败返回 null */
function getModernLunarInstance(dateObj) {
  if (!dateObj) return null;
  try {
    const dateConvert = require('./dateConvert');
    if (!dateConvert.isLunarReady() || !dateConvert.Lunar) return null;
    const full = dateConvert.enrichBirthDate(dateObj);
    const lunar = full && full.lunar;
    if (!lunar || !lunar.year || !lunar.month || !lunar.day) return null;
    const lm = lunar.isLeap ? -Number(lunar.month) : Number(lunar.month);
    return dateConvert.Lunar.fromYmd(Number(lunar.year), lm, Number(lunar.day));
  } catch (e) {
    return null;
  }
}

/** 今人农历日期（不含干支/生肖）：一九八六年六月初一日 */
function formatModernLunarDateOnly(dateObj) {
  if (!dateObj) return '';
  const L = getModernLunarInstance(dateObj);
  if (L) {
    let base = L.toString();
    if (base && !/日$/.test(base)) base += '日';
    return base;
  }
  const lunar = dateObj.lunar || {};
  if (!lunar.year) return '';
  const y = yearToChineseDigits(lunar.year);
  const mi = Number(lunar.month) - 1;
  const monthStr = (lunar.isLeap ? '闰' : '') + (LUNAR_MONTHS[mi] || String(lunar.month));
  const dayStr = LUNAR_DAYS[Number(lunar.day) - 1] || `${lunar.day}`;
  return `${y}年${monthStr}月${dayStr}日`;
}

/** 今人年干支，如 丙午 */
function formatModernGanzhi(dateObj) {
  if (!dateObj) return '';
  const L = getModernLunarInstance(dateObj);
  if (L && typeof L.getYearInGanZhi === 'function') {
    return L.getYearInGanZhi() || '';
  }
  const raw = String(dateObj.ganzhi || '').trim();
  const m = raw.match(/^([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/);
  return m ? m[1] : '';
}

/** 今人生肖 */
function formatModernZodiac(dateObj) {
  if (!dateObj) return '';
  if (dateObj.zodiac) return String(dateObj.zodiac).trim();
  const L = getModernLunarInstance(dateObj);
  if (L && typeof L.getYearShengXiao === 'function') {
    return L.getYearShengXiao() || '';
  }
  return '';
}

/**
 * 今人农历展示（兼容旧用法）：一九八六年六月初一日 丙午年 马
 */
function formatModernLunarLine(dateObj) {
  if (!dateObj) return '';
  const base = formatModernLunarDateOnly(dateObj);
  if (!base) return '';
  const ganzhi = formatModernGanzhi(dateObj);
  const zodiac = formatModernZodiac(dateObj);
  const parts = [base];
  if (ganzhi) parts.push(`${ganzhi}年`);
  if (zodiac) parts.push(zodiac);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * 今人公历展示：2026 年 7 月 16 日
 */
function formatModernGregorianLine(dateObj) {
  if (!dateObj) return '';
  try {
    const { enrichBirthDate } = require('./dateConvert');
    const full = enrichBirthDate(dateObj);
    const g = full && full.gregorian;
    if (!g || !g.year) return '';
    return `${g.year} 年 ${Number(g.month)} 月 ${Number(g.day)} 日`;
  } catch (e) {
    const g = dateObj.gregorian || {};
    if (!g.year) return '';
    const m = g.month != null ? Number(g.month) : '';
    const d = g.day != null ? Number(g.day) : '';
    if (!m || !d) return `${g.year} 年`;
    return `${g.year} 年 ${m} 月 ${d} 日`;
  }
}

/**
 * 是否现代人：出生 >= 1912；无出生年时看朝代
 */
function isModernMember(member) {
  if (member && (member.eraCategory === 'modern' || member.eraCategory === 'ancient')) {
    return member.eraCategory === 'modern';
  }
  const year = getBirthYear(member);
  if (year != null && !Number.isNaN(year)) {
    return year >= MODERN_FROM_YEAR;
  }
  const dynasty = (member && member.birthDate && member.birthDate.dynasty) || '';
  if (dynasty.includes('民国') || dynasty.includes('中华人民共和国') || dynasty.includes('共和国')) {
    return true;
  }
  if (['宋', '元', '明', '清'].some(d => dynasty === d || dynasty.includes(d))) {
    return false;
  }
  // 无出生年：代数较大者偏现代，否则古代
  const gen = member && member.generation;
  if (gen != null && Number(gen) >= 30) return true;
  return false;
}

function findEraForYear(year, eras) {
  if (year == null || !eras || !eras.length) return null;
  // 同年号跨度内取最长覆盖
  const hits = eras.filter(e => year >= e.startYear && year <= e.endYear);
  if (!hits.length) return null;
  hits.sort((a, b) => (b.endYear - b.startYear) - (a.endYear - a.startYear));
  return hits[0];
}

function enrichDateEra(dateObj, eras) {
  if (!dateObj || typeof dateObj !== 'object') return dateObj;
  const year = (dateObj.lunar && dateObj.lunar.year) || (dateObj.gregorian && dateObj.gregorian.year);
  if (year == null) return dateObj;
  if (year >= MODERN_FROM_YEAR) {
    // 民国/共和国不填古代年号
    return dateObj;
  }
  const era = findEraForYear(year, eras);
  if (!era) return dateObj;
  const eraYear = year - era.startYear + 1;
  return Object.assign({}, dateObj, {
    dynasty: dateObj.dynasty || era.dynasty,
    eraName: era.eraName,
    eraYear
  });
}

function pad2(n) {
  const x = Number(n);
  if (!x || Number.isNaN(x)) return '01';
  return x < 10 ? `0${x}` : String(x);
}

/** 数字纪年：1666-08-07（农历年月日） */
function formatNumericDate(dateObj) {
  const p = getLunarParts(dateObj);
  if (!p || p.year == null || p.year === '') return '';
  const m = p.month != null && p.month !== '' ? pad2(p.month) : '01';
  const d = p.day != null && p.day !== '' ? pad2(p.day) : '01';
  return `${p.year}-${m}-${d}`;
}

/** 年号干支：清朝康熙五年 丙午年 八月 初七 */
function formatEraGanzhiDate(dateObj) {
  const p = getLunarParts(dateObj);
  if (!p || p.year == null || p.year === '') return '';

  const dynastyRaw = (dateObj && dateObj.dynasty) || '';
  const dynasty = DYNASTY_LABEL[dynastyRaw] || (dynastyRaw ? `${dynastyRaw}朝` : '');
  const eraName = dateObj && dateObj.eraName;
  const eraYear = dateObj && dateObj.eraYear;
  const ganzhi = (dateObj && dateObj.ganzhi) || '';

  const parts = [];
  if (dynasty && eraName && eraYear) {
    parts.push(`${dynasty}${eraName}${toChineseNumeral(eraYear)}年`);
  } else if (dynasty && ganzhi) {
    parts.push(dynasty);
  } else if (eraName && eraYear) {
    parts.push(`${eraName}${toChineseNumeral(eraYear)}年`);
  }

  if (ganzhi) {
    parts.push(ganzhi.endsWith('年') ? ganzhi : `${ganzhi}年`);
  }

  if (p.month) {
    const mi = Number(p.month) - 1;
    const monthStr = (p.isLeap ? '闰' : '') + (LUNAR_MONTHS[mi] || String(p.month));
    parts.push(`${monthStr}月`);
  }
  if (p.day) {
    parts.push(LUNAR_DAYS[Number(p.day) - 1] || `${p.day}日`);
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/** 现代人生卒：1932年3月9日 */
function formatModernDate(dateObj) {
  const p = getLunarParts(dateObj);
  if (!p || p.year == null || p.year === '') return '';
  let s = `${p.year}年`;
  if (p.month) s += `${Number(p.month)}月`;
  if (p.day) s += `${Number(p.day)}日`;
  return s;
}

/**
 * 从备注抽取墓葬处
 */
function extractBurialPlace(remark) {
  if (!remark || typeof remark !== 'string') return '';
  const text = remark.replace(/\r\n/g, '\n');
  const patterns = [
    /改葬([^，,。；;\n配娶继续复]{2,48})/,
    /葬于([^，,。；;\n配娶继续复]{2,48})/,
    /合葬(?:于)?([^，,。；;\n配娶继续复]{2,48})/,
    /安葬(?:于)?([^，,。；;\n配娶继续复]{2,48})/,
    /葬(?![于日月年])([^，,。；;\n配娶继续复子]{2,48})/
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      let place = m[1].trim();
      place = place.replace(/^(在|於)/, '');
      place = place.replace(/[，,].*$/, '').trim();
      // 去掉明显不是地点的尾巴
      place = place.replace(/(配|娶|继|子[一二三四五六七八九十]).*$/, '').trim();
      if (place.length >= 2 && place.length <= 40) return place;
    }
  }
  return '';
}

/**
 * 从备注抽取荣誉相关表述
 */
function extractHonorsFromRemark(remark, options = {}) {
  if (!remark || typeof remark !== 'string') return [];
  // 配偶段之后的勅封多属妻室，主人荣誉只取配前正文
  const selfText = remark.split(/配|娶|继娶|续娶|复配/)[0] || remark;
  const text = selfText.replace(/\s+/g, '').replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '');
  const found = [];
  const push = (title) => {
    if (!title) return;
    let t = title.replace(/[，,。；;].*$/, '').trim();
    t = t.replace(/^(字|号)[^，]{1,8}、?/, '');
    if (t.length < 2 || t.length > 36) return;
    if (/孺人|夫人|安人|恭人/.test(t) && options.gender !== '女') return;
    if (found.includes(t)) return;
    found.push(t);
  };

  const patterns = [
    /(?:中|登|钦赐|赐)?[^，。；]{0,14}(?:进士|举人|秀才|贡生|岁贡生|解元|会元|状元|武进士|武举人|武举)/g,
    /崇祀[^，。；]{0,16}乡贤/g,
    /诏进阶[^，。；]{0,8}/g,
    /(?:勅|敕|诰)封[^，。；]{0,12}/g,
    /赠以?[^，。；]{0,16}(?:寿)?扁[^，。；]{0,12}/g,
    /[^，。；]{0,8}寿扁[^，。；]{0,12}/g,
    /(?:全国|省|市|县|区)?[^，。；]{0,6}(?:劳动模范|劳模|三八红旗手|先进工作者|优秀[^，。；]{0,12}|荣誉市民|荣誉称号)/g,
    /荣获[^，。；]{0,24}/g
  ];

  patterns.forEach(re => {
    let m;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(text)) !== null) {
      push(m[0]);
    }
  });

  return found.map(title => ({
    title,
    type: 'remark',
    level: '',
    year: null,
    description: title
  }));
}

/**
 * 工作单位：优先已有 workplaces；否则从备注简单抽取
 */
function extractWorkplacesFromRemark(remark) {
  if (!remark || typeof remark !== 'string') return [];
  const text = remark.replace(/\s+/g, '');
  const found = [];
  const push = (name) => {
    let n = (name || '').replace(/[，,。；;].*$/, '').trim();
    if (n.length < 2 || n.length > 40) return;
    if (found.some(x => x.name === n)) return;
    found.push({ name: n, title: '', isCurrent: false });
  };

  const patterns = [
    /(?:就职于|供职于|工作于|任职于)([^，,。；;]{2,40})/g,
    /在([^，,。；;]{2,30}?(?:公司|集团|学校|医院|政府|局|厅|处|厂|银行|大学|学院))(?:工作|任职|任)/g
  ];
  patterns.forEach(re => {
    let m;
    while ((m = re.exec(text)) !== null) push(m[1]);
  });
  return found;
}

function splitMultiValues(text) {
  if (text == null || text === '') return [];
  return String(text)
    .split(/[,，、;；/|]/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * 将 Excel 里挤在一条里的「本科，硕士 / A大学,B大学 / 2004,2007」拆成多行
 */
function expandEducationEntries(education) {
  const out = [];
  (education || []).forEach(e => {
    if (!e) return;
    if (typeof e === 'string') {
      const line = e.trim();
      if (line) out.push({ degree: line, school: '', year: null, line, display: line });
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
      const line = [degree, school, year].filter(v => v != null && String(v).trim() !== '').join(' ');
      if (!line) continue;
      out.push({
        degree,
        school,
        year: year == null || year === '' ? null : year,
        major: e.major || '',
        display: line,
        line
      });
    }
  });
  return out;
}

function formatEducationList(education) {
  return expandEducationEntries(education);
}

function formatHonorList(honors) {
  if (!honors || !honors.length) return [];
  return honors.map(h => {
    if (typeof h === 'string') return h;
    return h.title || h.name || h.description || '';
  }).filter(Boolean);
}

function formatWorkplaceList(workplaces) {
  if (!workplaces || !workplaces.length) return [];
  return workplaces.map(w => {
    if (typeof w === 'string') return w;
    const parts = [w.name || w.organization, w.title].filter(Boolean);
    return parts.join(' ') || '';
  }).filter(Boolean);
}

/** 工作条目：单位 + 职位（可多条；支持逗号/分号并列拆分） */
function formatJobList(positions, workplaces) {
  const jobs = [];

  function pushJob(organization, title) {
    const org = String(organization || '').trim();
    const tit = String(title || '').trim();
    if (!org && !tit) return;
    const line = [org, tit].filter(Boolean).join(' ');
    if (!line) return;
    jobs.push({ organization: org, title: tit, display: line, line });
  }

  (positions || []).forEach(p => {
    if (!p) return;
    if (typeof p === 'string') {
      splitMultiValues(p).forEach(t => pushJob('', t));
      return;
    }
    const orgs = splitMultiValues(p.organization || p.name);
    const titles = splitMultiValues(p.title);
    const n = Math.max(orgs.length, titles.length, 1);
    if (!orgs.length && !titles.length) return;
    for (let i = 0; i < n; i++) {
      const org = orgs[i] || (orgs.length === 1 ? orgs[0] : '') || '';
      const tit = titles[i] || (titles.length === 1 && orgs.length <= 1 ? titles[0] : '') || '';
      // 仅职位多段、无单位：各成一行
      if (!orgs.length && titles.length) {
        pushJob('', titles[i] || '');
        continue;
      }
      // 仅单位多段、无职位：各成一行
      if (!titles.length && orgs.length) {
        pushJob(orgs[i] || '', '');
        continue;
      }
      pushJob(org, tit);
    }
  });

  if (jobs.length) return jobs;

  (workplaces || []).forEach(w => {
    if (typeof w === 'string') {
      splitMultiValues(w).forEach(org => pushJob(org, ''));
      return;
    }
    pushJob(w.name || w.organization || '', w.title || '');
  });
  return jobs;
}

/** 家族相册 URL 列表，最多 limit 张 */
function formatPhotoGalleryList(gallery, limit = 10) {
  if (!Array.isArray(gallery) || !gallery.length) return [];
  const max = Math.max(0, Number(limit) || 10);
  return gallery
    .map(item => {
      if (!item) return '';
      if (typeof item === 'string') return item.trim();
      return String(item.url || item.fileID || item.src || '').trim();
    })
    .filter(Boolean)
    .slice(0, max);
}

/**
 * 组装详情页展示字段（在原始 member 副本上追加）
 * 空值统一为 ''，字段名由页面始终展示
 */
function applyDetailDisplay(member, options = {}) {
  if (!member) return member;
  const eras = options.eras || [];
  const detail = Object.assign({}, member);

  if (detail.birthDate && typeof detail.birthDate === 'object') {
    detail._birthDateObj = enrichDateEra(detail.birthDate, eras);
  }
  if (detail.deathDate && typeof detail.deathDate === 'object') {
    detail._deathDateObj = enrichDateEra(detail.deathDate, eras);
  }

  const modern = isModernMember(detail);
  detail.isModern = modern;
  detail.eraCategory = modern ? 'modern' : 'ancient';
  detail.isAlive = isAliveMember(detail);

  const birthObj = detail._birthDateObj || detail.birthDate;
  const deathObj = detail._deathDateObj || detail.deathDate;

  if (modern) {
    detail.birthDateLunar = formatModernLunarDateOnly(birthObj) || '';
    detail.birthDateGregorian = formatModernGregorianLine(birthObj) || '';
    detail.birthGanzhi = formatModernGanzhi(birthObj) || '';
    detail.birthZodiac = formatModernZodiac(birthObj) || '';
    detail.constellation = String(
      member.constellation || (birthObj && birthObj.constellation) || ''
    ).trim();
    // 兼容旧单字段
    detail.birthDate = detail.birthDateLunar || formatModernDate(birthObj) || '';
    detail.birthDateEra = detail.birthDateGregorian || '';
    const deathOk = hasValidDeathDate(deathObj);
    detail.deathDateLunar = deathOk ? (formatModernLunarDateOnly(deathObj) || '') : '';
    detail.deathDateGregorian = deathOk ? (formatModernGregorianLine(deathObj) || '') : '';
    detail.deathGanzhi = deathOk ? (formatModernGanzhi(deathObj) || '') : '';
    detail.deathDate = detail.deathDateLunar || '';
    detail.deathDateEra = detail.deathDateGregorian || '';
  } else {
    const bRaw = (birthObj && birthObj.raw) || '';
    const dRaw = (deathObj && deathObj.raw) || '';
    detail.birthDate = formatNumericDate(birthObj) || bRaw || '';
    detail.birthDateEra = formatEraGanzhiDate(birthObj) || '';
    detail.birthDynasty = (birthObj && (birthObj.dynasty || '')) || '';
    detail.birthGanzhi = (birthObj && (birthObj.ganzhi || '')) || '';
    detail.birthZodiac = (birthObj && (birthObj.zodiac || '')) || '';
    detail.birthDateLunar = '';
    detail.birthDateGregorian = '';
    detail.deathDate = hasValidDeathDate(deathObj)
      ? (formatNumericDate(deathObj) || dRaw || '')
      : (dRaw || '');
    detail.deathDateEra = hasValidDeathDate(deathObj) ? (formatEraGanzhiDate(deathObj) || '') : '';
    detail.deathDynasty = (deathObj && (deathObj.dynasty || '')) || '';
    detail.deathGanzhi = (deathObj && (deathObj.ganzhi || '')) || '';
    detail.deathZodiac = (deathObj && (deathObj.zodiac || '')) || '';
    detail.deathDateLunar = '';
    detail.deathDateGregorian = '';
  }

  // 寿命/享年：有寿命字段则显示；否则有卒年时才拼「N岁」
  if (detail.lifespan != null && String(detail.lifespan).trim() !== '') {
    const life = String(detail.lifespan).trim();
    detail.lifespanText = /岁$/.test(life) || Number.isNaN(Number(life)) ? life : `${life}岁`;
  } else if (!hasValidDeathDate(deathObj)) {
    detail.lifespanText = '';
  } else {
    detail.lifespanText = '';
  }
  detail.showLifespan = true;

  // 古代：功名 / 官职（导入字段；兼容旧 positions）
  detail.gongming = member.gongming || '';
  detail.guanzhi = member.guanzhi || '';
  if (!detail.guanzhi && Array.isArray(member.positions) && member.positions.length) {
    detail.guanzhi = member.positions
      .map(p => (typeof p === 'string' ? p : (p.title || '')))
      .filter(Boolean)
      .join('；');
  }

  if (!modern) {
    detail.burialPlace = detail.burialPlace || extractBurialPlace(member.remark || '') || '';
    detail.burialGps = '';
    detail.residence = member.residence || '';
    detail.phone = '';
    detail.wechat = '';
    detail.photo = '';
    detail.photoGalleryList = [];
    detail.jobList = [];
  } else {
    detail.burialPlace = member.burialPlace || '';
    detail.burialGps = String(member.burialGps || member.burialGPS || '').trim();
    detail.residence = member.residence || '';
    detail.phone = member.phone || '';
    detail.wechat = member.wechat || '';
    detail.photo = member.photo || member.avatar || '';
    detail.photoGalleryList = formatPhotoGalleryList(member.photoGallery, 10);
  }

  let honors = Array.isArray(member.honors) ? member.honors.slice() : [];
  if (!honors.length) {
    honors = extractHonorsFromRemark(member.remark || '', { gender: member.gender });
  }
  detail.honors = honors;
  detail.honorsList = formatHonorList(honors);

  detail.educationList = formatEducationList(member.education);
  detail.workplaces = Array.isArray(member.workplaces) && member.workplaces.length
    ? member.workplaces
    : extractWorkplacesFromRemark(member.remark || '');
  detail.workplaceList = formatWorkplaceList(detail.workplaces);
  detail.jobList = modern
    ? formatJobList(member.positions, detail.workplaces)
    : [];
  detail.positionsList = formatHonorList(
    (member.positions || []).map(p => (typeof p === 'string' ? p : (p.title || '')))
  );
  detail.positionsStr = detail.positionsList.join('；');

  detail.fatherName = detail.fatherName || '';
  detail.motherName = detail.motherName || '';
  detail.remark = member.remark || '';
  detail.wechat = detail.wechat || member.wechat || '';

  // 族人姓名统一带「罗」姓（幂等，避免罗罗）
  try {
    const { withClanSurname } = require('./clanName');
    if (detail.name) detail.name = withClanSurname(detail.name);
    if (detail.fatherName) detail.fatherName = withClanSurname(detail.fatherName);
  } catch (e) { /* optional */ }

  return detail;
}

module.exports = {
  MODERN_FROM_YEAR,
  getBirthYear,
  isModernMember,
  isAliveMember,
  hasValidDeathDate,
  enrichDateEra,
  findEraForYear,
  formatNumericDate,
  formatEraGanzhiDate,
  formatModernDate,
  formatModernLunarLine,
  formatModernLunarDateOnly,
  formatModernGanzhi,
  formatModernZodiac,
  formatModernGregorianLine,
  formatDeathDisplay,
  extractBurialPlace,
  extractHonorsFromRemark,
  extractWorkplacesFromRemark,
  formatEducationList,
  formatHonorList,
  formatWorkplaceList,
  formatJobList,
  formatPhotoGalleryList,
  applyDetailDisplay,
  toChineseNumeral,
  yearToChineseDigits
};
