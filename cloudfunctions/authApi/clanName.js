/**
 * 族人姓名：统一加「罗」姓，避免「罗罗」重复
 */
function stripClanSurname(name) {
  let n = String(name || '').trim();
  while (n.startsWith('罗') && n.length > 1) {
    n = n.slice(1).trim();
  }
  return n;
}

function withClanSurname(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  // 已是罗姓则不再加；先剥再加，消除历史「罗罗」
  const base = stripClanSurname(raw);
  if (!base) return '罗';
  return `罗${base}`;
}

function clanNamesEqual(a, b) {
  return stripClanSurname(a) === stripClanSurname(b);
}

module.exports = {
  stripClanSurname,
  withClanSurname,
  clanNamesEqual
};
