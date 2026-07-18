/**
 * å…¬å† / å†œå†äº’è½¬ï¼ˆåŸºäº?lunar-javascriptï¼?
 */
const { Solar, Lunar } = require('./vendor/lunar');

const ZODIAC = ['é¼?, 'ç‰?, 'è™?, 'å…?, 'é¾?, 'è›?, 'é©?, 'ç¾?, 'çŒ?, 'é¸?, 'ç‹?, 'çŒ?];
const TIAN_GAN = ['ç”?, 'ä¹?, 'ä¸?, 'ä¸?, 'æˆ?, 'å·?, 'åº?, 'è¾?, 'å£?, 'ç™?];
const DI_ZHI = ['å­?, 'ä¸?, 'å¯?, 'å?, 'è¾?, 'å·?, 'å?, 'æœ?, 'ç”?, 'é…?, 'æˆ?, 'äº?];

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
 * å…¬å† â†?å®Œæ•´ birthDate ç»“æ„
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
        formatted: `${y}å¹?{m}æœ?{d}æ—¥`
      },
      ganzhi: gz.ganzhi ? `${gz.ganzhi}å¹´` : '',
      zodiac: gz.zodiac,
      converted: true
    };
  } catch (e) {
    console.warn('[dateConvert] fromGregorian failed', e);
    return null;
  }
}

/**
 * å†œå† â†?å®Œæ•´ birthDate ç»“æ„
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
        formatted: `${solar.getYear()}å¹?{solar.getMonth()}æœ?{solar.getDay()}æ—¥`
      },
      ganzhi: gz.ganzhi ? `${gz.ganzhi}å¹´` : '',
      zodiac: gz.zodiac,
      converted: true
    };
  } catch (e) {
    console.warn('[dateConvert] fromLunar failed', e);
    return null;
  }
}

/**
 * ä»å·²æœ?dateObj å°½é‡è¡¥å…¨å…¬å†/å†œå†
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
