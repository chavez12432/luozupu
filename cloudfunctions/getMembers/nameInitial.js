/**
 * 族人显字：避开同辈共用的辈分字，显示个人区分字
 * - 罗阳先（同辈多「先」在末）→ 阳
 * - 罗涵瑜（同辈多「涵」在中）→ 瑜
 */
const { stripClanSurname } = require('./clanName');

function givenName(name) {
  return stripClanSurname(name);
}

/**
 * 从同伴姓名推断某堂某世的辈分字位置
 * @returns {{ pos: 2|3, char: string, count: number, total: number } | null}
 */
function inferBeiweiFromPeers(peerNames) {
  const c2 = Object.create(null);
  const c3 = Object.create(null);
  let total = 0;
  (peerNames || []).forEach((name) => {
    const g = givenName(name);
    if (g.length < 2) return;
    total += 1;
    const a = g.charAt(0);
    const b = g.charAt(1);
    c2[a] = (c2[a] || 0) + 1;
    c3[b] = (c3[b] || 0) + 1;
  });
  if (total < 2) return null;

  const top2 = Object.keys(c2).sort((x, y) => c2[y] - c2[x] || x.localeCompare(y))[0];
  const top3 = Object.keys(c3).sort((x, y) => c3[y] - c3[x] || x.localeCompare(y))[0];
  const n2 = top2 ? c2[top2] : 0;
  const n3 = top3 ? c3[top3] : 0;
  const minVotes = Math.max(2, Math.ceil(total * 0.2));

  // 末字更集中 → 辈字在第3字（显第2字）
  if (n3 >= minVotes && n3 >= n2) {
    return { pos: 3, char: top3, count: n3, total };
  }
  // 中间字更集中 → 辈字在第2字（显第3字）
  if (n2 >= minVotes && n2 > n3) {
    return { pos: 2, char: top2, count: n2, total };
  }
  return null;
}

/**
 * 从成员列表构建 index：key = `${branch}|${generation}`
 */
function buildBeiweiIndex(members) {
  const groups = Object.create(null);
  (members || []).forEach((m) => {
    if (!m || m.name == null) return;
    const branch = String(m.branch || '').trim();
    const gen = m.generation != null ? String(m.generation) : '';
    if (!branch || !gen) return;
    const key = `${branch}|${gen}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(m.name);
  });
  const index = Object.create(null);
  Object.keys(groups).forEach((key) => {
    const info = inferBeiweiFromPeers(groups[key]);
    if (info) index[key] = info;
  });
  return index;
}

/**
 * @param {string} name
 * @param {{ generation?: number|string, branch?: string, index?: object }} [opts]
 */
function displayNameChar(name, opts = {}) {
  const given = givenName(name);
  if (!given) {
    const raw = String(name || '').trim();
    return raw ? raw.charAt(0) : '';
  }
  if (given.length === 1) return given.charAt(0);

  const c2 = given.charAt(0);
  const c3 = given.charAt(1);
  const branch = String((opts && opts.branch) || '').trim();
  const gen = opts && opts.generation != null ? String(opts.generation) : '';
  const index = opts && opts.index;
  const info = index && branch && gen ? index[`${branch}|${gen}`] : null;

  if (info && info.pos === 3) return c2; // 辈字在末 → 显中间
  if (info && info.pos === 2) return c3; // 辈字在中 → 显末字

  // 无同伴信息：近现代（≥30世）多末字排辈，显中间；更早多中间排辈，显末字
  const genNum = Number(opts && opts.generation);
  if (!Number.isNaN(genNum) && genNum >= 30) return c2;
  return c3;
}

module.exports = {
  givenName,
  inferBeiweiFromPeers,
  buildBeiweiIndex,
  displayNameChar
};
