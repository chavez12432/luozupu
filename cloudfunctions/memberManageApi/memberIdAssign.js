/**
 * 族人 ID：按堂份前缀递增
 * - 忠爱堂：C0242
 * - 中和/明儒/德裕堂：M0390
 * originalId 与 memberId 保持同值（与存量数据一致）
 */

const BRANCH_ID_PREFIX = {
  忠爱堂: 'C',
  中和堂: 'M',
  明儒堂: 'M',
  德裕堂: 'M'
};

function branchIdPrefix(branch) {
  const key = String(branch || '').trim();
  return BRANCH_ID_PREFIX[key] || 'M';
}

function parsePrefixedId(id) {
  const m = String(id || '').trim().match(/^([A-Za-z]+)(\d+)$/);
  if (!m) return null;
  return { prefix: m[1].toUpperCase(), num: Number(m[2]), raw: m[0] };
}

function formatPrefixedId(prefix, num) {
  const n = Number(num);
  const safe = !n || Number.isNaN(n) || n < 1 ? 1 : n;
  return `${String(prefix || 'M').toUpperCase()}${String(safe).padStart(4, '0')}`;
}

function collectUsedIds(members) {
  const used = new Set();
  (members || []).forEach((m) => {
    [m && m.memberId, m && m.originalId].forEach((id) => {
      if (id == null || id === '') return;
      used.add(String(id));
      const p = parsePrefixedId(id);
      if (p) used.add(formatPrefixedId(p.prefix, p.num));
    });
  });
  return used;
}

function maxNumForBranch(members, branch, prefix) {
  let max = 0;
  const b = String(branch || '').trim();
  (members || []).forEach((m) => {
    if (!m) return;
    if (b && String(m.branch || '').trim() !== b) return;
    const p = parsePrefixedId(m.memberId) || parsePrefixedId(m.originalId);
    if (!p || p.prefix !== prefix) return;
    if (p.num > max) max = p.num;
  });
  return max;
}

/** 按堂份取下一号；同前缀全局避让撞号（依赖传入的 members 全集或随后 DB 探测） */
function nextIdsForBranch(members, branch) {
  const prefix = branchIdPrefix(branch);
  const used = collectUsedIds(members);
  let n = maxNumForBranch(members, branch, prefix) + 1;
  if (n < 1) n = 1;
  let memberId = formatPrefixedId(prefix, n);
  while (used.has(memberId)) {
    n += 1;
    memberId = formatPrefixedId(prefix, n);
  }
  return { originalId: memberId, memberId, prefix, num: n };
}

function parseMemberNumericId(member) {
  const p =
    parsePrefixedId(member && member.memberId) ||
    parsePrefixedId(member && member.originalId);
  if (p) return p.num;
  const fromOrig = Number(member && member.originalId);
  if (!Number.isNaN(fromOrig) && fromOrig > 0) return fromOrig;
  return 0;
}

function maxMemberNumericId(members) {
  let max = 0;
  for (const m of members || []) {
    const n = parseMemberNumericId(m);
    if (n > max) max = n;
  }
  return max;
}

function idsFromNumeric(n) {
  const memberId = formatPrefixedId('M', n);
  return { originalId: memberId, memberId };
}

function nextIdsFromMembers(members) {
  return nextIdsForBranch(members, '');
}

function ensureMemberIds(doc, membersForMax) {
  const out = { ...(doc || {}) };
  const hasMemberId = out.memberId != null && String(out.memberId).trim() !== '';
  const hasOriginalId = out.originalId != null && out.originalId !== '';

  if (hasMemberId && hasOriginalId) return out;

  const next = nextIdsForBranch(membersForMax || [], out.branch || '');
  if (!hasOriginalId) out.originalId = next.originalId;
  if (!hasMemberId) {
    out.memberId = hasOriginalId ? String(out.originalId) : next.memberId;
  }
  return out;
}

/**
 * 云库：本堂最大号 +1，再探测 memberId/originalId 是否已被占用
 */
async function nextIdsForBranchFromDb(db, branch, fallbackMembers) {
  const prefix = branchIdPrefix(branch);
  const b = String(branch || '').trim();
  let start = 1;

  if (db && b) {
    try {
      const res = await db
        .collection('members')
        .where({ branch: b })
        .field({ memberId: true, originalId: true, branch: true })
        .limit(1000)
        .get();
      start = maxNumForBranch(res.data || [], b, prefix) + 1;
    } catch (e) {
      start = maxNumForBranch(fallbackMembers || [], b, prefix) + 1;
    }
  } else {
    start = maxNumForBranch(fallbackMembers || [], b, prefix) + 1;
  }
  if (start < 1) start = 1;

  if (!db) {
    return nextIdsForBranch(fallbackMembers || [], branch);
  }

  const _ = db.command;
  for (let i = 0; i < 80; i++) {
    const n = start + i;
    const memberId = formatPrefixedId(prefix, n);
    try {
      const clash = await db
        .collection('members')
        .where(_.or([{ memberId }, { originalId: memberId }]))
        .limit(1)
        .get();
      if (!(clash.data && clash.data.length)) {
        return { originalId: memberId, memberId, prefix, num: n };
      }
    } catch (e) {
      // 探测失败不可当作可用，继续试下一号
      continue;
    }
  }

  return nextIdsForBranch(fallbackMembers || [], branch);
}

async function nextOriginalIdFromDb(db, fallbackMembers) {
  const next = await nextIdsForBranchFromDb(db, '', fallbackMembers);
  return next.originalId;
}

async function assignMemberIdsForCreate(db, doc, fallbackMembers) {
  const out = { ...(doc || {}) };
  if (out.memberId != null && String(out.memberId).trim() === '') delete out.memberId;
  if (out.originalId === '') delete out.originalId;

  if (out.memberId && out.originalId != null && out.originalId !== '') return out;

  const next = await nextIdsForBranchFromDb(db, out.branch || '', fallbackMembers);
  if (out.originalId == null || out.originalId === '') out.originalId = next.originalId;
  if (!out.memberId) out.memberId = String(out.originalId);
  return out;
}

module.exports = {
  BRANCH_ID_PREFIX,
  branchIdPrefix,
  parsePrefixedId,
  formatPrefixedId,
  nextIdsForBranch,
  nextIdsForBranchFromDb,
  parseMemberNumericId,
  maxMemberNumericId,
  idsFromNumeric,
  nextIdsFromMembers,
  ensureMemberIds,
  nextOriginalIdFromDb,
  assignMemberIdsForCreate
};
