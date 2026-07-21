// 管理员 API 云函数
// 支持 HTTP 触发，用于 Web 后台直接访问

const cloud = require('wx-server-sdk');
const { buildEducationHonorLists } = require('./educationHonor');
const { listZanyingyinSages, INTRO: SAGES_INTRO } = require('./zanyingyinHonor');
const { ELITE_HEROES } = require('./eliteHeroes');
const { withClanSurname } = require('./clanName');
const {
  parseSpousesFromRemark,
  spousesToSpouseInfo,
  normalizeSpouseName,
  linkSameVillageSpouses
} = require('./spouseParser');

function looksLikeWifeName(name) {
  const n = String(name || '').trim();
  return !n || n.includes('氏');
}

/** 族人姓名冠「罗」，不产生「罗罗」；外姓（含氏）不加 */
function clanifyPersonName(name) {
  const n = String(name || '').trim();
  if (!n || looksLikeWifeName(n)) return n;
  return withClanSurname(n);
}

function clanifyMemberRow(m) {
  if (!m) return m;
  const next = Object.assign({}, m);
  if (next.name) next.name = clanifyPersonName(next.name);
  if (next.fatherName) next.fatherName = clanifyPersonName(next.fatherName);
  if (next.motherName && !looksLikeWifeName(next.motherName)) {
    next.motherName = clanifyPersonName(next.motherName);
  }
  return next;
}

/** 荣誉榜写入前清洗：去掉云库禁止/只读字段，避免 add/update 静默失败 */
function sanitizeHonorWrite(data) {
  const skip = new Set([
    '_id', '_openid', 'createdAt', 'updatedAt',
    'hasLink', 'paragraphs', 'titles', 'titleText', 'educations', 'birthText', 'dynastyEra',
    'gongming', 'guanzhi', 'educationRaw', 'linkedMember'
  ]);
  const out = {};
  if (!data || typeof data !== 'object') return out;
  for (const [k, v] of Object.entries(data)) {
    if (skip.has(k)) continue;
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

/** 各榜允许写入的字段（薄表：关联 + 荣誉特有；name 等作未关联兜底） */
const HONOR_WRITE_FIELDS = {
  patriarchs: [
    'memberDocId', 'originalId', 'title', 'branchTitle', 'sortOrder', 'achievements',
    'name', 'generation', 'branch', 'originRegion'
  ],
  sages: [
    'memberDocId', 'originalId', 'achievements', 'dynasty', 'eraName',
    'name', 'generation', 'birthYear', 'deathYear', 'sourceId'
  ],
  elite: [
    'memberDocId', 'originalId', 'heroId', 'summary', 'biography', 'achievementType',
    'sortOrder', 'position', 'organization', 'level', 'isAlive',
    'name', 'generation', 'branch', 'birthYear'
  ]
};

function pickHonorWriteFields(data, collection) {
  const allowed = new Set(HONOR_WRITE_FIELDS[collection] || []);
  const raw = sanitizeHonorWrite(data);
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

function getMemberBirthYear(member) {
  const y = member && member.birthDate && member.birthDate.gregorian
    ? member.birthDate.gregorian.year
    : null;
  return y != null && y !== '' ? Number(y) : null;
}

function getMemberGuanzhi(member) {
  if (!member) return '';
  if (member.guanzhi) return String(member.guanzhi);
  if (Array.isArray(member.positions) && member.positions.length) {
    return member.positions
      .map(p => (typeof p === 'string' ? p : (p.title || '')))
      .filter(Boolean)
      .join('；');
  }
  return '';
}

/** 根据 memberDocId / originalId / 旧 memberId 批量拉取族人 */
async function fetchMembersForHonorRows(rows) {
  const byDocId = new Map();
  const byOriginal = new Map();
  const docIds = [];
  const originalIds = [];

  for (const row of rows || []) {
    const docId = row.memberDocId || '';
    const oid = row.originalId || row.memberId || '';
    // 旧种子把 M#### 写在 memberDocId 上
    const maybeOid = docId && /^[MC]\d+/i.test(String(docId)) ? String(docId) : '';
    if (docId && !maybeOid) docIds.push(String(docId));
    if (oid) originalIds.push(String(oid));
    if (maybeOid) originalIds.push(maybeOid);
  }

  const uniqDoc = [...new Set(docIds.filter(Boolean))];
  for (const id of uniqDoc) {
    try {
      const res = await db.collection('members').doc(id).get();
      if (res && res.data) {
        byDocId.set(id, res.data);
        const o = res.data.originalId || res.data.memberId;
        if (o) byOriginal.set(String(o), res.data);
      }
    } catch (_) { /* ignore */ }
  }

  const uniqOid = [...new Set(originalIds.filter(Boolean))];
  const _ = db.command;
  for (let i = 0; i < uniqOid.length; i += 20) {
    const chunk = uniqOid.slice(i, i + 20);
    try {
      const res = await db.collection('members')
        .where({ originalId: _.in(chunk) })
        .limit(100)
        .get();
      for (const m of res.data || []) {
        const o = m.originalId || m.memberId;
        if (o) byOriginal.set(String(o), m);
        if (m._id) byDocId.set(String(m._id), m);
      }
    } catch (_) {
      try {
        const res2 = await db.collection('members')
          .where({ memberId: _.in(chunk) })
          .limit(100)
          .get();
        for (const m of res2.data || []) {
          const o = m.originalId || m.memberId;
          if (o) byOriginal.set(String(o), m);
          if (m._id) byDocId.set(String(m._id), m);
        }
      } catch (e2) { /* ignore */ }
    }
  }

  return { byDocId, byOriginal };
}

function resolveMemberForHonorRow(row, maps) {
  if (!row || !maps) return null;
  const docId = row.memberDocId ? String(row.memberDocId) : '';
  if (docId && maps.byDocId.has(docId)) return maps.byDocId.get(docId);
  const oid = String(row.originalId || row.memberId || '');
  if (oid && maps.byOriginal.has(oid)) return maps.byOriginal.get(oid);
  if (docId && maps.byOriginal.has(docId)) return maps.byOriginal.get(docId);
  return null;
}

/** 用族人资料覆盖荣誉行基础字段；成就/小传等荣誉特有字段保留 */
function hydrateHonorFromMember(row, member) {
  const out = Object.assign({}, row);
  if (!member) {
    if (out.name) out.name = clanifyPersonName(out.name);
    out.hasLink = !!(out.memberDocId || out.originalId || out.memberId);
    // 乡贤成就空时不硬造
    return out;
  }
  out.memberDocId = member._id ? String(member._id) : (out.memberDocId || '');
  out.originalId = member.originalId || member.memberId || out.originalId || '';
  out.name = clanifyPersonName(member.name || out.name || '');
  if (member.generation != null && member.generation !== '') out.generation = member.generation;
  if (member.branch) out.branch = member.branch;
  const by = getMemberBirthYear(member);
  if (by != null) out.birthYear = by;
  out.gongming = member.gongming || '';
  out.guanzhi = getMemberGuanzhi(member);
  // 乡贤：成就优先荣誉表，空则用功名
  if (!out.achievements && out.gongming) out.achievements = out.gongming;
  out.hasLink = !!out.memberDocId;
  out.linkedMember = {
    _id: out.memberDocId,
    originalId: out.originalId,
    name: out.name,
    generation: out.generation,
    branch: out.branch
  };
  return out;
}

async function hydrateHonorList(rows) {
  const list = rows || [];
  if (!list.length) return [];
  const maps = await fetchMembersForHonorRows(list);
  return list.map(row => hydrateHonorFromMember(row, resolveMemberForHonorRow(row, maps)));
}

/** 写入前：若有 memberDocId，自动补 originalId，并可选同步兜底 name */
async function enrichHonorLinkFields(payload) {
  const out = Object.assign({}, payload);
  if (out.memberDocId) {
    try {
      const res = await db.collection('members').doc(String(out.memberDocId)).get();
      const m = res && res.data;
      if (m) {
        out.originalId = m.originalId || m.memberId || out.originalId || '';
        if (!out.name && m.name) out.name = clanifyPersonName(m.name);
        if (out.generation == null && m.generation != null) out.generation = m.generation;
        if (!out.branch && m.branch) out.branch = m.branch;
      }
    } catch (_) { /* ignore */ }
  } else if (out.originalId || out.memberId) {
    const oid = String(out.originalId || out.memberId);
    out.originalId = oid;
    try {
      const res = await db.collection('members').where({ originalId: oid }).limit(1).get();
      const m = (res.data && res.data[0]) || null;
      if (m) {
        out.memberDocId = String(m._id);
        if (!out.name && m.name) out.name = clanifyPersonName(m.name);
        if (out.generation == null && m.generation != null) out.generation = m.generation;
        if (!out.branch && m.branch) out.branch = m.branch;
      }
    } catch (_) { /* ignore */ }
  }
  delete out.memberId;
  return out;
}

function docIdFromAddResult(result) {
  return (result && (result._id || result.id)) || '';
}

function isCollectionMissingError(err) {
  const msg = String((err && (err.message || err.errMsg || err)) || '');
  const code = err && (err.errCode || err.code);
  return (
    code === -502005 ||
    code === 'DATABASE_COLLECTION_NOT_EXIST' ||
    /collection not exists|Db or Table not exist|DATABASE_COLLECTION_NOT_EXIST|-502005/i.test(msg)
  );
}

/** 确保荣誉相关集合存在（云库未建表时 count/get 会报 -502005） */
async function ensureCollection(name) {
  try {
    await db.createCollection(name);
    console.log('已创建集合:', name);
    return true;
  } catch (e) {
    // 已存在或其他可忽略错误
    if (!isCollectionMissingError(e)) {
      console.log('createCollection', name, e.message || e);
    }
    return false;
  }
}

async function ensureHonorCollections() {
  for (const col of ['patriarchs', 'sages', 'elite', 'graduates']) {
    await ensureCollection(col);
  }
}

async function safeCollectionCount(collectionName, where = null) {
  try {
    let query = db.collection(collectionName);
    if (where && Object.keys(where).length) query = query.where(where);
    const res = await query.count();
    return res.total || 0;
  } catch (err) {
    if (isCollectionMissingError(err)) {
      await ensureCollection(collectionName);
      return 0;
    }
    throw err;
  }
}

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 主入口函数
exports.main = async (event, context) => {
  // 腾讯云 HTTP 触发的 event 结构
  // {
  //   httpMethod: 'POST',
  //   headers: {...},
  //   body: '{"action":"list",...}',  // JSON 字符串
  //   queryStringParameters: {...}
  // }
  
  console.log('HTTP 方法:', event.httpMethod);
  console.log('Headers:', JSON.stringify(event.headers));
  console.log('Body 原始:', event.body);
  
  let params = {};
  
  // 处理 POST 请求
  if (event.httpMethod === 'POST') {
    try {
      params = JSON.parse(event.body || '{}');
    } catch (e) {
      console.error('解析 body 失败:', e);
      params = {};
    }
  }
  // 处理 GET 请求
  else if (event.httpMethod === 'GET') {
    params = event.queryStringParameters || {};
  }
  // 云函数直接调用
  else {
    params = event;
  }
  
  console.log('解析后的 params:', JSON.stringify(params));
  
  const action = params.action;
  const paramsData = params.data;
  const members = params.members;
  
  try {
    switch (action) {
      case 'list':
        return await listMembers(params);
      case 'get':
        return await getMember(paramsData);
      case 'create':
        return await createMember(paramsData);
      case 'update':
        return await updateMember(paramsData);
      case 'delete':
        return await deleteMember(paramsData);
      case 'batchImport':
        return await batchImportMembers(members);
      case 'clearAll':
        return await clearAllMembers();
      case 'getCount':
        return await getMembersCount();
      case 'batchUpdateDetails':
        return await batchUpdateDetails(params);
      case 'updateByName':
        return await updateMemberByName(paramsData);
      case 'updateSpouseInfo':
        return await updateSpouseInfoAction(params);
      case 'testSpouseInfo':
        return await testSpouseInfoAction(params);
      // 媳妇相关操作
      case 'listWives':
        return await listWives(params);
      case 'getWife':
        return await getWife(paramsData);
      case 'createWife':
        return await createWife(paramsData);
      case 'updateWife':
        return await updateWife(paramsData);
      case 'deleteWife':
        return await deleteWife(paramsData);
      // 女婿相关操作
      case 'listSonsInLaw':
        return await listSonsInLaw(params);
      case 'getSonInLaw':
        return await getSonInLaw(paramsData);
      case 'createSonInLaw':
        return await createSonInLaw(paramsData);
      case 'updateSonInLaw':
        return await updateSonInLaw(paramsData);
      case 'deleteSonInLaw':
        return await deleteSonInLaw(paramsData);
      // 族长相关操作
      case 'listPatriarchs':
        return await listPatriarchs(params);
      case 'getPatriarch':
        return await getPatriarch(paramsData);
      case 'createPatriarch':
        return await createPatriarch(paramsData);
      case 'updatePatriarch':
        return await updatePatriarch(paramsData);
      case 'deletePatriarch':
        return await deletePatriarch(paramsData);
      // 乡贤相关操作
      case 'listSages':
        return await listSages(params);
      case 'getSage':
        return await getSage(paramsData);
      case 'createSage':
        return await createSage(paramsData);
      case 'updateSage':
        return await updateSage(paramsData);
      case 'deleteSage':
        return await deleteSage(paramsData);
      // 群英相关操作
      case 'listElite':
        return await listElite(params);
      case 'getElite':
        return await getElite(paramsData);
      case 'createElite':
        return await createElite(paramsData);
      case 'updateElite':
        return await updateElite(paramsData);
      case 'deleteElite':
        return await deleteElite(paramsData);
      case 'resetEliteHeroes':
        return await resetEliteHeroes();
      case 'migrateHonorMemberLinks':
        return await migrateHonorMemberLinks(params);
      // 学历榜相关操作
      case 'listEducationHonor':
        return await listEducationHonor(params);
      case 'listGraduates':
        return await listGraduates(params);
      case 'getGraduate':
        return await getGraduate(paramsData);
      case 'createGraduate':
        return await createGraduate(paramsData);
      case 'updateGraduate':
        return await updateGraduate(paramsData);
      case 'deleteGraduate':
        return await deleteGraduate(paramsData);
      case 'getGraduatesByYear':
        return await getGraduatesByYear(params);
      // 谱树
      case 'getFamilyTree':
        return await getFamilyTree(params);
      // 荣誉榜初始化
      case 'initHonorData':
        return await initHonorData(params);
      // 补充媳妇和女婿ID
      case 'fixSpouseIds':
        return await fixSpouseIds(params);
      case 'fixWives':
        return await fixSpouseIds({ action: 'fixWives' });
      case 'fixSonsInLaw':
        return await fixSpouseIds({ action: 'fixSonsInLaw' });
      case 'repairSpouseFromRemark':
        return await repairSpouseFromRemark(params);
      // 去重
      case 'dedupeWives':
        return await dedupeWives();
      case 'dedupeSonsInLaw':
        return await dedupeSonsInLaw();
      case 'debugWifeFields':
        return await debugWifeFields();
      case 'debugSonFields':
        return await debugSonFields();
      case 'debugWifeDuplicates':
        return await debugWifeDuplicates();
      case 'deleteWifesWithoutId':
        return await deleteWifesWithoutId();
      case 'deleteSonsWithoutId':
        return await deleteSonsWithoutId();
      case 'getRecordsWithoutId':
        return await getRecordsWithoutId();
      case 'cleanAllWithoutId':
        return await cleanAllWithoutId();
      case 'fixMemberIds':
        return await fixMemberIds();
      case 'fixClanSurnames':
        return await fixClanSurnames(params);
      case 'fixWifesSpouseId':
        return await fixWifesSpouseId();
      case 'fixSonsSpouseId':
        return await fixSonsSpouseId();
      case 'debugMember':
        return await debugMember(params);
      // 运营：登录账号 / 开发者留言
      case 'listAccounts':
        return await listAccounts(params);
      case 'forceUnbindAccount':
        return await forceUnbindAccount(paramsData || params);
      case 'listDevMessages':
        return await listDevMessages(params);
      case 'markDevMessageRead':
        return await markDevMessageRead(paramsData || params);
      case 'getOpsStats':
        return await getOpsStats();
      default:
        return { success: false, message: '未知操作' };
    }
  } catch (err) {
    console.error('操作失败:', err);
    return { success: false, message: err.message };
  }
};

// 获取成员列表
async function listMembers(params) {
  const { branch, generation, page = 1, pageSize = 20 } = params;
  
  let query = db.collection('members');
  
  if (branch) {
    query = query.where({ branch });
  }
  if (generation) {
    query = query.where({ generation });
  }
  
  const countResult = await query.count();
  const total = countResult.total;
  
  const { data } = await query
    .orderBy('generation', 'asc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  
  // 补充亲属姓名（使用 originalId 匹配）
  const enrichedData = await Promise.all(data.map(async (member) => {
    // 补充父亲姓名
    if (member.fatherId) {
      try {
        const fatherId = String(member.fatherId).replace(/^M0+/, ''); // 去掉 M 前缀
        const { data: fathers } = await db.collection('members')
          .where({ originalId: Number(fatherId) || fatherId })
          .limit(1)
          .get();
        if (fathers && fathers.length > 0) {
          member._fatherName = fathers[0].name;
        }
      } catch (e) {
        console.log('查询父亲失败:', e);
      }
    }
    
    // 补充母亲姓名（优先用 motherName，如果没有则从父亲的 spouseName 获取）
    if (!member.motherName && member.fatherId) {
      try {
        const fatherId = String(member.fatherId).replace(/^M0+/, '');
        const { data: fathers } = await db.collection('members')
          .where({ originalId: Number(fatherId) || fatherId })
          .limit(1)
          .get();
        if (fathers && fathers.length > 0) {
          // 从父亲的婚配信息获取母亲姓氏
          if (fathers[0].spouseName) {
            member._motherName = fathers[0].spouseName;
          } else if (fathers[0].spouseInfo && fathers[0].spouseInfo.length > 0) {
            const firstSpouse = fathers[0].spouseInfo[0];
            member._motherName = typeof firstSpouse === 'object' ? firstSpouse.name : firstSpouse;
          }
        }
      } catch (e) {
        console.log('查询母亲失败:', e);
      }
    }
    
    // 补充配偶姓名（W… 查媳妇库；数字/M… 查族人）
    if (member.spouseId) {
      try {
        const sid = String(member.spouseId).trim();
        if (/^W/i.test(sid)) {
          let wife = null;
          try {
            const doc = await db.collection('wives').doc(sid).get();
            wife = doc.data;
          } catch (e) { /* ignore */ }
          if (!wife) {
            const { data: rows } = await db.collection('wives').where({ wifeId: sid }).limit(1).get();
            wife = rows && rows[0];
          }
          if (wife) member._spouseName = wife.name;
        } else {
          const spouseId = sid.replace(/^M0+/, '');
          const { data: spouses } = await db.collection('members')
            .where({ originalId: Number(spouseId) || spouseId })
            .limit(1)
            .get();
          if (spouses && spouses.length > 0) {
            member._spouseName = spouses[0].name;
          }
        }
      } catch (e) {
        console.log('查询配偶失败:', e);
      }
    }
    
    return member;
  }));
  
  return {
    success: true,
    data: enrichedData,
    total
  };
}

// 获取单个成员
async function getMember(data) {
  const { _id, name } = data;
  let member;
  
  if (_id) {
    const result = await db.collection('members').doc(_id).get();
    member = result.data;
  } else if (name) {
    const result = await db.collection('members').where({ name }).get();
    member = result.data && result.data.length > 0 ? result.data[0] : null;
  }
  
  return {
    success: !!member,
    data: member
  };
}

// 创建成员
async function nextOriginalId() {
  const res = await db.collection('members')
    .orderBy('originalId', 'desc')
    .limit(1)
    .get()
    .catch(() => ({ data: [] }));
  const top = res.data[0];
  const n = top && top.originalId != null ? Number(top.originalId) : 0;
  return (isNaN(n) ? 0 : n) + 1;
}

async function createMember(data) {
  const payload = { ...(data || {}) };
  if (payload.memberId != null && String(payload.memberId).trim() === '') delete payload.memberId;
  if (payload.originalId === '') delete payload.originalId;

  if (!payload.memberId || payload.originalId == null) {
    const originalId =
      payload.originalId != null && payload.originalId !== ''
        ? Number(payload.originalId)
        : await nextOriginalId();
    if (!payload.originalId) payload.originalId = originalId;
    if (!payload.memberId) payload.memberId = 'M' + String(originalId).padStart(6, '0');
  }

  const result = await db.collection('members').add({
    data: {
      ...payload,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });
  return {
    success: true,
    data: {
      _id: result._id,
      memberId: payload.memberId,
      originalId: payload.originalId
    }
  };
}

// 更新成员
async function updateMember(data) {
  const { _id, ...updateData } = data;
  await db.collection('members').doc(_id).update({
    data: {
      ...updateData,
      updatedAt: db.serverDate()
    }
  });
  return { success: true };
}

// 根据姓名更新成员
async function updateMemberByName(data) {
  const { name, ...updateFields } = data;
  
  if (!name) {
    return { success: false, message: '请提供姓名' };
  }
  
  // 查找该成员
  const { data: members } = await db.collection('members')
    .where({ name })
    .limit(1)
    .get();
  
  if (members.length === 0) {
    return { success: false, message: `未找到姓名为"${name}"的成员` };
  }
  
  const member = members[0];
  
  // 过滤掉空值
  const updateData = {};
  for (const [key, value] of Object.entries(updateFields)) {
    if (value !== undefined && value !== null && value !== '') {
      updateData[key] = value;
    }
  }
  
  if (Object.keys(updateData).length === 0) {
    return { success: false, message: '没有需要更新的字段' };
  }
  
  await db.collection('members').doc(member._id).update({
    data: {
      ...updateData,
      updatedAt: db.serverDate()
    }
  });
  
  return { success: true, message: '更新成功' };
}

// 删除成员
async function deleteMember(data) {
  const { _id } = data;
  await db.collection('members').doc(_id).remove();
  return { success: true };
}

// 批量导入
async function batchImportMembers(members) {
  if (!members || !Array.isArray(members) || members.length === 0) {
    return { success: false, message: '没有数据' };
  }
  
  const results = [];
  const errors = [];
  let imported = 0;
  
  // 分批处理
  const batchSize = 50;
  for (let i = 0; i < members.length; i += batchSize) {
    const batch = members.slice(i, i + batchSize);
    
    for (const member of batch) {
      try {
        const { _id, createdAt, updatedAt, ...cleanMember } = member;
        
        await db.collection('members').add({
          data: {
            ...cleanMember,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
          }
        });
        
        imported++;
      } catch (err) {
        errors.push({
          name: member.name,
          error: err.message
        });
      }
    }
  }
  
  return {
    success: errors.length === 0,
    imported,
    failed: errors.length,
    errors
  };
}

// 分页清空人员三集合（members / wives / sons_in_law），保留其它集合
async function clearAllMembers() {
  const collections = ['members', 'wives', 'sons_in_law'];
  const MAX_LIMIT = 100;
  const details = {};
  let deletedCount = 0;

  for (const name of collections) {
    let deleted = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data } = await db.collection(name).limit(MAX_LIMIT).get();
      if (!data || data.length === 0) break;
      await Promise.all(data.map(doc => db.collection(name).doc(doc._id).remove()));
      deleted += data.length;
      if (data.length < MAX_LIMIT) break;
    }
    details[name] = deleted;
    deletedCount += deleted;
  }

  return {
    success: true,
    deletedCount,
    details,
    message: `已清空人员三集合，共 ${deletedCount} 条（未动序文/年号/荣誉/认证）`
  };
}

// 获取数量
async function getMembersCount() {
  const result = await db.collection('members').count();
  return {
    success: true,
    count: result.total
  };
}

// 批量更新族人详细信息
async function batchUpdateDetails(params) {
  const { memberDetails } = params;
  
  if (!memberDetails || typeof memberDetails !== 'object') {
    return { success: false, message: '请提供 memberDetails 数据' };
  }
  
  const results = {
    success: [],
    notFound: [],
    failed: []
  };
  
  const names = Object.keys(memberDetails);
  
  for (const name of names) {
    try {
      const details = memberDetails[name];
      
      // 查询该族人
      const { data: members } = await db.collection('members')
        .where({
          name: name
        })
        .get();
      
      if (members.length === 0) {
        results.notFound.push(name);
        continue;
      }
      
      const member = members[0];
      
      // 准备更新数据
      const updateData = {};
      
      if (details.gender) updateData.gender = details.gender;
      if (details.education) {
        updateData.education = details.education.map(e => ({
          degree: typeof e === 'string' ? e : (e.degree || e),
          school: typeof e === 'object' ? (e.school || '') : '',
          major: typeof e === 'object' ? (e.major || '') : ''
        }));
      }
      if (details.positions) {
        updateData.positions = details.positions.map((p, index) => ({
          title: p.title || p,
          organization: p.organization || '',
          level: p.level || '',
          isCurrent: p.isCurrent || false,
          isDefault: index === details.positions.length - 1
        }));
      }
      if (details.residence) updateData.residence = details.residence;
      if (details.honors) {
        updateData.honors = details.honors.map(h => ({
          type: h.type || '',
          title: typeof h === 'string' ? h : (h.title || ''),
          level: h.level || '',
          year: h.year || null,
          description: h.description || ''
        }));
      }
      
      // 更新数据库
      const dbUpdateData = {
        ...updateData,
        updatedAt: db.serverDate()
      };
      await db.collection('members')
        .doc(member._id)
        .update({
          data: dbUpdateData
        });
      
      results.success.push(name);
      
      // 添加延迟避免频率限制
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (err) {
      console.error(`更新 ${name} 失败:`, err);
      results.failed.push({ name, error: err.message });
    }
  }
  
  return {
    success: true,
    message: `更新完成：成功 ${results.success.length}，未找到 ${results.notFound.length}，失败 ${results.failed.length}`,
    data: results
  };
}

// 婚配信息提取和更新（完整版 - 循环处理全部数据）
async function updateSpouseInfoAction(params) {
  // 婚配正则表达式
  const SPOUSE_PATTERNS = [
    /配([^\s，。,；;（）\(\)第]+氏)/,
    /继配([^\s，。,；;（）\(\)第]+氏)/,
    /元配([^\s，。,；;（）\(\)第]+氏)/,
    /次配([^\s，。,；;（）\(\)第]+氏)/,
    /[一二三四五六七八九十]+配([^\s，。,；;（）\(\)第]+氏)/
  ];
  
  function extractSpouseName(remark) {
    if (!remark) return '';
    for (const pattern of SPOUSE_PATTERNS) {
      const match = remark.match(pattern);
      if (match && match[1]) return match[1];
    }
    return '';
  }
  
  function extractAllSpouses(remark) {
    if (!remark) return [];
    const spouses = [];
    const allPattern = /(?:配|继配|元配|次配|[一二三四五六七八九十]+配)([^\s，。,；;（）\(\)第]+氏)/g;
    let match;
    while ((match = allPattern.exec(remark)) !== null) {
      if (match[1]) spouses.push(match[1]);
    }
    return spouses;
  }
  
  const results = { updated: 0, hasSpouse: 0, noSpouse: 0, failed: [] };
  
  // 循环获取所有成员（云数据库每次最多返回100条）
  const batchSize = 100;
  let skip = 0;
  let totalProcessed = 0;
  
  while (true) {
    const { data: members } = await db.collection('members')
      .field({ _id: true, name: true, remark: true })
      .limit(batchSize)
      .skip(skip)
      .get();
    
    if (members.length === 0) break;
    
    console.log(`获取第 ${skip + 1}-${skip + members.length} 条记录...`);
    
    // 分批处理，每批20个并行
    const processBatchSize = 20;
    for (let i = 0; i < members.length; i += processBatchSize) {
      const batch = members.slice(i, i + processBatchSize);
      
      const promises = batch.map(async (member) => {
        try {
          const spouseName = extractSpouseName(member.remark);
          const allSpouses = extractAllSpouses(member.remark);
          
          if (spouseName || allSpouses.length > 0) {
            await db.collection('members').doc(member._id).update({
              data: {
                spouseName: spouseName,
                spouseInfo: allSpouses
              }
            });
            results.hasSpouse++;
          } else {
            results.noSpouse++;
          }
          results.updated++;
        } catch (err) {
          results.failed.push({ name: member.name, error: err.message });
        }
      });
      
      await Promise.all(promises);
    }
    
    totalProcessed += members.length;
    console.log(`已处理 ${totalProcessed} 条`);
    skip += batchSize;
  }
  
  return {
    success: true,
    message: `更新完成：共处理 ${results.updated} 条，有配偶 ${results.hasSpouse} 条，无配偶 ${results.noSpouse} 条`,
    data: results
  };
}

// 测试婚配信息显示 - 返回几个有婚配信息的样例
async function testSpouseInfoAction(params) {
  const { limit = 5 } = params;
  
  // 查询有 spouseInfo 的成员
  const { data: members } = await db.collection('members')
    .field({ _id: true, name: true, generation: true, spouseName: true, spouseInfo: true, remark: true })
    .where({
      spouseName: db.command.exists(true)
    })
    .limit(limit)
    .get();
  
  // 查询有 remark 但没有 spouseName 的成员（用于对比）
  const { data: noSpouse } = await db.collection('members')
    .field({ _id: true, name: true, generation: true, spouseName: true, spouseInfo: true, remark: true })
    .where({
      spouseName: db.command.exists(false),
      remark: db.command.exists(true)
    })
    .limit(3)
    .get();
  
  return {
    success: true,
    message: '婚配信息测试数据',
    data: {
      withSpouse: members,
      withoutSpouse: noSpouse
    }
  };
}

// ==================== 媳妇（Wives）相关操作 ====================

// 获取媳妇列表
async function listWives(params) {
  const { husbandId, generation, wifeId, page = 1, pageSize = 20 } = params;
  
  let query = db.collection('wives');
  
  if (husbandId) {
    query = query.where({ husbandId: String(husbandId) });
  }
  if (generation) {
    query = query.where({ generation });
  }
  if (wifeId) {
    query = query.where({ wifeId: String(wifeId) });
  }
  
  const countResult = await query.count();
  const total = countResult.total;
  
  const { data } = await query
    .orderBy('generation', 'asc')
    .orderBy('marriageOrder', 'asc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  
  return { success: true, data, total };
}

// 获取单个媳妇（支持 _id 或 wifeId，如 W000409_1）
async function getWife(data) {
  const id = data._id || data.wifeId || data.id;
  if (!id) return { success: false, message: '缺少媳妇ID' };

  try {
    const { data: wife } = await db.collection('wives').doc(String(id)).get();
    if (wife) return { success: true, data: wife };
  } catch (e) {
    // doc 不存在时继续按 wifeId 查
  }

  const { data: rows } = await db.collection('wives')
    .where({ wifeId: String(id) })
    .limit(1)
    .get();
  return { success: rows && rows.length > 0, data: rows && rows[0] };
}

// 创建媳妇
async function createWife(data) {
  // 生成 wifeId
  const countResult = await db.collection('wives').count();
  const nextId = countResult.total + 1;
  const wifeId = 'W' + String(nextId).padStart(6, '0');
  
  const result = await db.collection('wives').add({
    data: {
      ...data,
      wifeId: wifeId,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });
  return { success: true, data: { _id: result.id, wifeId: wifeId } };
}

// 更新媳妇
async function updateWife(data) {
  const { _id, ...updateData } = data;
  await db.collection('wives').doc(_id).update({
    data: {
      ...updateData,
      updatedAt: db.serverDate()
    }
  });
  return { success: true, message: '更新成功' };
}

// 删除媳妇
async function deleteWife(data) {
  const { _id } = data;
  await db.collection('wives').doc(_id).remove();
  return { success: true, message: '删除成功' };
}

// ==================== 女婿（SonsInLaw）相关操作 ====================

// 获取女婿列表
async function listSonsInLaw(params) {
  const { wifeId, generation, page = 1, pageSize = 20 } = params;
  
  let query = db.collection('sons_in_law');
  
  if (wifeId) {
    query = query.where({ wifeId: String(wifeId) });
  }
  if (generation) {
    query = query.where({ generation });
  }
  
  const countResult = await query.count();
  const total = countResult.total;
  
  const { data } = await query
    .orderBy('generation', 'asc')
    .orderBy('marriageOrder', 'asc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  
  return { success: true, data, total };
}

// 获取单个女婿
async function getSonInLaw(data) {
  const { _id } = data;
  const { data: sonInLaw } = await db.collection('sons_in_law').doc(_id).get();
  return { success: !!sonInLaw, data: sonInLaw };
}

// 创建女婿
async function createSonInLaw(data) {
  // 生成 sonId
  const countResult = await db.collection('sons_in_law').count();
  const nextId = countResult.total + 1;
  const sonId = 'S' + String(nextId).padStart(6, '0');
  
  const result = await db.collection('sons_in_law').add({
    data: {
      ...data,
      sonId: sonId,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });
  return { success: true, data: { _id: result.id, sonId: sonId } };
}

// 更新女婿
async function updateSonInLaw(data) {
  const { _id, ...updateData } = data;
  await db.collection('sons_in_law').doc(_id).update({
    data: {
      ...updateData,
      updatedAt: db.serverDate()
    }
  });
  return { success: true, message: '更新成功' };
}

// 删除女婿
async function deleteSonInLaw(data) {
  const { _id } = data;
  await db.collection('sons_in_law').doc(_id).remove();
  return { success: true, message: '删除成功' };
}

// ============ 荣誉榜相关 API ============

// 族长列表
async function listPatriarchs(params) {
  const { branch, page = 1, pageSize = 100 } = params;
  const where = {};
  if (branch) where.branch = branch;

  const total = await safeCollectionCount('patriarchs', where);

  let data = [];
  try {
    const res = await db.collection('patriarchs')
      .where(where)
      .orderBy('sortOrder', 'asc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    data = res.data || [];
  } catch (e) {
    if (isCollectionMissingError(e)) {
      await ensureCollection('patriarchs');
      data = [];
    } else {
      try {
        const res = await db.collection('patriarchs')
          .where(where)
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .get();
        data = res.data || [];
      } catch (e2) {
        if (isCollectionMissingError(e2)) {
          await ensureCollection('patriarchs');
          data = [];
        } else throw e2;
      }
    }
  }

  return {
    success: true,
    data: await hydrateHonorList(data),
    total
  };
}

async function getPatriarch(data) {
  if (!data || !data._id) return { success: false, message: '缺少族长 ID' };
  try {
    const { data: item } = await db.collection('patriarchs').doc(data._id).get();
    if (!item) return { success: false, message: '未找到该族长' };
    const [hydrated] = await hydrateHonorList([item]);
    return { success: true, data: hydrated };
  } catch (err) {
    return { success: false, message: err.message || '读取失败' };
  }
}

async function createPatriarch(data) {
  try {
    await ensureCollection('patriarchs');
    let payload = pickHonorWriteFields(data, 'patriarchs');
    payload = await enrichHonorLinkFields(payload);
    if (payload.name) payload.name = clanifyPersonName(payload.name);
    if (!payload.memberDocId && !payload.name) {
      return { success: false, message: '请选择族人或填写姓名' };
    }
    const result = await db.collection('patriarchs').add({
      data: { ...payload, createdAt: db.serverDate(), updatedAt: db.serverDate() }
    });
    return { success: true, data: { _id: docIdFromAddResult(result) }, message: '创建成功' };
  } catch (err) {
    console.error('createPatriarch', err);
    return { success: false, message: err.message || '创建失败' };
  }
}

async function updatePatriarch(data) {
  try {
    const _id = data && data._id;
    if (!_id) return { success: false, message: '缺少族长 ID' };
    let payload = pickHonorWriteFields(data, 'patriarchs');
    payload = await enrichHonorLinkFields(payload);
    if (payload.name) payload.name = clanifyPersonName(payload.name);
    await db.collection('patriarchs').doc(_id).update({
      data: { ...payload, updatedAt: db.serverDate() }
    });
    return { success: true, message: '更新成功' };
  } catch (err) {
    console.error('updatePatriarch', err);
    return { success: false, message: err.message || '更新失败' };
  }
}

async function deletePatriarch(data) {
  if (!data || !data._id) return { success: false, message: '缺少族长 ID' };
  try {
    await db.collection('patriarchs').doc(data._id).remove();
    return { success: true, message: '删除成功' };
  } catch (err) {
    return { success: false, message: err.message || '删除失败' };
  }
}

// 乡贤列表：以云库 sages 为准；空库时从簪缨引种子导入
async function seedSagesFromZanyingyin() {
  await ensureCollection('sages');
  const seeds = listZanyingyinSages(null) || [];
  let added = 0;
  for (const item of seeds) {
    const name = clanifyPersonName(item.name);
    let existTotal = 0;
    try {
      const exist = await db.collection('sages')
        .where({ name, generation: item.generation || 0 })
        .count();
      existTotal = exist.total;
    } catch (e) {
      if (isCollectionMissingError(e)) {
        await ensureCollection('sages');
        existTotal = 0;
      } else throw e;
    }
    if (existTotal > 0) continue;
    await db.collection('sages').add({
      data: {
        name,
        generation: item.generation || null,
        dynasty: item.dynasty || '',
        achievements: item.achievements || '',
        memberDocId: item.memberDocId || '',
        sourceId: item._id || '',
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    added++;
  }
  return added;
}

async function listSages(params) {
  const { dynasty, page = 1, pageSize = 100 } = params;
  const pageNum = Math.max(1, Number(page) || 1);
  const size = Math.min(200, Math.max(1, Number(pageSize) || 100));

  let total = await safeCollectionCount('sages');
  if (total === 0) {
    await seedSagesFromZanyingyin();
    total = await safeCollectionCount('sages');
  }

  const where = {};
  if (dynasty) where.dynasty = dynasty;

  let query = db.collection('sages').where(where);
  try {
    const countResult = await query.count();
    total = countResult.total;
  } catch (e) {
    if (isCollectionMissingError(e)) {
      await ensureCollection('sages');
      total = 0;
    } else throw e;
  }

  let data = [];
  try {
    const res = await query
      .orderBy('generation', 'asc')
      .skip((pageNum - 1) * size)
      .limit(size)
      .get();
    data = res.data || [];
  } catch (e) {
    if (isCollectionMissingError(e)) {
      await ensureCollection('sages');
      data = [];
    } else {
      const res = await query.skip((pageNum - 1) * size).limit(size).get();
      data = res.data || [];
    }
  }

  const hydrated = await hydrateHonorList(data);
  const list = hydrated.map(item => ({
    _id: item._id,
    name: item.name,
    generation: item.generation,
    dynasty: item.dynasty || '',
    achievements: item.achievements || item.gongming || '',
    gongming: item.gongming || '',
    guanzhi: item.guanzhi || '',
    memberDocId: item.memberDocId || '',
    originalId: item.originalId || '',
    hasLink: !!item.hasLink,
    birthYear: item.birthYear || '',
    deathYear: item.deathYear || '',
    eraName: item.eraName || ''
  }));

  return {
    success: true,
    data: list,
    total,
    page: pageNum,
    pageSize: size,
    intro: SAGES_INTRO
  };
}

async function getSage(data) {
  if (!data || !data._id) return { success: false, message: '缺少乡贤 ID' };
  try {
    const { data: item } = await db.collection('sages').doc(data._id).get();
    if (!item) return { success: false, message: '未找到该乡贤' };
    const [hydrated] = await hydrateHonorList([item]);
    return { success: true, data: hydrated };
  } catch (err) {
    return { success: false, message: err.message || '读取失败' };
  }
}

async function createSage(data) {
  try {
    await ensureCollection('sages');
    let payload = pickHonorWriteFields(data, 'sages');
    payload = await enrichHonorLinkFields(payload);
    if (payload.name) payload.name = clanifyPersonName(payload.name);
    if (!payload.memberDocId && !payload.name) {
      return { success: false, message: '请选择族人或填写姓名' };
    }
    if (payload.achievements == null) payload.achievements = '';
    const result = await db.collection('sages').add({
      data: { ...payload, createdAt: db.serverDate(), updatedAt: db.serverDate() }
    });
    return { success: true, data: { _id: docIdFromAddResult(result) }, message: '创建成功' };
  } catch (err) {
    console.error('createSage', err);
    return { success: false, message: err.message || '创建失败' };
  }
}

async function updateSage(data) {
  try {
    const _id = data && data._id;
    if (!_id) return { success: false, message: '缺少乡贤 ID' };
    let payload = pickHonorWriteFields(data, 'sages');
    payload = await enrichHonorLinkFields(payload);
    if (payload.name) payload.name = clanifyPersonName(payload.name);
    if (data && Object.prototype.hasOwnProperty.call(data, 'achievements')) {
      payload.achievements = data.achievements == null ? '' : String(data.achievements);
    }
    await db.collection('sages').doc(_id).update({
      data: { ...payload, updatedAt: db.serverDate() }
    });
    return { success: true, message: '更新成功' };
  } catch (err) {
    console.error('updateSage', err);
    return { success: false, message: err.message || '更新失败' };
  }
}

async function deleteSage(data) {
  if (!data || !data._id) return { success: false, message: '缺少乡贤 ID' };
  try {
    await db.collection('sages').doc(data._id).remove();
    return { success: true, message: '删除成功' };
  } catch (err) {
    return { success: false, message: err.message || '删除失败' };
  }
}

// 群英列表
async function listElite(params) {
  const { achievementType, page = 1, pageSize = 100 } = params || {};
  const pageNum = Math.max(1, Number(page) || 1);
  const size = Math.min(200, Math.max(1, Number(pageSize) || 100));
  const where = {};
  if (achievementType) where.achievementType = achievementType;

  let total = await safeCollectionCount('elite', where);
  // 集合不存在或空库时写入当今族人撷英七人
  if (total === 0 && !achievementType) {
    await resetEliteHeroes();
    total = await safeCollectionCount('elite');
  }

  let data = [];
  try {
    const result = await db.collection('elite')
      .where(where)
      .orderBy('sortOrder', 'asc')
      .skip((pageNum - 1) * size)
      .limit(size)
      .get();
    data = result.data || [];
  } catch (e) {
    if (isCollectionMissingError(e)) {
      await ensureCollection('elite');
      if (!achievementType) {
        await resetEliteHeroes();
        total = await safeCollectionCount('elite');
      }
      try {
        const result = await db.collection('elite')
          .where(where)
          .skip((pageNum - 1) * size)
          .limit(size)
          .get();
        data = result.data || [];
      } catch (e2) {
        data = [];
      }
    } else {
      try {
        const result = await db.collection('elite')
          .where(where)
          .orderBy('generation', 'asc')
          .skip((pageNum - 1) * size)
          .limit(size)
          .get();
        data = result.data || [];
      } catch (e2) {
        if (isCollectionMissingError(e2)) {
          await ensureCollection('elite');
          data = [];
        } else {
          const result = await db.collection('elite')
            .where(where)
            .skip((pageNum - 1) * size)
            .limit(size)
            .get();
          data = result.data || [];
        }
      }
    }
  }

  const hydrated = await hydrateHonorList(data);
  return {
    success: true,
    data: hydrated,
    total,
    page: pageNum,
    pageSize: size
  };
}

async function getElite(data) {
  let item = null;
  if (data && data._id) {
    const res = await db.collection('elite').doc(data._id).get().catch(() => null);
    item = res && res.data;
  }
  if (!item && data && data.heroId) {
    const res = await db.collection('elite').where({ heroId: data.heroId }).limit(1).get();
    item = (res.data && res.data[0]) || null;
  }
  if (!item) return { success: false, message: '未找到该群英' };
  const [hydrated] = await hydrateHonorList([item]);
  if (!hydrated.paragraphs && hydrated.biography) {
    hydrated.paragraphs = String(hydrated.biography).split(/\n\n+/).filter(Boolean);
  }
  return { success: true, data: hydrated };
}

async function createElite(data) {
  try {
    await ensureCollection('elite');
    let payload = pickHonorWriteFields(data, 'elite');
    payload = await enrichHonorLinkFields(payload);
    if (payload.name) payload.name = clanifyPersonName(payload.name);
    if (!payload.memberDocId && !payload.name) {
      return { success: false, message: '请选择族人或填写姓名' };
    }
    if (payload.summary == null) payload.summary = '';
    if (payload.biography == null) payload.biography = '';
    const result = await db.collection('elite').add({
      data: { ...payload, createdAt: db.serverDate(), updatedAt: db.serverDate() }
    });
    return { success: true, data: { _id: docIdFromAddResult(result) }, message: '创建成功' };
  } catch (err) {
    console.error('createElite', err);
    return { success: false, message: err.message || '创建失败' };
  }
}

async function updateElite(data) {
  try {
    const _id = data && data._id;
    if (!_id) return { success: false, message: '缺少群英 ID' };
    let payload = pickHonorWriteFields(data, 'elite');
    payload = await enrichHonorLinkFields(payload);
    if (payload.name) payload.name = clanifyPersonName(payload.name);
    if (data && Object.prototype.hasOwnProperty.call(data, 'summary')) {
      payload.summary = data.summary == null ? '' : String(data.summary);
    }
    if (data && Object.prototype.hasOwnProperty.call(data, 'biography')) {
      payload.biography = data.biography == null ? '' : String(data.biography);
    }
    await db.collection('elite').doc(_id).update({
      data: { ...payload, updatedAt: db.serverDate() }
    });
    return { success: true, message: '更新成功' };
  } catch (err) {
    console.error('updateElite', err);
    return { success: false, message: err.message || '更新失败' };
  }
}

async function deleteElite(data) {
  if (!data || !data._id) return { success: false, message: '缺少群英 ID' };
  try {
    await db.collection('elite').doc(data._id).remove();
    return { success: true, message: '删除成功' };
  } catch (err) {
    return { success: false, message: err.message || '删除失败' };
  }
}

/** 当今族人撷英（七人）：与 eliteHeroes.js 同源，姓名统一冠「罗」 */
const ELITE_SEED_META = {
  xiangwen: { achievementType: '政务', position: '副调研员', organization: '中共江西省委宣传部办公室' },
  chuanfang: { achievementType: '军事', position: '经理、党支部书记', organization: '江西樟树市农业生产资料公司' },
  jianxin: { achievementType: '企业', position: '负责人', organization: '深圳博民科技有限公司' },
  guocai: { achievementType: '教育', position: '党委书记兼校长', organization: '江西省轻工业厅直属技工学校' },
  decai: { achievementType: '政务', position: '镇党委书记、人大主席', organization: '安福县洲湖镇' },
  qingliang: { achievementType: '政务', position: '县委常委、组织部部长', organization: '中共峡江县委' },
  zhijian: { achievementType: '企业', position: '总经理', organization: '中国联通赣州分公司' }
};

const ELITE_HEROES_SEED = ELITE_HEROES.map((h) => {
  const meta = ELITE_SEED_META[h.id] || {};
  return {
    id: h.id,
    name: clanifyPersonName(h.name),
    branch: h.branch,
    generation: h.generation,
    birthYear: h.birthYear,
    summary: h.summary,
    achievementType: meta.achievementType || '',
    position: meta.position || '',
    organization: meta.organization || '',
    biography: (h.paragraphs || []).join('\n\n')
  };
});

async function resetEliteHeroes() {
  await ensureCollection('elite');

  // 清空原有关联人员（集合刚创建时跳过）
  const batchSize = 100;
  let removed = 0;
  try {
    while (true) {
      const { data } = await db.collection('elite').limit(batchSize).get();
      if (!data.length) break;
      await Promise.all(data.map(item => db.collection('elite').doc(item._id).remove()));
      removed += data.length;
    }
  } catch (err) {
    if (!isCollectionMissingError(err)) throw err;
    await ensureCollection('elite');
  }

  // 写入当今族人撷英七人（尽量按姓名关联族人）
  let added = 0;
  for (let i = 0; i < ELITE_HEROES_SEED.length; i++) {
    const hero = ELITE_HEROES_SEED[i];
    let memberDocId = '';
    let originalId = '';
    try {
      const found = await db.collection('members').where({ name: hero.name }).limit(1).get();
      const m = found.data && found.data[0];
      if (m) {
        memberDocId = String(m._id);
        originalId = m.originalId || m.memberId || '';
      }
    } catch (_) { /* ignore */ }
    await db.collection('elite').add({
      data: {
        heroId: hero.id,
        name: hero.name,
        branch: hero.branch,
        generation: hero.generation,
        birthYear: hero.birthYear,
        summary: hero.summary,
        achievementType: hero.achievementType,
        position: hero.position,
        organization: hero.organization,
        biography: hero.biography,
        memberDocId,
        originalId,
        level: '',
        isAlive: true,
        sortOrder: i + 1,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    added++;
  }

  return {
    success: true,
    message: '已清空旧关联并重置为当今族人撷英',
    data: { removed, added }
  };
}

/** 一次性迁移：把旧 memberId / M#### 写成 memberDocId + originalId */
async function migrateHonorMemberLinks() {
  await ensureHonorCollections();
  const collections = ['patriarchs', 'sages', 'elite'];
  const stats = { patriarchs: 0, sages: 0, elite: 0, failed: 0 };

  for (const col of collections) {
    let skip = 0;
    while (true) {
      let rows = [];
      try {
        const res = await db.collection(col).skip(skip).limit(50).get();
        rows = res.data || [];
      } catch (e) {
        if (isCollectionMissingError(e)) break;
        throw e;
      }
      if (!rows.length) break;

      for (const row of rows) {
        try {
          const patch = await enrichHonorLinkFields({
            memberDocId: row.memberDocId || '',
            originalId: row.originalId || row.memberId || '',
            memberId: row.memberId || '',
            name: row.name || ''
          });
          // 若 memberDocId 存的是 M####，enrich 会解析
          if (!patch.memberDocId && row.memberDocId && /^[MC]\d+/i.test(String(row.memberDocId))) {
            const again = await enrichHonorLinkFields({
              originalId: String(row.memberDocId),
              name: row.name || ''
            });
            Object.assign(patch, again);
          }
          if (!patch.memberDocId && row.name) {
            const found = await db.collection('members')
              .where({ name: clanifyPersonName(row.name) })
              .limit(1)
              .get();
            const m = found.data && found.data[0];
            if (m) {
              patch.memberDocId = String(m._id);
              patch.originalId = m.originalId || m.memberId || '';
            }
          }
          if (!patch.memberDocId && !patch.originalId) continue;
          if (
            patch.memberDocId === row.memberDocId &&
            patch.originalId === (row.originalId || '')
          ) continue;

          await db.collection(col).doc(row._id).update({
            data: {
              memberDocId: patch.memberDocId || '',
              originalId: patch.originalId || '',
              updatedAt: db.serverDate()
            }
          });
          stats[col]++;
        } catch (err) {
          console.error('migrateHonor', col, row._id, err);
          stats.failed++;
        }
      }
      skip += rows.length;
      if (rows.length < 50) break;
    }
  }

  return {
    success: true,
    message: '荣誉榜族人关联迁移完成',
    data: stats
  };
}

/** 学历榜三类：从 members.education 实时归类 */
async function listEducationHonor() {
  const allMembers = [];
  const pageSize = 500;
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await db.collection('members')
      .field({
        _id: true,
        name: true,
        originalId: true,
        memberId: true,
        birthDate: true,
        education: true,
        remark: true,
        gongming: true,
        guanzhi: true,
        positions: true
      })
      .skip(skip)
      .limit(pageSize)
      .get();

    allMembers.push(...result.data);
    skip += pageSize;
    hasMore = result.data.length === pageSize;
    if (allMembers.length >= 5000) break;
  }

  // 含学历 / 功名 / 官职 / 备注（不少人学历只写在 remark）
  const candidates = allMembers.filter(m =>
    (Array.isArray(m.education) && m.education.length > 0) ||
    (m.gongming && String(m.gongming).trim()) ||
    (m.guanzhi && String(m.guanzhi).trim()) ||
    (Array.isArray(m.positions) && m.positions.length > 0) ||
    (m.remark && String(m.remark).trim())
  );
  const raw = buildEducationHonorLists(candidates);
  const mapList = (list) => (list || []).map((row) => Object.assign({}, row, {
    name: clanifyPersonName(row.name)
  }));
  const data = {
    imperial: mapList(raw.imperial),
    republican: mapList(raw.republican),
    modern: mapList(raw.modern)
  };

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

// 学历榜列表（旧 graduates 表，保留兼容）
async function listGraduates(params) {
  const { year, degree, page = 1, pageSize = 100 } = params;
  const where = {};
  if (year) where.graduationYear = Number(year);
  if (degree) where.degree = degree;
  
  const countResult = await db.collection('graduates').where(where).count();
  const total = countResult.total;
  
  const { data } = await db.collection('graduates')
    .where(where)
    .orderBy('graduationYear', 'desc')
    .orderBy('name', 'asc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  
  return { success: true, data, total };
}

async function getGraduate(data) {
  const { data: item } = await db.collection('graduates').doc(data._id).get();
  return { success: true, data: item };
}

async function createGraduate(data) {
  const result = await db.collection('graduates').add({
    data: { ...data, createdAt: db.serverDate(), updatedAt: db.serverDate() }
  });
  return { success: true, data: { _id: result._id } };
}

async function updateGraduate(data) {
  const { _id, ...updateData } = data;
  await db.collection('graduates').doc(_id).update({
    data: { ...updateData, updatedAt: db.serverDate() }
  });
  return { success: true, message: '更新成功' };
}

async function deleteGraduate(data) {
  await db.collection('graduates').doc(data._id).remove();
  return { success: true, message: '删除成功' };
}

// 获取学历年份统计
async function getGraduatesByYear(params) {
  const { data: graduates } = await db.collection('graduates')
    .field({ graduationYear: true })
    .orderBy('graduationYear', 'desc')
    .get();
  
  // 统计每年人数
  const yearStats = {};
  for (const g of graduates) {
    if (g.graduationYear) {
      yearStats[g.graduationYear] = (yearStats[g.graduationYear] || 0) + 1;
    }
  }
  
  const years = Object.keys(yearStats).map(Number).sort((a, b) => b - a);
  
  return { success: true, data: { years, yearStats } };
}

// 获取谱树数据（四堂入口 / 单堂成员供世系图）
async function getFamilyTree(params) {
  const { branch } = params;
  const HALLS = ['中和堂', '明儒堂', '德裕堂', '忠爱堂'];

  async function fetchAllMembers(where) {
    const all = [];
    const pageSize = 100;
    let skip = 0;
    for (;;) {
      const { data } = await db.collection('members')
        .where(where)
        .field({
          _id: true,
          name: true,
          originalId: true,
          memberId: true,
          generation: true,
          branch: true,
          fatherId: true,
          fatherName: true,
          gender: true,
          hasBrokenLineage: true
        })
        .skip(skip)
        .limit(pageSize)
        .get();
      all.push(...data);
      if (data.length < pageSize || all.length >= 5000) break;
      skip += pageSize;
    }
    return all;
  }

  if (!branch) {
    const halls = [];
    for (const name of HALLS) {
      const list = await fetchAllMembers({ branch: name });
      const gens = list.map(m => m.generation || 0);
      halls.push({
        branch: name,
        total: list.length,
        minGen: gens.length ? Math.min(...gens) : 0,
        maxGen: gens.length ? Math.max(...gens) : 0
      });
    }
    return { success: true, data: { mode: 'hub', halls } };
  }

  const members = (await fetchAllMembers({ branch })).map(clanifyMemberRow);
  return {
    success: true,
    data: { mode: 'chart', branch, members, total: members.length }
  };
}

/**
 * 批量修正云库族人/荣誉姓名冠「罗」（不产生罗罗；外姓含「氏」不加）
 * 覆盖：members / wives.husbandName / sons_in_law.wifeName / patriarchs / elite
 */
async function fixClanSurnames(params = {}) {
  const stats = {
    membersScanned: 0,
    membersUpdated: 0,
    wivesUpdated: 0,
    silUpdated: 0,
    patriarchsUpdated: 0,
    eliteUpdated: 0
  };

  async function pageAll(collection, handler) {
    const pageSize = 100;
    let skip = 0;
    for (;;) {
      const { data } = await db.collection(collection).skip(skip).limit(pageSize).get();
      if (!data.length) break;
      for (const row of data) {
        await handler(row);
      }
      skip += pageSize;
      if (data.length < pageSize) break;
    }
  }

  await pageAll('members', async (m) => {
    stats.membersScanned += 1;
    const patch = {};
    const newName = clanifyPersonName(m.name);
    if (newName && newName !== m.name) patch.name = newName;
    const newFather = clanifyPersonName(m.fatherName);
    if (m.fatherName && newFather && newFather !== m.fatherName) patch.fatherName = newFather;
    if (m.motherName && !looksLikeWifeName(m.motherName)) {
      const nm = clanifyPersonName(m.motherName);
      if (nm && nm !== m.motherName) patch.motherName = nm;
    }
    if (Object.keys(patch).length) {
      await db.collection('members').doc(m._id).update({
        data: Object.assign({}, patch, { updatedAt: db.serverDate() })
      });
      stats.membersUpdated += 1;
    }
  });

  await pageAll('wives', async (w) => {
    const patch = {};
    if (w.husbandName) {
      const hn = clanifyPersonName(w.husbandName);
      if (hn && hn !== w.husbandName) patch.husbandName = hn;
    }
    if ((w.isSameVillage || w.linkedMemberId) && w.name && !looksLikeWifeName(w.name)) {
      const wn = clanifyPersonName(w.name);
      if (wn && wn !== w.name) patch.name = wn;
    }
    if (Object.keys(patch).length) {
      await db.collection('wives').doc(w._id).update({
        data: Object.assign({}, patch, { updatedAt: db.serverDate() })
      });
      stats.wivesUpdated += 1;
    }
  });

  await pageAll('sons_in_law', async (s) => {
    const patch = {};
    if (s.wifeName) {
      const wn = clanifyPersonName(s.wifeName);
      if (wn && wn !== s.wifeName) patch.wifeName = wn;
    }
    if ((s.isSameVillage || s.linkedMemberId) && s.name && !looksLikeWifeName(s.name)) {
      const n = clanifyPersonName(s.name);
      if (n && n !== s.name) patch.name = n;
    }
    if (Object.keys(patch).length) {
      await db.collection('sons_in_law').doc(s._id).update({
        data: Object.assign({}, patch, { updatedAt: db.serverDate() })
      });
      stats.silUpdated += 1;
    }
  });

  await pageAll('patriarchs', async (p) => {
    if (!p.name) return;
    const n = clanifyPersonName(p.name);
    if (n && n !== p.name) {
      await db.collection('patriarchs').doc(p._id).update({
        data: { name: n, updatedAt: db.serverDate() }
      });
      stats.patriarchsUpdated += 1;
    }
  });

  await pageAll('elite', async (e) => {
    if (!e.name) return;
    const n = clanifyPersonName(e.name);
    if (n && n !== e.name) {
      await db.collection('elite').doc(e._id).update({
        data: { name: n, updatedAt: db.serverDate() }
      });
      stats.eliteUpdated += 1;
    }
  });

  return {
    success: true,
    message: '族人姓名冠姓修正完成（已防罗罗）',
    data: stats
  };
}

// 补充媳妇和女婿的ID
async function fixSpouseIds(params) {
  const { action } = params;
  
  if (action === 'fixWives') {
    // 为 wives 表补充 wifeId
    const wives = await db.collection('wives').get();
    let fixed = 0;
    
    for (let i = 0; i < wives.data.length; i++) {
      const wife = wives.data[i];
      if (!wife.wifeId) {
        const wifeId = 'W' + String(i + 1).padStart(6, '0');
        await db.collection('wives').doc(wife._id).update({
          data: { wifeId }
        });
        fixed++;
      }
    }
    
    return { success: true, message: `已为 ${fixed} 条媳妇记录补充ID` };
  }
  
  if (action === 'fixSonsInLaw') {
    // 为 sons_in_law 表补充 sonId
    const sons = await db.collection('sons_in_law').get();
    let fixed = 0;
    
    for (let i = 0; i < sons.data.length; i++) {
      const son = sons.data[i];
      if (!son.sonId) {
        const sonId = 'S' + String(i + 1).padStart(6, '0');
        await db.collection('sons_in_law').doc(son._id).update({
          data: { sonId }
        });
        fixed++;
      }
    }
    
    return { success: true, message: `已为 ${fixed} 条女婿记录补充ID` };
  }
  
  return { success: false, message: '请指定 action: fixWives 或 fixSonsInLaw' };
}

// 调试：查看媳妇表的所有字段名
async function debugWifeFields() {
  const { data } = await db.collection('wives').limit(3).get();
  if (data.length === 0) return { success: false, message: 'wives表为空' };
  return { success: true, fields: Object.keys(data[0]), sample: data[0] };
}

// 调试：查看女婿表的所有字段名
async function debugSonFields() {
  const { data } = await db.collection('sons_in_law').limit(3).get();
  if (data.length === 0) return { success: false, message: 'sons_in_law表为空' };
  return { success: true, fields: Object.keys(data[0]), sample: data[0] };
}

// 删除没有 wifeId 的媳妇记录（批量删除）
async function deleteWifesWithoutId() {
  const { data } = await db.collection('wives').where({ wifeId: db.command.exists(false) }).limit(1000).get();
  if (data.length === 0) return { success: true, message: '没有无ID的媳妇记录' };
  
  const ids = data.map(w => w._id);
  await db.collection('wives').where({ _id: db.command.in(ids) }).remove();
  
  return { success: true, message: `批量删除 ${ids.length} 条无ID的媳妇记录` };
}

// 删除没有 sonId 的女婿记录（批量删除）
async function deleteSonsWithoutId() {
  const { data } = await db.collection('sons_in_law').where({ sonId: db.command.exists(false) }).limit(1000).get();
  if (data.length === 0) return { success: true, message: '没有无ID的女婿记录' };
  
  const ids = data.map(s => s._id);
  await db.collection('sons_in_law').where({ _id: db.command.in(ids) }).remove();
  
  return { success: true, message: `批量删除 ${ids.length} 条无ID的女婿记录` };
}

// 统计无ID记录数量
async function getRecordsWithoutId() {
  const wivesCount = await db.collection('wives').where({ wifeId: db.command.exists(false) }).count();
  const sonsCount = await db.collection('sons_in_law').where({ sonId: db.command.exists(false) }).count();
  const wivesTotal = await db.collection('wives').count();
  const sonsTotal = await db.collection('sons_in_law').count();
  
  return {
    success: true,
    data: {
      wives: { total: wivesTotal.total, withoutId: wivesCount.total, withId: wivesTotal.total - wivesCount.total },
      sons_in_law: { total: sonsTotal.total, withoutId: sonsCount.total, withId: sonsTotal.total - sonsCount.total }
    }
  };
}

// 清理所有无ID记录（循环删除直到删完）
async function cleanAllWithoutId() {
  let wivesDeleted = 0;
  let sonsDeleted = 0;
  
  // 删除无ID的媳妇
  while (true) {
    const { data } = await db.collection('wives').where({ wifeId: db.command.exists(false) }).limit(1000).get();
    if (data.length === 0) break;
    const ids = data.map(w => w._id);
    await db.collection('wives').where({ _id: db.command.in(ids) }).remove();
    wivesDeleted += ids.length;
  }
  
  // 删除无ID的女婿
  while (true) {
    const { data } = await db.collection('sons_in_law').where({ sonId: db.command.exists(false) }).limit(1000).get();
    if (data.length === 0) break;
    const ids = data.map(s => s._id);
    await db.collection('sons_in_law').where({ _id: db.command.in(ids) }).remove();
    sonsDeleted += ids.length;
  }
  
  return { success: true, message: `清理完成：删除 ${wivesDeleted} 条媳妇记录，${sonsDeleted} 条女婿记录` };
}

// 为 members 表生成 memberId（M开头）
async function fixMemberIds() {
  const members = await db.collection('members').get();
  let fixed = 0;
  
  for (let i = 0; i < members.data.length; i++) {
    const member = members.data[i];
    if (!member.memberId) {
      const memberId = 'M' + String(i + 1).padStart(6, '0');
      await db.collection('members').doc(member._id).update({
        data: { memberId }
      });
      fixed++;
    }
  }
  
  return { success: true, message: `已为 ${fixed} 条族人记录生成 memberId` };
}

// 修复 wives 表的 spouseId 关联（基于 husbandId 关联到 members.spouseId）
async function fixWifesSpouseId() {
  const wives = await db.collection('wives').where({ wifeId: db.command.exists(true) }).get();
  let fixed = 0;
  
  for (const wife of wives.data) {
    if (wife.husbandId && !wife.spouseId) {
      // 查找对应的男族人
      const husbands = await db.collection('members')
        .where({ originalId: String(wife.husbandId) })
        .limit(1)
        .get();
      
      if (husbands.data.length > 0) {
        const husband = husbands.data[0];
        // 更新媳妇的 spouseId（关联到丈夫的 memberId 或 originalId）
        const spouseId = husband.memberId || husband.originalId || husband._id;
        await db.collection('wives').doc(wife._id).update({
          data: { spouseId: spouseId }
        });
        
        // 同时更新丈夫的 spouseId
        if (husband.spouseId !== wife.wifeId) {
          await db.collection('members').doc(husband._id).update({
            data: { spouseId: wife.wifeId }
          });
        }
        fixed++;
      }
    }
  }
  
  return { success: true, message: `已修复 ${fixed} 条媳妇记录的配偶关联` };
}

// 修复 sons_in_law 表的 spouseId 关联（基于 wifeId 关联到 members.spouseId）
async function fixSonsSpouseId() {
  const sons = await db.collection('sons_in_law').where({ sonId: db.command.exists(true) }).get();
  let fixed = 0;
  
  for (const son of sons.data) {
    if (son.wifeId && !son.spouseId) {
      // 查找对应的罗氏女儿
      const wives = await db.collection('members')
        .where({ originalId: String(son.wifeId), gender: '女' })
        .limit(1)
        .get();
      
      if (wives.data.length > 0) {
        const wife = wives.data[0];
        // 更新女婿的 spouseId
        const spouseId = wife.memberId || wife.originalId || wife._id;
        await db.collection('sons_in_law').doc(son._id).update({
          data: { spouseId: spouseId }
        });
        
        // 同时更新妻子的 spouseId
        if (wife.spouseId !== son.sonId) {
          await db.collection('members').doc(wife._id).update({
            data: { spouseId: son.sonId }
          });
        }
        fixed++;
      }
    }
  }
  
  return { success: true, message: `已修复 ${fixed} 条女婿记录的配偶关联` };
}

// 调试：统计同 maidenName+husbandId 的记录数
async function debugWifeDuplicates() {
  const wives = await db.collection('wives').get();
  const groups = {};
  for (const wife of wives.data) {
    const key = `${wife.maidenName || ''}|${wife.husbandId || ''}|${wife.generation || ''}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push({ _id: wife._id, name: wife.name, maidenName: wife.maidenName, husbandId: wife.husbandId });
  }
  // 只显示有重复的组
  const duplicates = Object.entries(groups).filter(([k, v]) => v.length > 1);
  return { success: true, totalRecords: wives.data.length, duplicateGroups: duplicates };
}

// 媳妇去重（maidenName + husbandId + generation 都相同才算重复）
async function dedupeWives() {
  const wives = await db.collection('wives').get();
  const seen = new Map();
  const toDelete = [];
  
  for (const wife of wives.data) {
    const key = `${wife.maidenName || ''}|${wife.husbandId || ''}|${wife.generation || ''}`;
    if (seen.has(key)) {
      toDelete.push(wife._id);
    } else {
      seen.set(key, wife._id);
    }
  }
  
  let deleted = 0;
  for (const id of toDelete) {
    await db.collection('wives').doc(id).remove();
    deleted++;
  }
  
  return { success: true, message: `删除 ${deleted} 条重复记录，保留 ${seen.size} 条` };
}

// 女婿去重（name + wifeId 都相同才算重复）
async function dedupeSonsInLaw() {
  const sons = await db.collection('sons_in_law').get();
  const seen = new Map();
  const toDelete = [];
  
  for (const son of sons.data) {
    const key = `${son.name || ''}|${son.wifeId || ''}`;
    if (seen.has(key)) {
      toDelete.push(son._id);
    } else {
      seen.set(key, son._id);
    }
  }
  
  let deleted = 0;
  for (const id of toDelete) {
    await db.collection('sons_in_law').doc(id).remove();
    deleted++;
  }
  
  return { success: true, message: `删除 ${deleted} 条重复记录，保留 ${seen.size} 条` };
}

// 调试查询成员
async function debugMember(params) {
  const { name } = params;
  
  if (!name) {
    return { success: false, message: '请提供 name 参数' };
  }
  
  // 先精确匹配
  let { data } = await db.collection('members')
    .where({ name })
    .limit(5)
    .get();
  
  // 如果没找到，尝试模糊匹配
  if (data.length === 0) {
    const reg = new RegExp(name);
    const { data: allMembers } = await db.collection('members')
      .limit(100)
      .get();
    data = allMembers.filter(m => m.name && m.name.includes(name));
  }
  
  if (data.length === 0) {
    return { success: false, message: `未找到姓名为"${name}"的族人` };
  }
  
  const member = data[0];
  return {
    success: true,
    data: {
      name: member.name,
      originalId: member.originalId,
      generation: member.generation,
      education: member.education,
      positions: member.positions,
      allFields: Object.keys(member),
      matchCount: data.length
    }
  };
}

// 初始化荣誉榜数据
async function initHonorData(params) {
  const { actionType } = params || {};

  // 确保集合存在
  await ensureHonorCollections();
  
  if (actionType === 'init') {
    // 初始化族长数据
    const patriarchsData = [
      { name: '罗公瑾', title: '一世基祖', generation: 1, branch: '中和堂', branchTitle: '初代基祖', originRegion: '未知', achievements: '罗氏迁高洲始祖', sortOrder: 1 },
      { name: '罗浩然', title: '十一世', generation: 11, branch: '中和堂', branchTitle: '安福基祖', originRegion: '安福', achievements: '安福分支始祖', sortOrder: 2 },
      { name: '罗原', title: '十四世', generation: 14, branch: '忠爱堂', branchTitle: '鹧湖基祖', originRegion: '鹧湖', achievements: '鹧湖分支始祖', sortOrder: 3 },
      { name: '罗筮元', title: '十六世', generation: 16, branch: '德裕堂', branchTitle: '高洲基祖', originRegion: '高洲', achievements: '高洲分支始祖', sortOrder: 4 },
      { name: '罗英', title: '十八世', generation: 18, branch: '明儒堂', branchTitle: '明儒堂基祖', originRegion: '高洲', achievements: '明儒堂始祖', sortOrder: 5 },
      { name: '罗华', title: '十八世', generation: 18, branch: '德裕堂', branchTitle: '德裕堂基祖', originRegion: '高洲', achievements: '德裕堂始祖', sortOrder: 6 },
      { name: '罗芬', title: '十八世', generation: 18, branch: '忠爱堂', branchTitle: '忠爱堂基祖', originRegion: '高洲', achievements: '忠爱堂始祖', sortOrder: 7 }
    ];
    
    let added = 0;
    let updated = 0;
    for (const patriarch of patriarchsData) {
      const fullName = clanifyPersonName(patriarch.name);
      const exist = await db.collection('patriarchs')
        .where({ generation: patriarch.generation, branch: patriarch.branch })
        .limit(1)
        .get();
      if (exist.data && exist.data.length) {
        const row = exist.data[0];
        if (row.name !== fullName) {
          await db.collection('patriarchs').doc(row._id).update({
            data: {
              name: fullName,
              title: patriarch.title,
              branchTitle: patriarch.branchTitle,
              originRegion: patriarch.originRegion,
              achievements: patriarch.achievements,
              sortOrder: patriarch.sortOrder,
              updatedAt: db.serverDate()
            }
          });
          updated++;
        }
      } else {
        await db.collection('patriarchs').add({
          data: {
            ...patriarch,
            name: fullName,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
          }
        });
        added++;
      }
    }
    
    return { success: true, message: '族长数据初始化完成', data: { added, updated } };
  }
  
  if (actionType === 'syncFromMembers') {
    // 直接查询有 education 或 positions 字段的记录
    const debug = {
      total: 0,
      withEducation: 0,
      withPositions: 0,
      sampleEducation: [],
      samplePositions: []
    };
    
    // 查询所有记录 - 使用分页获取全部数据
    const allMembers = [];
    const pageSize = 500;
    let hasMore = true;
    let skip = 0;
    
    while (hasMore) {
      const result = await db.collection('members')
        .field({ _id: true, name: true, originalId: true, generation: true, birthDate: true, positions: true, education: true, isAlive: true })
        .skip(skip)
        .limit(pageSize)
        .get();
      
      allMembers.push(...result.data);
      skip += pageSize;
      hasMore = result.data.length === pageSize;
      
      if (allMembers.length >= 1500) break; // 限制处理数量
    }
    
    const members = { data: allMembers };
    
    debug.total = members.data.length;
    
    let synced = { elite: 0, graduates: 0, sages: 0 };
    
    // 统计有数据的记录
    for (const member of members.data) {
      if (member.education && member.education.length > 0) {
        debug.withEducation++;
        if (debug.sampleEducation.length < 2) {
          debug.sampleEducation.push({ name: member.name, education: member.education });
        }
      }
      if (member.positions && member.positions.length > 0) {
        debug.withPositions++;
        if (debug.samplePositions.length < 3) {
          debug.samplePositions.push({ name: member.name, positions: member.positions });
        }
      }
      
      // 处理学历 -> graduates
      // education 可能是字符串数组如 ["大学", "永新师范"] 或对象数组 [{degree, school}]
      if (member.education && Array.isArray(member.education) && member.education.length > 0) {
        for (const edu of member.education) {
          // edu 可能是字符串如 "大学" 或对象 { degree, school, ... }
          const degree = typeof edu === 'string' ? edu : (edu.degree || '');
          const school = typeof edu === 'string' ? '' : (edu.school || '');
          
          // 判断是否本科及以上
          const highDegrees = ['本科', '学士', '硕士', '博士', '博士后', '博学鸿儒', '大学'];
          if (highDegrees.some(d => degree.includes(d))) {
            const exist = await db.collection('graduates').where({ memberId: String(member.originalId), name: member.name }).count();
            if (exist.total === 0) {
              await db.collection('graduates').add({
                data: {
                  name: member.name,
                  generation: member.generation,
                  memberId: String(member.originalId),
                  degree: degree,
                  school: school,
                  major: '',
                  graduationYear: null,
                  createdAt: db.serverDate(),
                  updatedAt: db.serverDate()
                }
              });
              synced.graduates++;
            }
          }
        }
      }
      
      // 处理职位 -> sages（历史乡贤）
      // 建国后群英榜已改为「当今族人撷英」固定七人，不再从 positions 同步到 elite
      if (member.positions && Array.isArray(member.positions) && member.positions.length > 0) {
        const birthYear = member.birthDate?.gregorian?.year || null;
        const deathYear = member.deathDate?.gregorian?.year || null;
        const isPost1949 = (birthYear && birthYear >= 1949) ||
                          (deathYear && deathYear >= 1949) ||
                          (member.isAlive === true && birthYear && birthYear >= 1949);
        const isHistorical = member.generation && member.generation <= 25 && (!birthYear || birthYear < 1949);

        // 1949 年后公职人物跳过（群英榜独立维护）
        if (isPost1949 && !isHistorical) {
          continue;
        }

        for (const pos of member.positions) {
          const title = typeof pos === 'string' ? pos : (pos.title || '');
          const organization = typeof pos === 'string' ? '' : (pos.organization || '');

          if (title) {
            const exist = await db.collection('sages').where({ memberId: String(member.originalId), position: title }).count();
            if (exist.total === 0) {
              await db.collection('sages').add({
                data: {
                  name: member.name,
                  generation: member.generation,
                  memberId: String(member.originalId),
                  achievementType: '公职',
                  position: title,
                  organization: organization,
                  level: '',
                  birthYear: birthYear,
                  isAlive: member.isAlive !== false,
                  createdAt: db.serverDate(),
                  updatedAt: db.serverDate()
                }
              });
              synced.sages++;
            }
          }
        }
      }
    }
    
    return { success: true, message: '同步完成', data: { ...synced, debug } };
  }
  
  return { success: false, message: '未知操作' };
}

/**
 * 根据备注重建成员配偶字段，并重建 wives 表
 * params.clearWives=true 时先清空 wives
 */
async function repairSpouseFromRemark(params = {}) {
  const clearWives = params.clearWives !== false;
  const stats = {
    membersScanned: 0,
    spouseUpdated: 0,
    motherFixed: 0,
    villageLinked: 0,
    wivesWritten: 0,
    wivesRemoved: 0
  };

  // 拉取全部成员到内存
  const allMembers = [];
  let skip = 0;
  const pageSize = 100;
  while (true) {
    const { data } = await db.collection('members')
      .field({
        _id: true,
        name: true,
        gender: true,
        originalId: true,
        generation: true,
        remark: true,
        fatherId: true,
        motherId: true,
        motherName: true,
        spouseId: true,
        spouseName: true,
        spouseInfo: true
      })
      .skip(skip)
      .limit(pageSize)
      .get();
    if (!data.length) break;
    allMembers.push(...data);
    skip += pageSize;
    if (data.length < pageSize) break;
  }

  stats.membersScanned = allMembers.length;
  const byOriginalId = new Map();
  allMembers.forEach(m => byOriginalId.set(String(m.originalId), m));

  // 1) 备注解析配偶
  for (const member of allMembers) {
    const spouses = parseSpousesFromRemark(member.remark || '');
    if (spouses.length) {
      member.spouseName = spouses[0].name;
      member.spouseInfo = spousesToSpouseInfo(spouses);
      stats.spouseUpdated++;
    } else if (member.spouseName) {
      member.spouseName = normalizeSpouseName(member.spouseName);
    }
  }

  // 2) 本村双向匹配
  const links = linkSameVillageSpouses(allMembers);
  stats.villageLinked = links.length;

  // 3) 母亲修正
  for (const member of allMembers) {
    const fatherId = member.fatherId != null ? String(member.fatherId) : '';
    const motherId = member.motherId != null ? String(member.motherId) : '';
    if (fatherId && motherId && fatherId === motherId) {
      member.motherId = '';
      stats.motherFixed++;
    }
    if (fatherId) {
      const father = byOriginalId.get(fatherId);
      if (father) {
        const fatherSpouses = parseSpousesFromRemark(father.remark || '');
        const resolved = fatherSpouses.length
          ? fatherSpouses[0].name
          : normalizeSpouseName(father.spouseName || '');
        if (resolved && resolved !== member.motherName) {
          member.motherName = resolved;
          stats.motherFixed++;
        }
      }
    }
  }

  // 4) 写回 members
  for (const member of allMembers) {
    await db.collection('members').doc(member._id).update({
      data: {
        spouseId: member.spouseId || '',
        spouseName: member.spouseName || '',
        spouseInfo: member.spouseInfo || [],
        motherId: member.motherId || '',
        motherName: member.motherName || '',
        updatedAt: db.serverDate()
      }
    });
  }

  // 5) 重建 wives
  if (clearWives) {
    while (true) {
      const { data } = await db.collection('wives').limit(100).field({ _id: true }).get();
      if (!data.length) break;
      await Promise.all(data.map(item => db.collection('wives').doc(item._id).remove()));
      stats.wivesRemoved += data.length;
    }
  }

  for (const member of allMembers) {
    if (member.gender === '女') continue;
    const spouses = parseSpousesFromRemark(member.remark || '');
    const list = spouses.length
      ? spouses
      : (member.spouseName
        ? [{
          name: member.spouseName,
          maidenName: member.spouseName,
          hometown: member.spouseId ? '本村' : '',
          marriageType: '配',
          sourceText: member.spouseName,
          isSameVillage: !!member.spouseId
        }]
        : []);

    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      let name = s.name;
      let linkedMemberId = '';
      if (s.isSameVillage && member.spouseId) {
        name = member.spouseName || name;
        linkedMemberId = String(member.spouseId);
      }
      await db.collection('wives').add({
        data: {
          name,
          maidenName: s.maidenName || name,
          hometown: s.hometown || (linkedMemberId ? '本村' : ''),
          generation: member.generation,
          husbandId: String(member.originalId),
          husbandName: member.name,
          marriageType: s.marriageType || '配',
          marriageOrder: i + 1,
          marriageStatus: 'married',
          linkedMemberId,
          burialPlace: '',
          remark: (member.remark || '').slice(0, 200),
          sourceMemberId: member._id,
          sourceText: s.sourceText || name,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
      stats.wivesWritten++;
    }
  }

  return {
    success: true,
    message: '配偶/母亲数据已按备注修正（含本村双向匹配）',
    data: { ...stats, links: links.slice(0, 20) }
  };
}

function getAchievementType(position) {
  const title = position.title || '';
  const org = position.organization || '';
  
  if (org.includes('党委') || org.includes('政府') || org.includes('人大') || org.includes('政协') || title.includes('书记') || title.includes('长')) {
    return '政务';
  }
  if (org.includes('部队') || org.includes('军') || title.includes('司令') || title.includes('军官')) {
    return '军事';
  }
  if (org.includes('学校') || org.includes('大学') || org.includes('学院') || title.includes('教授') || title.includes('教师')) {
    return '教育';
  }
  if (title.includes('总') || title.includes('董') || title.includes('经理') || title.includes('企业家')) {
    return '企业';
  }
  if (org.includes('医院') || org.includes('研究所') || title.includes('医生') || title.includes('工程师')) {
    return '科研';
  }
  return '其他';
}

// ==================== 运营：登录账号 / 开发者留言 ====================

function maskPhoneAdmin(phone) {
  const p = String(phone || "");
  if (p.length < 7) return p;
  return p.slice(0, 3) + "****" + p.slice(-4);
}

function formatTime(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (value.$date) return value.$date;
  try {
    return new Date(value).toISOString();
  } catch (e) {
    return String(value);
  }
}

async function listAccounts(params) {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
  const keyword = String(params.keyword || "").trim();

  let query = db.collection("user_accounts");
  if (keyword) {
    // 云开发单字段模糊：优先精确匹配姓名；也可用 phone
    query = query.where({
      name: db.RegExp({ regexp: keyword, options: "i" })
    });
  }

  const countResult = await query.count();
  const total = countResult.total;

  let data = [];
  try {
    const res = await query
      .orderBy("createTime", "desc")
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    data = res.data || [];
  } catch (e) {
    // 无索引时降级
    const res = await query.skip((page - 1) * pageSize).limit(pageSize).get();
    data = res.data || [];
  }

  const list = data.map((row) => ({
    _id: row._id,
    name: row.name || "",
    phoneMasked: maskPhoneAdmin(row.phone),
    personId: row.personId || "",
    originalId: row.originalId != null ? row.originalId : null,
    verifyStatus: row.verifyStatus || "",
    wechatId: row.wechatId || "",
    createTime: formatTime(row.createTime),
    updateTime: formatTime(row.updateTime)
  }));

  return { success: true, data: list, total, page, pageSize };
}

/**
 * 管理员强制解绑：删除 user_accounts，并清空成员上的手机/微信等绑定字段
 * @param {{ _id?: string, accountId?: string }} data
 */
async function forceUnbindAccount(data) {
  const accountId = (data && (data._id || data.accountId)) || '';
  if (!accountId) {
    return { success: false, message: '缺少账号 ID' };
  }

  const _ = db.command;
  let account = null;
  try {
    const res = await db.collection('user_accounts').doc(accountId).get();
    account = res.data;
  } catch (e) {
    return { success: false, message: '账号不存在或已删除' };
  }
  if (!account) {
    return { success: false, message: '账号不存在或已删除' };
  }

  const personId = account.personId || '';
  const openid = account.openid || '';
  let memberCleared = false;
  let ticketsRemoved = 0;

  if (personId) {
    try {
      await db.collection('members').doc(personId).update({
        data: {
          phone: '',
          wechat: '',
          boundOpenId: _.remove(),
          boundAccountId: _.remove(),
          boundPhone: _.remove(),
          updatedAt: db.serverDate()
        }
      });
      memberCleared = true;
    } catch (e) {
      console.log('forceUnbind clear member skip', e.message || e);
    }
  }

  if (openid) {
    try {
      for (;;) {
        const { data: tickets } = await db.collection('verify_tickets')
          .where({ openid })
          .limit(50)
          .get();
        if (!tickets || !tickets.length) break;
        await Promise.all(tickets.map(doc => db.collection('verify_tickets').doc(doc._id).remove()));
        ticketsRemoved += tickets.length;
        if (tickets.length < 50) break;
      }
    } catch (e) {
      console.log('forceUnbind clear tickets skip', e.message || e);
    }
  }

  await db.collection('user_accounts').doc(accountId).remove();

  return {
    success: true,
    message: `已强制解绑「${account.name || ''}」`,
    data: {
      accountId,
      personId,
      name: account.name || '',
      phoneMasked: maskPhoneAdmin(account.phone),
      memberCleared,
      ticketsRemoved
    }
  };
}

async function listDevMessages(params) {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
  const status = String(params.status || "").trim();

  let query = db.collection("dev_messages");
  if (status) {
    query = query.where({ status });
  }

  const countResult = await query.count();
  const total = countResult.total;

  let data = [];
  try {
    const res = await query
      .orderBy("createTime", "desc")
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    data = res.data || [];
  } catch (e) {
    const res = await query.skip((page - 1) * pageSize).limit(pageSize).get();
    data = res.data || [];
  }

  const list = (data || []).map((row) => ({
    _id: row._id,
    name: row.name || "",
    phone: row.phone || "",
    wechat: row.wechat || "",
    content: row.content || "",
    personId: row.personId || "",
    accountName: row.accountName || "",
    status: row.status || "pending",
    createTime: formatTime(row.createTime)
  }));

  return { success: true, data: list, total, page, pageSize };
}

async function markDevMessageRead(data) {
  const id = data && data._id;
  if (!id) return { success: false, message: "缺少留言ID" };
  await db.collection("dev_messages").doc(id).update({
    data: {
      status: "read",
      readTime: db.serverDate()
    }
  });
  return { success: true, message: "已标记为已读" };
}

async function getOpsStats() {
  const accounts = await db.collection("user_accounts").count();
  const messages = await db.collection("dev_messages").count();
  let pending = 0;
  try {
    const pendingRes = await db.collection("dev_messages").where({ status: "pending" }).count();
    pending = pendingRes.total;
  } catch (e) {
    pending = 0;
  }
  return {
    success: true,
    data: {
      accountTotal: accounts.total,
      messageTotal: messages.total,
      messagePending: pending
    }
  };
}
