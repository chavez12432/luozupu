/**
 * 公历 / 农历互转（基于 lunar-javascript）
 */
const { Solar, Lunar } = require('./vendor/lunar');

const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

function getGanzhiZodiac(year) {
  const y = Number(year);
  if (!y) return { ganzhi: '', zodiac: '' };
  const ganIndex = ((y - 4) % 10 + 10) % 10;
  const zhiIndex = ((y - 4) % 12 + 12) % 12;
  return {
    ganzhi: TIAN_GAN[ganIndex] + DI_ZHI[zhiIndex],
    zodiac: ZODIAC[zhiIndex]
  };
}

/**
 * 公历 → 完整 birthDate 结构
 */
function fromGregorian(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || !m || !d) return null;
  try {
    const solar = Solar.fromYmd(y, m, d);
    const lunar = solar.getLunar();
    const gz = getGanzhiZodiac(lunar.getYear());
    return {
      lunar: {
        year: lunar.getYear(),
        month: Math.abs(lunar.getMonth()),
        day: lunar.getDay(),
        isLeap: lunar.getMonth() < 0,
        formatted: lunar.toString()
      },
      gregorian: {
        year: y,
        month: m,
        day: d,
        formatted: `${y}年${m}月${d}日`
      },
      ganzhi: gz.ganzhi ? `${gz.ganzhi}年` : '',
      zodiac: gz.zodiac,
      converted: true
    };
  } catch (e) {
    console.warn('[dateConvert] fromGregorian failed', e);
    return null;
  }
}

/**
 * 农历 → 完整 birthDate 结构
 */
function fromLunar(year, month, day, isLeap) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || !m || !d) return null;
  try {
    const lunarMonth = isLeap ? -m : m;
    const lunar = Lunar.fromYmd(y, lunarMonth, d);
    const solar = lunar.getSolar();
    const gz = getGanzhiZodiac(lunar.getYear());
    return {
      lunar: {
        year: lunar.getYear(),
        month: Math.abs(lunar.getMonth()),
        day: lunar.getDay(),
        isLeap: lunar.getMonth() < 0,
        formatted: lunar.toString()
      },
      gregorian: {
        year: solar.getYear(),
        month: solar.getMonth(),
        day: solar.getDay(),
        formatted: `${solar.getYear()}年${solar.getMonth()}月${solar.getDay()}日`
      },
      ganzhi: gz.ganzhi ? `${gz.ganzhi}年` : '',
      zodiac: gz.zodiac,
      converted: true
    };
  } catch (e) {
    console.warn('[dateConvert] fromLunar failed', e);
    return null;
  }
}

/**
 * 从已有 dateObj 尽量补全公历/农历
 */
function enrichBirthDate(dateObj) {
  if (!dateObj || typeof dateObj !== 'object') return dateObj;
  const lunar = dateObj.lunar || {};
  const g = dateObj.gregorian || {};
  if (lunar.year && lunar.month && lunar.day) {
    const full = fromLunar(lunar.year, lunar.month, lunar.day, lunar.isLeap);
    if (full) return Object.assign({}, dateObj, full);
  }
  if (g.year && g.month && g.day) {
    const full = fromGregorian(g.year, g.month, g.day);
    if (full) return Object.assign({}, dateObj, full);
  }
  return dateObj;
}

module.exports = {
  fromGregorian,
  fromLunar,
  enrichBirthDate,
  getGanzhiZodiac,
  Solar,
  Lunar
};
