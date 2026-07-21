const { BRANCH_CODE_MAP, DEFAULT_PAGE_SIZE } = require('./constants');
const {
  buildSpousesFromMember,
  mergeWivesWithRemark,
  parseSpousesFromRemark,
  normalizeSpouseName
} = require('./spouseUtils');
const { ELITE_HEROES } = require('./eliteHeroes');
const { buildEducationHonorLists } = require('./educationHonor');
const { listZanyingyinSages, INTRO: SAGES_INTRO } = require('./zanyingyinHonor');
const { applyDetailDisplay, formatEducationList } = require('./memberEra');

const COLLECTION_FILES = {
  // 族人：古代 + 现代分表，均在 pkg-local 分包（民国元年 1912 为界）
  members_ancient: 'pkg-local/database/members_ancient_export.json',
  members_modern: 'pkg-local/database/members_modern_export.json',
  // 配偶等大文件同分包
  wives: 'pkg-local/database/wives_export.json',
  sons_in_law: 'pkg-local/database/sons_in_law_export.json',
  membersFallback: '',
  wivesFallback: '',
  sonsInLawFallback: '',
  dynasty_eras: 'database/dynasty_eras.json'
};

const PHOTO_STORAGE_KEY = 'member_local_photos';
const MEMBER_PATCH_KEY = 'local_member_patches';
let dynastyEras = [];

const store = {
  members: [],
  wives: [],
  sons_in_law: [],
  patriarchs: [],
  sages: [],
  elite: [],
  graduates: []
};

const indexes = {
  byId: Object.create(null),
  byOriginalId: Object.create(null),
  byFatherId: Object.create(null),
  wivesByHusbandId: Object.create(null)
};

let sortedMembers = [];
let initialized = false;
let wivesLoaded = false;
let membersLoadPromise = null;
const MEMBER_LOAD_RETRY = 3;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function readMembersFromFiles(options = {}) {
  const ancient = readJsonlFile([COLLECTION_FILES.members_ancient], options);
  const modern = readJsonlFile([COLLECTION_FILES.members_modern], options);
  if (ancient.length || modern.length) {
    return ancient.concat(modern);
  }
  return readJsonlFile([COLLECTION_FILES.membersFallback], options);
}

function finishMemberInit(start) {
  applyMemberPatches();
  loadDynastyEras();
  buildMemberIndexes();
  initialized = true;

  const photos = getLocalPhotoMap();
  Object.keys(photos).forEach(id => {
    if (indexes.byId[id]) {
      indexes.byId[id].photo = photos[id];
      indexes.byId[id].avatar = photos[id];
    }
  });

  console.log('[localDb] 族人数据就绪', {
    members: store.members.length,
    ancientModern: 'pkg-local 分表',
    eras: dynastyEras.length,
    ms: Date.now() - start
  });

  if (!wivesLoaded) {
    loadWivesAsync();
  }
}

function parseJsonl(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];
  // Support both JSON array and NDJSON (one object per line)
  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  }
  const lines = trimmed.split(/\r?\n/);
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    result.push(JSON.parse(line));
  }
  return result;
}

function readJsonlFile(filePath, options = {}) {
  const { silent = false } = options;
  const fs = wx.getFileSystemManager();
  const candidates = Array.isArray(filePath) ? filePath : [filePath];
  for (let i = 0; i < candidates.length; i++) {
    const path = candidates[i];
    if (!path) continue;
    try {
      return parseJsonl(fs.readFileSync(path, 'utf8'));
    } catch (err) {
      if (!silent) {
        console.warn('[localDb] 读取失败:', path, err.message || err);
      }
    }
  }
  return [];
}

function sortMembers(list) {
  return list.slice().sort((a, b) => {
    const genDiff = (a.generation || 0) - (b.generation || 0);
    if (genDiff !== 0) return genDiff;
    const aTime = (a.createdAt && a.createdAt.$date) || '';
    const bTime = (b.createdAt && b.createdAt.$date) || '';
    return aTime.localeCompare(bTime);
  });
}

function buildMemberIndexes() {
  indexes.byId = Object.create(null);
  indexes.byOriginalId = Object.create(null);
  indexes.byFatherId = Object.create(null);

  store.members.forEach(member => {
    indexes.byId[member._id] = member;
    if (member.originalId != null) {
      indexes.byOriginalId[String(member.originalId)] = member;
    }
    if (member.memberId) {
      indexes.byOriginalId[member.memberId] = member;
    }
    if (member.fatherId) {
      const key = String(member.fatherId);
      if (!indexes.byFatherId[key]) indexes.byFatherId[key] = [];
      indexes.byFatherId[key].push(member);
    }
  });

  sortedMembers = sortMembers(store.members);
}

function buildWivesIndex() {
  indexes.wivesByHusbandId = Object.create(null);
  store.wives.forEach(wife => {
    const key = String(wife.husbandId);
    if (!indexes.wivesByHusbandId[key]) indexes.wivesByHusbandId[key] = [];
    indexes.wivesByHusbandId[key].push(wife);
  });
}

function readSpousesFromFiles(options = {}) {
  return {
    wives: readJsonlFile([COLLECTION_FILES.wives], options),
    sons_in_law: readJsonlFile([COLLECTION_FILES.sons_in_law], options)
  };
}

function loadWivesAsync() {
  if (wivesLoaded) return;
  const finish = (ok) => {
    if (ok) wivesLoaded = true;
  };

  const applySpouseData = (data) => {
    store.wives = data.wives || [];
    store.sons_in_law = data.sons_in_law || [];
    buildWivesIndex();
    const ok = store.wives.length > 0 || store.sons_in_law.length > 0;
    finish(ok);
    console.log('[localDb] 配偶数据加载完成', {
      wives: store.wives.length,
      sons: store.sons_in_law.length
    });
  };

  loadLocalDataPackage().then((loaded) => {
    if (!loaded) {
      console.warn('[localDb] 分包未就绪，跳过配偶数据（不影响族人列表）');
      return;
    }
    try {
      applySpouseData(readSpousesFromFiles());
    } catch (e) {
      console.warn('[localDb] 配偶读取失败', e);
    }
  });
}

function loadDynastyEras() {
  try {
    const fs = wx.getFileSystemManager();
    dynastyEras = JSON.parse(fs.readFileSync(COLLECTION_FILES.dynasty_eras, 'utf8'));
  } catch (err) {
    console.warn('[localDb] 年号表加载失败', err.message || err);
    dynastyEras = [];
  }
}

function getLocalPhotoMap() {
  try {
    return wx.getStorageSync(PHOTO_STORAGE_KEY) || {};
  } catch (e) {
    return {};
  }
}

function readMemberPatches() {
  try {
    return wx.getStorageSync(MEMBER_PATCH_KEY) || { updates: {}, added: [], deleted: [] };
  } catch (e) {
    return { updates: {}, added: [], deleted: [] };
  }
}

function writeMemberPatches(patches) {
  wx.setStorageSync(MEMBER_PATCH_KEY, patches);
}

function applyMemberPatches() {
  const patches = readMemberPatches();
  const deleted = new Set(patches.deleted || []);

  store.members = store.members.filter(m => !deleted.has(m._id));

  Object.keys(patches.updates || {}).forEach(id => {
    const idx = store.members.findIndex(m => m._id === id);
    if (idx >= 0) {
      store.members[idx] = Object.assign({}, store.members[idx], patches.updates[id]);
    }
  });

  (patches.added || []).forEach(m => {
    if (deleted.has(m._id)) return;
    if (!store.members.find(x => x._id === m._id)) {
      store.members.push(m);
    }
  });
}

function setLocalPhoto(memberId, photoPath) {
  const map = getLocalPhotoMap();
  map[memberId] = photoPath;
  wx.setStorageSync(PHOTO_STORAGE_KEY, map);
  const member = indexes.byId[memberId];
  if (member) {
    member.photo = photoPath;
    member.avatar = photoPath;
  }
  const patches = readMemberPatches();
  patches.updates = patches.updates || {};
  patches.updates[memberId] = Object.assign({}, patches.updates[memberId], {
    photo: photoPath,
    avatar: photoPath
  });
  writeMemberPatches(patches);
  return true;
}

function updateMemberLocal(memberId, patch) {
  const member = indexes.byId[memberId];
  if (!member) return { success: false, message: '成员不存在' };
  Object.assign(member, patch, { updatedAt: new Date().toISOString() });
  const patches = readMemberPatches();
  patches.updates = patches.updates || {};
  const wasAdded = (patches.added || []).find(m => m._id === memberId);
  if (wasAdded) {
    Object.assign(wasAdded, patch);
  } else {
    patches.updates[memberId] = Object.assign({}, patches.updates[memberId], patch);
  }
  writeMemberPatches(patches);
  buildMemberIndexes();
  return { success: true, data: member };
}

function addMemberLocal(memberData) {
  const id = memberData._id || `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const member = Object.assign({}, memberData, {
    _id: id,
    createdAt: { $date: new Date().toISOString() },
    updatedAt: new Date().toISOString()
  });
  store.members.push(member);
  const patches = readMemberPatches();
  patches.added = patches.added || [];
  patches.added.push(member);
  writeMemberPatches(patches);
  buildMemberIndexes();
  return { success: true, data: { _id: id }, member };
}

function deleteMemberLocal(memberId) {
  const idx = store.members.findIndex(m => m._id === memberId);
  if (idx < 0) return { success: false, message: '成员不存在' };
  store.members.splice(idx, 1);
  const patches = readMemberPatches();
  patches.deleted = patches.deleted || [];
  if (patches.deleted.indexOf(memberId) < 0) patches.deleted.push(memberId);
  patches.added = (patches.added || []).filter(m => m._id !== memberId);
  if (patches.updates) delete patches.updates[memberId];
  writeMemberPatches(patches);
  buildMemberIndexes();
  return { success: true };
}

function nextLocalOriginalId() {
  let max = 0;
  store.members.forEach(m => {
    const n = Number(m.originalId);
    if (!isNaN(n) && n > max) max = n;
  });
  return max + 1;
}

function loadLocalDataPackage() {
  return new Promise((resolve) => {
    if (!wx.loadSubpackage) {
      resolve(true);
      return;
    }
    wx.loadSubpackage({
      name: 'pkg-local',
      success: () => resolve(true),
      fail: (err) => {
        console.warn('[localDb] pkg-local 分包加载失败', err);
        resolve(false);
      }
    });
  });
}

async function loadMembersWithRetry() {
  let lastOk = false;
  for (let i = 1; i <= MEMBER_LOAD_RETRY; i++) {
    const loaded = await loadLocalDataPackage();
    lastOk = loaded;

    const list = readMembersFromFiles({ silent: true });
    if (list.length) {
      store.members = list;
      return { ok: true, tries: i, loaded };
    }

    console.warn(`[localDb] 第 ${i} 次读取族人分表为空，准备重试`);
    if (i < MEMBER_LOAD_RETRY) await sleep(300 * i);
  }
  return { ok: false, tries: MEMBER_LOAD_RETRY, loaded: lastOk };
}

function init() {
  if (initialized && store.members.length) return store;

  // pkg-local 须先 loadSubpackage，启动时同步读必然失败，直接走异步
  if (!membersLoadPromise) {
    membersLoadPromise = initAsync().catch((err) => {
      console.warn('[localDb] 族人分包加载失败', err);
      membersLoadPromise = null;
    });
  }
  return store;
}

async function initAsync() {
  if (initialized && store.members.length) return store;

  const start = Date.now();
  const state = await loadMembersWithRetry();
  if (!state.ok || !store.members.length) {
    membersLoadPromise = null;
    const msg = '分包内未读到族人数据，请确认 pkg-local/database/members_*_export.json 已随真机包下发';
    console.warn('[localDb] ' + msg, state);
    throw new Error(msg);
  }
  finishMemberInit(start);
  return store;
}

function ensureMembersLoaded() {
  if (initialized && store.members.length) return Promise.resolve(store);
  if (!membersLoadPromise) membersLoadPromise = initAsync();
  return membersLoadPromise;
}

function ensureWivesLoaded() {
  if (!wivesLoaded) loadWivesAsync();
}

function getStats() {
  return {
    members: store.members.length,
    wives: store.wives.length,
    sons_in_law: store.sons_in_law.length
  };
}

function getCollection(name) {
  return store[name] || [];
}

function findById(collectionName, id) {
  if (collectionName === 'members') return indexes.byId[id] || null;
  return getCollection(collectionName).find(item => item._id === id) || null;
}

function findMemberByOriginalId(originalId) {
  if (originalId == null || originalId === '') return null;
  return indexes.byOriginalId[String(originalId)] || null;
}

const { withClanSurname } = require('./clanName');

/** 验证用全名：须以「罗」开头；未带姓返回 null；空串返回 '' */
function normalizeFullName(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (!raw.startsWith('罗')) return null;
  const full = withClanSurname(raw);
  return full && full.length > 1 ? full : null;
}

function normalizePersonName(input) {
  return withClanSurname(input);
}

function findMembersByName(name) {
  const n = normalizeFullName(name);
  if (!n) return [];
  return store.members.filter(m => withClanSurname(m.name) === n);
}

function getFatherDisplayName(member) {
  if (!member) return '';
  if (member.fatherName) return withClanSurname(member.fatherName);
  if (member.fatherId === '' || member.fatherId == null) return '';
  const father = findMemberByOriginalId(member.fatherId);
  return father ? withClanSurname(father.name) : '';
}

function hasFullLunarBirth(member) {
  const lunar = member && member.birthDate && member.birthDate.lunar;
  return !!(lunar && lunar.year && lunar.month && lunar.day);
}

function matchLunarBirth(member, year, month, day) {
  const lunar = member && member.birthDate && member.birthDate.lunar;
  if (!lunar) return false;
  return Number(lunar.year) === Number(year)
    && Number(lunar.month) === Number(month)
    && Number(lunar.day) === Number(day);
}

function matchWhere(item, where) {
  return Object.keys(where).every(key => item[key] === where[key]);
}

function filterCollection(collectionName, where = {}) {
  const list = getCollection(collectionName);
  if (!Object.keys(where).length) return list.slice();
  return list.filter(item => matchWhere(item, where));
}

function countCollection(collectionName, where = {}) {
  return filterCollection(collectionName, where).length;
}

function filterSortedMembers(params = {}) {
  const { branch, generation } = params;
  if (!branch && !generation) return sortedMembers;

  return sortedMembers.filter(item => {
    if (generation && item.generation !== generation) return false;
    if (branch && item.branch !== branch) return false;
    return true;
  });
}

function toListItem(member) {
  let fatherName = member.fatherName || '';
  if (!fatherName && member.fatherId) {
    const father = findMemberByOriginalId(member.fatherId);
    if (father) fatherName = father.name;
  }

  const item = {
    _id: member._id,
    name: member.name,
    generation: member.generation,
    branch: member.branch,
    branchCode: BRANCH_CODE_MAP[member.branch] || 'zhonghe',
    gender: member.gender,
    hasBrokenLineage: !!member.hasBrokenLineage,
    fatherName
  };

  if (member.birthDate && member.birthDate.lunar && member.birthDate.lunar.year) {
    item.birthYear = member.birthDate.lunar.year;
  }

  return item;
}

function formatDate(dateObj) {
  if (!dateObj) return '';
  if (typeof dateObj === 'string') return dateObj;
  if (dateObj.formatted) return dateObj.formatted;
  if (dateObj.lunar && dateObj.lunar.year) {
    return `${dateObj.lunar.year}年`;
  }
  if (dateObj.gregorian && dateObj.gregorian.year) {
    return `${dateObj.gregorian.year}年`;
  }
  return '';
}

function formatPositions(positions) {
  if (!positions || !positions.length) return '';
  return positions.map(p => (typeof p === 'string' ? p : p.title || '')).filter(Boolean).join('、');
}

function formatEducation(education) {
  if (!education || !education.length) return '';
  return education.map(e => (typeof e === 'string' ? e : e.degree || e.school || '')).filter(Boolean).join('、');
}

function getMembers(params = {}) {
  if (!store.members.length) {
    ensureMembersLoaded();
  }
  const page = Math.max(1, params.page || 1);
  const pageSize = params.pageSize || DEFAULT_PAGE_SIZE;
  const filtered = filterSortedMembers(params);
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  return {
    success: true,
    data: slice.map(toListItem),
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total
  };
}

function getMemberDetail(id) {
  if (!store.members.length) {
    ensureMembersLoaded();
  }
  ensureWivesLoaded();

  const member = findById('members', id);
  if (!member) {
    return { success: false, message: '成员不存在' };
  }

  const detail = Object.assign({}, member);
  detail.branchCode = BRANCH_CODE_MAP[detail.branch] || 'zhonghe';

  const memberOriginalId = detail.originalId != null
    ? String(detail.originalId)
    : (detail.memberId ? detail.memberId.replace(/^M0+/, '') : '');

  let wives = (indexes.wivesByHusbandId[memberOriginalId] || []).map(wife => ({
    _id: wife._id,
    wifeId: wife.wifeId || wife._id,
    name: wife.name,
    maidenName: wife.maidenName,
    hometown: wife.hometown || '',
    marriageType: wife.marriageType,
    marriageOrder: wife.marriageOrder,
    burialPlace: wife.burialPlace,
    remark: wife.remark,
    birthDate: wife.birthDate,
    deathDate: wife.deathDate
  }));

  wives = mergeWivesWithRemark(wives, detail);
  if (!wives.length) {
    wives = buildSpousesFromMember(detail);
  }

  detail.wives = wives;
  detail.wifeIds = Array.isArray(member.wifeIds) && member.wifeIds.length
    ? member.wifeIds.slice()
    : wives.map(w => w.wifeId || w._id).filter(Boolean);
  if (wives.length) {
    detail.spouseName = wives[0].name;
    detail.spouseInfo = wives.map(w => ({
      name: w.name,
      type: w.marriageType,
      hometown: w.hometown || '',
      wifeId: w.wifeId || w._id || ''
    }));
  }

  // 本村配偶：clanSpouseId / linkedMemberId / 落在族人表的 spouseId（非 …W\d+ / …S\d+ 外姓妻婿 ID）
  function resolveClanSpouseKey(m) {
    if (m.clanSpouseId) return String(m.clanSpouseId).trim();
    const infos = Array.isArray(m.spouseInfo) ? m.spouseInfo : [];
    const linked = infos.find(s => s && (s.isSameVillage || s.linkedMemberId) && s.linkedMemberId);
    if (linked && linked.linkedMemberId) return String(linked.linkedMemberId).trim();
    const sid = String(m.spouseId || '').trim();
    if (!sid) return '';
    if (/[WS]\d+$/i.test(sid)) return ''; // 外姓妻/婿业务 ID
    if (findMemberByOriginalId(sid)) return sid;
    return '';
  }
  const clanSpouseKey = resolveClanSpouseKey(member);
  if (clanSpouseKey) {
    const clanSpouse = findMemberByOriginalId(clanSpouseKey);
    if (clanSpouse) {
      detail.spouseName = clanSpouse.name;
      detail.spouseMemberDocId = clanSpouse._id;
      const clanEntry = {
        name: clanSpouse.name,
        memberDocId: clanSpouse._id,
        isClanSpouse: true,
        hometown: '本村',
        marriageType: '配',
        marriageOrder: 1
      };
      if (detail.gender === '女' || clanSpouse.gender === '男') {
        detail.husbands = [Object.assign({ _id: clanSpouse._id }, clanEntry)];
      } else {
        const idx = detail.wives.findIndex(w =>
          w.name === clanSpouse.name || (w.hometown && String(w.hometown).includes('本村'))
        );
        if (idx >= 0) detail.wives[idx] = Object.assign({}, detail.wives[idx], clanEntry);
        else detail.wives.unshift(clanEntry);
      }
    }
  }

  const children = indexes.byFatherId[memberOriginalId] || [];
  detail.children = children
    .filter(child => child && child._id)
    .map(child => ({
      _id: child._id,
      name: child.name,
      gender: child.gender,
      generation: child.generation
    }));

  if (detail.fatherId) {
    const father = findMemberByOriginalId(detail.fatherId);
    detail.fatherName = father ? father.name : '';
    detail.fatherDocId = father ? father._id : '';
    detail.fatherId = detail.fatherDocId;

    // motherId 误等于 fatherId 时清空；wifeId（W…）保留
    const rawMotherId = member.motherId != null ? String(member.motherId) : '';
    if (rawMotherId && rawMotherId === String(member.fatherId || '')) {
      detail.motherId = '';
    } else {
      detail.motherId = rawMotherId;
    }

    const fatherSpouses = father ? parseSpousesFromRemark(father.remark || '') : [];
    if (!detail.motherName) {
      if (fatherSpouses.length) {
        detail.motherName = fatherSpouses[0].name;
      } else if (father && father.spouseName) {
        detail.motherName = normalizeSpouseName(father.spouseName);
      }
    }
    if (detail.motherName && father && detail.motherName === father.name) {
      detail.motherName = '';
    }

    const fatherWives = (father && father.originalId != null)
      ? (indexes.wivesByHusbandId[String(father.originalId)] || [])
      : [];
    let motherWife = null;
    if (detail.motherId) {
      motherWife = fatherWives.find(w =>
        String(w.wifeId || w._id) === String(detail.motherId)
      ) || findById('wives', detail.motherId);
    }
    if (!motherWife && detail.motherName) {
      motherWife = fatherWives.find(w =>
        normalizeSpouseName(w.name) === normalizeSpouseName(detail.motherName)
      ) || null;
    }
    detail.motherWifeId = motherWife ? (motherWife.wifeId || motherWife._id) : '';
    if (motherWife && !detail.motherId) {
      detail.motherId = motherWife.wifeId || motherWife._id;
    }
    if (motherWife && !detail.motherName) {
      detail.motherName = motherWife.name || '';
    }
  }

  // 亲人姓名：仅保留可跳转的真链接；无可跳转 ID 则姓名留空
  if (!detail.fatherId) {
    detail.fatherName = '';
  }
  if (!detail.motherWifeId && !detail.motherId) {
    detail.motherName = '';
  }

  detail.wives = (detail.wives || [])
    .filter(w => {
      if (!w || !w.name) return false;
      if (w.memberDocId && findById('members', w.memberDocId)) return true;
      if (w._id && findById('wives', w._id)) return true;
      return false;
    })
    .map(w => Object.assign({}, w, {
      linkType: w.memberDocId ? 'member' : 'wife',
      linkId: w.memberDocId || w._id
    }));

  detail.husbands = (detail.husbands || [])
    .filter(h => {
      if (!h || !h.name) return false;
      const mid = h.memberDocId || h._id;
      return mid && findById('members', mid);
    })
    .map(h => Object.assign({}, h, {
      memberDocId: h.memberDocId || h._id,
      linkType: 'member',
      linkId: h.memberDocId || h._id
    }));

  if (detail.spouseMemberDocId && findById('members', detail.spouseMemberDocId)) {
    detail.spouseLinkId = detail.spouseMemberDocId;
  } else {
    detail.spouseMemberDocId = '';
    detail.spouseLinkId = '';
  }

  if (detail.wives.length) {
    detail.spouseName = detail.wives[0].name;
    detail.spouseInfo = detail.wives.map(w => ({
      name: w.name,
      type: w.marriageType,
      hometown: w.hometown || '',
      memberDocId: w.memberDocId || '',
      wifeId: w.memberDocId ? '' : (w._id || ''),
      linkType: w.linkType,
      linkId: w.linkId
    }));
  } else if (!detail.spouseMemberDocId) {
    detail.spouseName = '';
    detail.spouseInfo = [];
  }

  // 女婿：仅女性族人；本村人可跳转族人详情
  detail.sonsInLaw = [];
  if (String(detail.gender || '') === '女') {
    ensureWivesLoaded();
    const wifeKey = detail.originalId != null && String(detail.originalId) !== ''
      ? String(detail.originalId)
      : String(detail.memberId || '');
    const fromTable = (store.sons_in_law || []).filter(s => String(s.wifeId || '') === wifeKey);
    const ids = Array.isArray(detail.sonInLawIds) ? detail.sonInLawIds : [];
    const list = fromTable.length
      ? fromTable
      : ids.map(id => findById('sons_in_law', id) || { _id: id, name: '', wifeId: wifeKey });
    detail.sonsInLaw = list.map(s => {
      const linked = s.linkedMemberId || (s.isSameVillage ? (s.sonInLawId || s._id) : '');
      const mem = linked
        ? (findMemberByOriginalId(linked) || findById('members', linked))
        : null;
      return {
        name: s.name || '',
        _id: s._id || s.sonInLawId || '',
        hometown: s.hometown || '',
        isSameVillage: !!s.isSameVillage,
        linkType: mem ? 'member' : '',
        linkId: mem ? mem._id : ''
      };
    }).filter(s => s.name);
  }

  const display = applyDetailDisplay(detail, { eras: dynastyEras });
  display.positionsStr = formatPositions(display.positions);
  display.educationStr = (display.educationList || formatEducationList(display.education) || [])
    .map(e => (typeof e === 'string' ? e : e.display || e.degree))
    .filter(Boolean)
    .join('；');
  display.honorsStr = (display.honorsList || []).join('；');
  display.workplacesStr = (display.workplaceList || []).join('；');

  return { success: true, data: display };
}

function getFamilyTree(params = {}) {
  const { branch } = params;
  if (!branch) {
    return {
      success: true,
      data: {
        mode: 'hub',
        halls: ['中和堂', '明儒堂', '德裕堂', '忠爱堂'].map(name => {
          const list = store.members.filter(m => m.branch === name);
          const gens = list.map(m => m.generation || 0);
          return {
            branch: name,
            total: list.length,
            minGen: gens.length ? Math.min(...gens) : 0,
            maxGen: gens.length ? Math.max(...gens) : 0
          };
        })
      }
    };
  }

  const list = store.members.filter(m => m.branch === branch);
  // 附带可能被引用的脏 branch 父辈，供布局衔接
  const byOrig = indexes.byOriginalId;
  const extra = [];
  const seen = Object.create(null);
  list.forEach(m => { seen[m._id] = true; });
  list.forEach(m => {
    if (m.fatherId === '' || m.fatherId == null) return;
    const f = byOrig[String(m.fatherId)];
    if (!f || seen[f._id]) return;
    if (f.branch === branch) return;
    if (/^\d+$/.test(String(f.branch || ''))) {
      seen[f._id] = true;
      extra.push(f);
    }
  });

  const members = list.concat(extra).map(item => ({
    _id: item._id,
    name: item.name,
    originalId: item.originalId,
    memberId: item.memberId,
    generation: item.generation,
    branch: item.branch,
    fatherId: item.fatherId || '',
    fatherName: item.fatherName || '',
    gender: item.gender || '',
    hasBrokenLineage: !!item.hasBrokenLineage
  }));

  return {
    success: true,
    data: {
      mode: 'chart',
      branch,
      members,
      total: list.length
    }
  };
}

function handleAdminApi(event = {}) {
  const { action, data = {}, dynasty, year, branch, page = 1, pageSize = 50, achievementType } = event;

  switch (action) {
    case 'getFamilyTree':
      return getFamilyTree({ branch: branch || event.branch || null });
    case 'listPatriarchs': {
      let list = filterCollection('patriarchs', branch ? { branch } : {});
      if (!list.length) {
        list = store.members
          .filter(item => item.generation === 1)
          .filter(item => !branch || item.branch === branch)
          .map(item => ({
            _id: item._id,
            name: item.name,
            generation: item.generation,
            branch: item.branch,
            remark: item.remark
          }));
      }
      return { success: true, data: list };
    }
    case 'listSages': {
      // 家族乡贤榜：簪缨引（官职事迹；学历相关已分置学历榜）
      const all = listZanyingyinSages(dynasty || null);
      const list = all.slice((page - 1) * pageSize, page * pageSize);
      return {
        success: true,
        data: list,
        total: all.length,
        intro: SAGES_INTRO
      };
    }
    case 'listElite': {
      // 建国后群英榜：当今族人撷英（固定七人）
      const list = ELITE_HEROES.map(item => ({
        _id: item.id,
        id: item.id,
        name: item.name,
        generation: item.generation,
        branch: item.branch,
        birthYear: item.birthYear,
        summary: item.summary,
        icon: '⭐'
      }));
      return { success: true, data: list, total: list.length };
    }
    case 'listEducationHonor': {
      const candidates = store.members.filter(item =>
        (item.education && item.education.length) ||
        (item.remark && String(item.remark).trim())
      );
      const data = buildEducationHonorLists(candidates);
      return {
        success: true,
        data,
        total: {
          imperial: data.imperial.length,
          republican: data.republican.length,
          modern: data.modern.length
        }
      };
    }
    case 'listGraduates': {
      let list = filterCollection('graduates', year ? { year } : {});
      if (!list.length) {
        list = store.members
          .filter(item => item.education && item.education.length)
          .filter(item => !year || item.education.some(edu => String(edu.year) === String(year)))
          .slice((page - 1) * pageSize, page * pageSize)
          .map(item => ({
            _id: item._id,
            name: item.name,
            generation: item.generation,
            branch: item.branch,
            education: item.education
          }));
      }
      return { success: true, data: list };
    }
    case 'getGraduatesByYear': {
      const years = new Set();
      store.members.forEach(item => {
        (item.education || []).forEach(edu => {
          if (edu.year) years.add(String(edu.year));
        });
      });
      return { success: true, data: { years: Array.from(years).sort((a, b) => b - a) } };
    }
    case 'getWife': {
      ensureWivesLoaded();
      const wifeId = (data.data && data.data._id) || data._id;
      const wife = findById('wives', wifeId);
      return wife ? { success: true, data: wife } : { success: false, message: '配偶不存在' };
    }
    case 'get':
    case 'getMemberByOriginalId': {
      const memberId = (data.data && data.data._id) || data._id;
      const originalId = (data.data && data.data.originalId) || data.originalId;
      const member = memberId
        ? findById('members', memberId)
        : findMemberByOriginalId(originalId);
      return member ? { success: true, data: member } : { success: false, message: '成员不存在' };
    }
    case 'getCount':
      return { success: true, count: store.members.length };
    case 'updateMemberPhoto': {
      const memberId = (data.data && data.data.id) || data.id;
      const photo = (data.data && data.data.photo) || data.photo;
      if (!memberId || !photo) {
        return { success: false, message: '缺少相片参数' };
      }
      setLocalPhoto(memberId, photo);
      return { success: true, data: { photo } };
    }
    default:
      return { success: false, message: `本地模式暂不支持操作: ${action}` };
  }
}

module.exports = {
  init,
  initAsync,
  ensureMembersLoaded,
  loadLocalDataPackage,
  getStats,
  getCollection,
  findById,
  findMemberByOriginalId,
  findMembersByName,
  getFatherDisplayName,
  hasFullLunarBirth,
  matchLunarBirth,
  normalizePersonName,
  normalizeFullName,
  filterCollection,
  countCollection,
  getMembers,
  getMemberDetail,
  getFamilyTree,
  handleAdminApi,
  setLocalPhoto,
  updateMemberLocal,
  addMemberLocal,
  deleteMemberLocal,
  nextLocalOriginalId,
  indexes,
  store
};
