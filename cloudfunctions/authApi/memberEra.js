/**
 * 认证用：古今判定（比展示层更严）
 * 仅 eraCategory=modern，或出生年 >= 1912 / 民国·共和国朝代 可验证；
 * 未知或古代一律不可验证（禁止用「世代≥30」启发式放行）。
 */
const MODERN_FROM_YEAR = 1912;

function getBirthYear(member) {
  if (!member || !member.birthDate) return null;
  const lunar = member.birthDate.lunar;
  if (lunar && lunar.year != null && lunar.year !== '') return Number(lunar.year);
  const g = member.birthDate.gregorian;
  if (g && g.year != null && g.year !== '') return Number(g.year);
  return null;
}

function isModernMember(member) {
  if (!member) return false;
  if (member.eraCategory === 'ancient') return false;
  if (member.eraCategory === 'modern') return true;

  const year = getBirthYear(member);
  if (year != null && !Number.isNaN(year)) {
    return year >= MODERN_FROM_YEAR;
  }
  const dynasty = (member.birthDate && member.birthDate.dynasty) || '';
  if (dynasty.includes('民国') || dynasty.includes('中华人民共和国') || dynasty.includes('共和国')) {
    return true;
  }
  if (['宋', '元', '明', '清'].some((d) => dynasty === d || dynasty.includes(d))) {
    return false;
  }
  // 认证路径：未知不放行
  return false;
}

module.exports = {
  MODERN_FROM_YEAR,
  getBirthYear,
  isModernMember
};
