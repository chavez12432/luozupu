/**
 * 族人 memberId（M000001）/ originalId（数字）分配
 */
function parseMemberNumericId(member) {
  const fromOrig = Number(member && member.originalId);
  if (!isNaN(fromOrig) && fromOrig > 0) return fromOrig;
  const m = String((member && member.memberId) || '').match(/^M0*(\d+)$/i);
  return m ? Number(m[1]) : 0;
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
  const num = Number(n);
  const originalId = isNaN(num) || num <= 0 ? 1 : num;
  return {
    originalId,
    memberId: `M${String(originalId).padStart(6, '0')}`
  };
}

function nextIdsFromMembers(members) {
  return idsFromNumeric(maxMemberNumericId(members) + 1);
}

function ensureMemberIds(doc, membersForMax) {
  const out = { ...(doc || {}) };
  const hasMemberId = out.memberId != null && String(out.memberId).trim() !== '';
  const hasOriginalId = out.originalId != null && out.originalId !== '';

  if (hasMemberId && hasOriginalId) return out;

  const next = nextIdsFromMembers(membersForMax || []);
  if (!hasOriginalId) out.originalId = next.originalId;
  if (!hasMemberId) {
    out.memberId = hasOriginalId
      ? idsFromNumeric(out.originalId).memberId
      : next.memberId;
  }
  return out;
}

async function nextOriginalIdFromDb(db, fallbackMembers) {
  if (db) {
    try {
      const res = await db.collection('members').orderBy('originalId', 'desc').limit(1).get();
      const top = res.data && res.data[0];
      const n = top && top.originalId != null ? Number(top.originalId) : 0;
      if (!isNaN(n) && n > 0) return n + 1;
    } catch (e) {
      // 无索引或查询失败时回退本地
    }
  }
  return nextIdsFromMembers(fallbackMembers || []).originalId;
}

async function assignMemberIdsForCreate(db, doc, fallbackMembers) {
  const out = { ...(doc || {}) };
  if (out.memberId != null && String(out.memberId).trim() === '') delete out.memberId;
  if (out.originalId === '') delete out.originalId;

  if (out.memberId && out.originalId != null && out.originalId !== '') return out;

  const originalId =
    out.originalId != null && out.originalId !== ''
      ? Number(out.originalId)
      : await nextOriginalIdFromDb(db, fallbackMembers);

  if (!out.originalId) out.originalId = originalId;
  if (!out.memberId) out.memberId = idsFromNumeric(originalId).memberId;
  return out;
}

module.exports = {
  parseMemberNumericId,
  maxMemberNumericId,
  idsFromNumeric,
  nextIdsFromMembers,
  ensureMemberIds,
  nextOriginalIdFromDb,
  assignMemberIdsForCreate
};
