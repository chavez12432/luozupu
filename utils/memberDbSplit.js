/**
 * 族人库拆分：民国元年（1912）为界 → 古代 / 现代
 * Node 与脚本共用（admin 代理、split 脚本）
 */
const fs = require('fs');
const path = require('path');
const { isModernMember, MODERN_FROM_YEAR } = require('./memberEra');

const ROOT = path.join(__dirname, '..');

const PATHS = {
  /** 后台合并源（不打进小程序主包） */
  membersAll: path.join(ROOT, 'database', 'members_export.json'),
  ancient: path.join(ROOT, 'pkg-local', 'database', 'members_ancient_export.json'),
  modern: path.join(ROOT, 'pkg-local', 'database', 'members_modern_export.json')
};

/** 小程序分包内路径（相对项目根） */
const WX_PATHS = {
  ancient: 'pkg-local/database/members_ancient_export.json',
  modern: 'pkg-local/database/members_modern_export.json'
};

function parseMembersFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return [];
  if (raw.startsWith('[')) {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }
  return raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function writeCompactJson(filePath, rows) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(rows), 'utf8');
}

function classifyMember(member) {
  const modern = isModernMember(member);
  return {
    ...member,
    eraCategory: modern ? 'modern' : 'ancient'
  };
}

function splitMembers(members) {
  const ancient = [];
  const modern = [];
  for (const m of members) {
    const row = classifyMember(m);
    if (row.eraCategory === 'modern') modern.push(row);
    else ancient.push(row);
  }
  return { ancient, modern, total: members.length };
}

function readAllMembers() {
  const ancient = parseMembersFile(PATHS.ancient);
  const modern = parseMembersFile(PATHS.modern);
  if (ancient.length || modern.length) {
    return [...ancient, ...modern];
  }
  return parseMembersFile(PATHS.membersAll);
}

function writeSplitFiles(members) {
  const { ancient, modern, total } = splitMembers(members);
  writeCompactJson(PATHS.ancient, ancient);
  writeCompactJson(PATHS.modern, modern);
  // 后台仍保留合并库（紧凑），便于 Excel / 脚本
  writeCompactJson(PATHS.membersAll, members.map(classifyMember));
  return { ancient: ancient.length, modern: modern.length, total };
}

function upsertInList(list, doc) {
  let idx = -1;
  if (doc._id) idx = list.findIndex((m) => m._id === doc._id);
  if (idx < 0 && doc.memberId) idx = list.findIndex((m) => m.memberId === doc.memberId);
  const row = classifyMember({ ...doc, updatedAt: new Date().toISOString() });
  if (idx >= 0) list[idx] = { ...list[idx], ...row };
  else list.push(row);
  return list;
}

function upsertMember(doc) {
  const all = readAllMembers();
  const next = upsertInList(all, doc);
  return writeSplitFiles(next);
}

function deleteMember(id) {
  const all = readAllMembers().filter((m) => m._id !== id && m.memberId !== id);
  return writeSplitFiles(all);
}

module.exports = {
  MODERN_FROM_YEAR,
  PATHS,
  WX_PATHS,
  parseMembersFile,
  writeCompactJson,
  classifyMember,
  splitMembers,
  readAllMembers,
  writeSplitFiles,
  upsertMember,
  deleteMember
};
