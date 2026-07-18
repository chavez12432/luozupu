/**
 * 检查备注中记载的子女 vs 实际 fatherId / childrenIds 关联
 * 用法：
 *   node scripts/auditAndFixChildren.js          # 仅审计
 *   node scripts/auditAndFixChildren.js --fix   # 修复可唯一匹配的断链
 */
const fs = require('fs');
const path = require('path');
const {
  parseChildrenFromRemark,
  toSimplified,
  namesMatch
} = require('../utils/childrenParser');

const ROOT = path.join(__dirname, '..');
const MEMBERS_JSON = path.join(ROOT, 'database', 'members_export.json');
const MEMBERS_JSONL = path.join(ROOT, 'database', 'members_export.jsonl');
const MEMBERS_CLOUD = path.join(ROOT, 'database', 'members_cloud_import.json');
const MEMBERS_ANCIENT = path.join(ROOT, 'database', 'members_ancient_export.json');
const MEMBERS_MODERN = path.join(ROOT, 'database', 'members_modern_export.json');
const REPORT_PATH = path.join(ROOT, 'database', 'children_link_audit_report.json');
const PATCH_PATH = path.join(ROOT, 'database', 'children_father_link_patch.jsonl');

const doFix = process.argv.includes('--fix');

function writeJsonArray(filePath, arr) {
  fs.writeFileSync(filePath, JSON.stringify(arr), 'utf8');
}

function writeJsonl(filePath, arr) {
  fs.writeFileSync(filePath, arr.map(m => JSON.stringify(m)).join('\n') + '\n', 'utf8');
}

function detectFormat(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').trimStart();
  return raw.startsWith('[') ? 'array' : 'jsonl';
}

function writeSameFormat(filePath, membersSubset) {
  if (!fs.existsSync(filePath)) return;
  const fmt = detectFormat(filePath);
  if (fmt === 'array') writeJsonArray(filePath, membersSubset);
  else writeJsonl(filePath, membersSubset);
}

function loadMembersFrom(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) return JSON.parse(trimmed);
  return trimmed.split(/\n+/).filter(Boolean).map(l => JSON.parse(l));
}

function main() {
  const members = loadMembersFrom(MEMBERS_JSON);
  const byOriginalId = new Map();
  const byNameGenBranch = new Map();
  const byNameGen = new Map();
  const bySimpNameGenBranch = new Map();
  const bySimpNameGen = new Map();

  members.forEach(m => {
    byOriginalId.set(String(m.originalId), m);
    const key1 = `${m.name}|${m.generation}|${m.branch || ''}`;
    const key2 = `${m.name}|${m.generation}`;
    const sk1 = `${toSimplified(m.name)}|${m.generation}|${m.branch || ''}`;
    const sk2 = `${toSimplified(m.name)}|${m.generation}`;
    if (!byNameGenBranch.has(key1)) byNameGenBranch.set(key1, []);
    byNameGenBranch.get(key1).push(m);
    if (!byNameGen.has(key2)) byNameGen.set(key2, []);
    byNameGen.get(key2).push(m);
    if (!bySimpNameGenBranch.has(sk1)) bySimpNameGenBranch.set(sk1, []);
    bySimpNameGenBranch.get(sk1).push(m);
    if (!bySimpNameGen.has(sk2)) bySimpNameGen.set(sk2, []);
    bySimpNameGen.get(sk2).push(m);
  });

  const childrenByFather = new Map();
  members.forEach(c => {
    const fid = c.fatherId != null ? String(c.fatherId) : '';
    if (!fid || fid === '0' || fid === 'null') return;
    if (!childrenByFather.has(fid)) childrenByFather.set(fid, []);
    childrenByFather.get(fid).push(c);
  });

  function findCandidates(name, father) {
    const expectGen = (father.generation || 0) + 1;
    const simp = toSimplified(name);
    let cands = bySimpNameGenBranch.get(`${simp}|${expectGen}|${father.branch || ''}`) || [];
    if (!cands.length) cands = bySimpNameGen.get(`${simp}|${expectGen}`) || [];
    if (!cands.length) {
      // 世代偏差 ±1（偶有脏数据）
      for (const d of [-1, 1, 2]) {
        const g = expectGen + d;
        cands = bySimpNameGenBranch.get(`${simp}|${g}|${father.branch || ''}`) || [];
        if (cands.length) break;
        cands = bySimpNameGen.get(`${simp}|${g}`) || [];
        if (cands.length) break;
      }
    }
    return cands;
  }

  const fixable = [];
  const unresolvedEmpty = [];
  const unresolvedPartial = [];
  const alreadyOk = [];
  const proposedLinks = [];
  let withParsed = 0;

  for (const m of members) {
    const parsed = parseChildrenFromRemark(m.remark);
    if (!parsed.length) continue;
    withParsed++;

    const linked = childrenByFather.get(String(m.originalId)) || [];
    const linkedKeys = new Set(linked.map(c => toSimplified(c.name)));
    const fatherFixes = [];
    const notFound = [];
    const problems = [];

    for (const p of parsed) {
      const key = toSimplified(p.name);
      if (linkedKeys.has(key)) continue;
      // 已关联列表中是否有繁简等价名
      if (linked.some(c => namesMatch(c.name, p.name))) continue;

      const cands = findCandidates(p.name, m);
      const unlinked = cands.filter(c => !c.fatherId || String(c.fatherId) === '' || String(c.fatherId) === '0');
      const alreadyOther = cands.filter(c => c.fatherId && String(c.fatherId) !== String(m.originalId)
        && String(c.fatherId) !== '' && String(c.fatherId) !== '0');

      if (unlinked.length === 1) {
        fatherFixes.push({ name: p.name, child: unlinked[0] });
      } else if (unlinked.length > 1) {
        problems.push({ name: p.name, reason: 'ambiguous_unlinked', ids: unlinked.map(c => c.originalId) });
      } else if (alreadyOther.length >= 1 && unlinked.length === 0) {
        // 已被别人挂父：若本父备注也写了，记问题但不强改
        problems.push({
          name: p.name,
          reason: 'has_other_father',
          childId: alreadyOther[0].originalId,
          otherFatherId: alreadyOther[0].fatherId
        });
      } else if (!cands.length) {
        notFound.push(p.name);
      } else {
        problems.push({ name: p.name, reason: 'unresolved', candCount: cands.length });
      }
    }

    if (!fatherFixes.length && !notFound.length && !problems.length) {
      alreadyOk.push(m.originalId);
      continue;
    }

    const entry = {
      father: {
        originalId: m.originalId,
        memberId: m.memberId,
        name: m.name,
        generation: m.generation,
        branch: m.branch
      },
      remarkParsed: parsed.map(p => p.name),
      currentlyLinked: linked.map(c => c.name),
      linkable: fatherFixes.map(x => ({
        name: x.name,
        childOriginalId: x.child.originalId,
        childMemberId: x.child.memberId,
        childName: x.child.name,
        childGeneration: x.child.generation,
        childBranch: x.child.branch
      })),
      notFound,
      problems
    };

    if (fatherFixes.length) {
      fixable.push(entry);
      fatherFixes.forEach(x => {
        proposedLinks.push({
          fatherOriginalId: m.originalId,
          fatherName: m.name,
          fatherGeneration: m.generation,
          childOriginalId: x.child.originalId,
          childMemberId: x.child.memberId,
          childName: x.child.name,
          remarkName: x.name
        });
      });
    }

    const trulyMissing = notFound.length || problems.length;
    if (trulyMissing) {
      if (!linked.length && !fatherFixes.length) unresolvedEmpty.push(entry);
      else unresolvedPartial.push(entry);
    }
  }

  // 子女被多个父亲争抢：优先收养方（备注写继立/无「出继」），排除「出继」生父
  const claimCount = new Map();
  proposedLinks.forEach(l => {
    const k = String(l.childOriginalId);
    if (!claimCount.has(k)) claimCount.set(k, []);
    claimCount.get(k).push(l);
  });

  const safeLinks = [];
  const conflicts = [];
  claimCount.forEach((links, childId) => {
    if (links.length === 1) {
      safeLinks.push(links[0]);
      return;
    }
    const scored = links.map(l => {
      const father = byOriginalId.get(String(l.fatherOriginalId));
      const remark = (father && father.remark) || '';
      const childName = l.childName || l.remarkName || '';
      let score = 0;
      // 生父写出继 → 低分
      if (new RegExp(`${childName}[^。；]{0,12}出继`).test(remark.replace(/\s+/g, ''))) score -= 10;
      if (/继立|抚子|扶子|嗣子|承继/.test(remark.replace(/\s+/g, ''))) score += 5;
      if (father && Array.isArray(father.childrenIds) && father.childrenIds.includes(l.childMemberId)) score += 3;
      return { l, score };
    });
    scored.sort((a, b) => b.score - a.score);
    if (scored[0].score > scored[1].score) {
      safeLinks.push(scored[0].l);
      conflicts.push(...scored.slice(1).map(s => Object.assign({}, s.l, { skippedFor: scored[0].l.fatherName })));
    } else {
      conflicts.push(...links);
    }
  });
  const conflictIds = new Set(conflicts.filter(c => !c.skippedFor).map(c => String(c.childOriginalId)));

  const report = {
    generatedAt: new Date().toISOString(),
    doFix,
    stats: {
      members: members.length,
      withParsedChildrenInRemark: withParsed,
      alreadyFullyLinked: alreadyOk.length,
      fathersWithFixableLinks: fixable.length,
      linkableChildRecords: proposedLinks.length,
      safeLinkableAfterConflictFilter: safeLinks.length,
      conflictChildIds: [...conflictIds],
      fathersWithZeroLinkedAndMissing: unresolvedEmpty.length,
      fathersWithPartialOrNameVariantIssues: unresolvedPartial.length
    },
    proposedLinks: safeLinks,
    conflicts,
    conflictChildIds: [...new Set(conflicts.map(c => String(c.childOriginalId)))],
    fixable,
    unresolvedEmpty,
    unresolvedPartial
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log('[audit] stats:', JSON.stringify(report.stats, null, 2));
  console.log('[audit] report:', REPORT_PATH);

  const ganda = [...fixable, ...unresolvedEmpty].find(e => e.father.name === '干达' && e.father.generation === 26);
  if (ganda) console.log('[sample 干达]', JSON.stringify(ganda, null, 2));

  if (!doFix) {
    console.log('提示：加 --fix 将写回 fatherId / fatherName / childrenIds');
    return;
  }

  let fixedChildren = 0;
  const patched = [];

  safeLinks.forEach(l => {
    const child = byOriginalId.get(String(l.childOriginalId));
    const father = byOriginalId.get(String(l.fatherOriginalId));
    if (!child || !father) return;
    child.fatherId = String(l.fatherOriginalId);
    child.fatherName = father.name;
    fixedChildren++;
    patched.push({
      _id: child._id,
      memberId: child.memberId,
      originalId: child.originalId,
      name: child.name,
      fatherId: child.fatherId,
      fatherName: child.fatherName
    });
  });

  // 重建全部 childrenIds
  const kidsByFather = new Map();
  members.forEach(c => {
    const fid = c.fatherId != null ? String(c.fatherId) : '';
    if (!fid) return;
    if (!kidsByFather.has(fid)) kidsByFather.set(fid, []);
    kidsByFather.get(fid).push(c);
  });
  members.forEach(m => {
    const kids = kidsByFather.get(String(m.originalId)) || [];
    m.childrenIds = kids.map(c => c.memberId).filter(Boolean);
  });

  // 父记录 childrenIds 变更也写入补丁（便于云端更新）
  const fatherPatchIds = new Set(safeLinks.map(l => String(l.fatherOriginalId)));
  fatherPatchIds.forEach(fid => {
    const father = byOriginalId.get(fid);
    if (!father) return;
    patched.push({
      _id: father._id,
      memberId: father.memberId,
      originalId: father.originalId,
      name: father.name,
      childrenIds: father.childrenIds
    });
  });

  writeJsonArray(MEMBERS_JSON, members);
  writeJsonl(MEMBERS_JSONL, members);
  writeJsonl(MEMBERS_CLOUD, members);

  if (fs.existsSync(MEMBERS_ANCIENT)) {
    const ancientList = loadMembersFrom(MEMBERS_ANCIENT);
    const idSet = new Set(ancientList.map(m => m._id || m.memberId));
    const updated = members.filter(m => idSet.has(m._id) || idSet.has(m.memberId));
    writeSameFormat(MEMBERS_ANCIENT, updated);
  }
  if (fs.existsSync(MEMBERS_MODERN)) {
    const modernList = loadMembersFrom(MEMBERS_MODERN);
    const idSet = new Set(modernList.map(m => m._id || m.memberId));
    const updated = members.filter(m => idSet.has(m._id) || idSet.has(m.memberId));
    writeSameFormat(MEMBERS_MODERN, updated);
  }

  writeJsonl(PATCH_PATH, patched);

  console.log('[fix] linked children:', fixedChildren, 'conflicts skipped:', conflictIds.size);
  console.log('[fix] patch for cloud:', PATCH_PATH);
}

main();
