/**
 * 农历/公历/干支转换工具
 * 基于农历算法实现
 */

// 天干
const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
// 地支
const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
// 生肖
const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
// 农历月份名称
const LUNAR_MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
// 农历日期名称
const LUNAR_DAYS = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
];

/**
 * 获取干支纪年
 * @param {number} year - 公历年份
 * @returns {object} {ganzhi, zodiac}
 */
function getGanzhi(year) {
  const ganIndex = (year - 4) % 10;
  const zhiIndex = (year - 4) % 12;
  
  return {
    ganzhi: TIAN_GAN[ganIndex] + DI_ZHI[zhiIndex] + '年',
    zodiac: ZODIAC[zhiIndex]
  };
}

/**
 * 农历日期格式化
 * @param {object} lunar - {year, month, day, isLeap}
 * @returns {string}
 */
function formatLunarDate(lunar) {
  if (!lunar || !lunar.year) return '';
  
  const monthStr = (lunar.isLeap ? '闰' : '') + LUNAR_MONTHS[lunar.month - 1] + '月';
  const dayStr = LUNAR_DAYS[lunar.day - 1];
  
  return `${lunar.year}年${monthStr} ${dayStr}`;
}

/**
 * 公历日期格式化
 * @param {object} gregorian - {year, month, day}
 * @returns {string}
 */
function formatGregorianDate(gregorian) {
  if (!gregorian || !gregorian.year) return '';
  return `${gregorian.year}年${gregorian.month}月${gregorian.day}日`;
}

/**
 * 获取年号纪年信息
 * @param {number} year - 公历年份
 * @param {array} dynastyEras - 朝代年号数据
 * @returns {object}
 */
function getEraName(year, dynastyEras) {
  // 清朝之后（1912年后）不显示年号
  if (year >= 1912) {
    return {
      dynasty: year >= 1949 ? '中华人民共和国' : '民国',
      emperor: null,
      eraName: null,
      eraYear: null
    };
  }
  
  // 查找对应的年号
  const era = dynastyEras.find(e => year >= e.startYear && year <= e.endYear);
  
  if (era) {
    return {
      dynasty: era.dynasty,
      emperor: era.emperor,
      eraName: era.eraName,
      eraYear: year - era.startYear + 1
    };
  }
  
  return null;
}

/**
 * 完整的日期转换和格式化
 * @param {object} dateInput - {lunar: {year, month, day, isLeap}}
 * @param {array} dynastyEras - 朝代年号数据
 * @returns {object} 完整的日期信息
 */
async function convertDate(dateInput, db) {
  if (!dateInput || !dateInput.lunar || !dateInput.lunar.year) {
    return null;
  }
  
  const { year, month, day, isLeap = false } = dateInput.lunar;
  
  // 从数据库获取朝代年号数据
  let dynastyEras = [];
  try {
    const { data } = await db.collection('dynasty_eras').get();
    dynastyEras = data;
  } catch (e) {
    console.error('获取朝代年号数据失败', e);
  }
  
  // 简化的农历转公历（实际项目中应使用完整的农历算法库）
  // 这里使用近似值，实际应调用农历转换库
  const gregorian = lunarToGregorian(year, month, day, isLeap);
  
  // 获取干支
  const ganzhiInfo = getGanzhi(gregorian.year);
  
  // 获取年号
  const eraInfo = getEraName(gregorian.year, dynastyEras);
  
  return {
    lunar: {
      year,
      month,
      day,
      isLeap,
      formatted: formatLunarDate({ year, month, day, isLeap })
    },
    gregorian: {
      ...gregorian,
      formatted: formatGregorianDate(gregorian)
    },
    ...ganzhiInfo,
    ...eraInfo
  };
}

/**
 * 简化的农历转公历（示例实现）
 * 实际项目中应使用 lunar-javascript 等完整库
 */
function lunarToGregorian(year, month, day, isLeap) {
  // 这是一个简化的示例实现
  // 实际项目中应该使用完整的农历算法库
  
  // 近似计算：农历日期通常比公历晚1-2个月
  let gYear = year;
  let gMonth = month + 1;
  let gDay = day;
  
  if (gMonth > 12) {
    gMonth -= 12;
    gYear += 1;
  }
  
  return { year: gYear, month: gMonth, day: gDay };
}

/**
 * 格式化日期用于前端显示
 * @param {object} dateData - convertDate返回的完整日期数据
 * @returns {string} 格式化的显示文本
 */
function formatDateForDisplay(dateData) {
  if (!dateData) return '不详';
  
  const lines = [];
  
  // 农历
  lines.push(`农历：${dateData.lunar.formatted}`);
  
  // 公历
  lines.push(`公历：${dateData.gregorian.formatted}`);
  
  // 年号纪年（清朝后显示"-"）
  if (dateData.eraName) {
    lines.push(`年号纪年：${dateData.dynasty} ${dateData.emperor} ${dateData.eraName}${dateData.eraYear}年`);
  } else {
    lines.push(`年号纪年：-`);
  }
  
  // 干支纪年
  lines.push(`干支纪年：${dateData.ganzhi}（${dateData.zodiac}年）`);
  
  return lines.join('\n');
}

module.exports = {
  getGanzhi,
  formatLunarDate,
  formatGregorianDate,
  getEraName,
  convertDate,
  formatDateForDisplay,
  TIAN_GAN,
  DI_ZHI,
  ZODIAC,
  LUNAR_MONTHS,
  LUNAR_DAYS
};
