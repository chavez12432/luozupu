/**
 * 云函数代理服务器
 * - /call/:fn 转发云函数
 * - /members/* 直连云库 CRUD，并同步本地 database/members_export.json
 *   （小程序 DATA_MODE=local 依赖该文件）
 */
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const cloud = require('@cloudbase/node-sdk');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const CLOUD_ENV = process.env.CLOUDBASE_ENV_ID;
const SECRET_ID = process.env.CLOUDBASE_SECRETID;
const SECRET_KEY = process.env.CLOUDBASE_SECRETKEY;

const {
  PATHS,
  parseMembersFile,
  writeSplitFiles,
  upsertMember,
  deleteMember,
  readAllMembers
} = require('../../utils/memberDbSplit');
const { assignMemberIdsForCreate } = require('../../utils/memberIdAssign');

const MEMBERS_LOCAL = PATHS.membersAll;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

let appInstance = null;

function getApp() {
  if (appInstance) return appInstance;
  if (!CLOUD_ENV || !SECRET_ID || !SECRET_KEY || SECRET_ID.includes('your-')) {
    throw new Error('请在 proxy-server/.env 配置 CLOUDBASE_ENV_ID / SECRETID / SECRETKEY');
  }
  appInstance = cloud.init({
    env: CLOUD_ENV,
    secretId: SECRET_ID,
    secretKey: SECRET_KEY
  });
  return appInstance;
}

function getDb() {
  return getApp().database();
}

function readLocalMembers() {
  const fromMerge = parseMembersFile(MEMBERS_LOCAL);
  if (fromMerge.length) return fromMerge;
  return [...parseMembersFile(PATHS.ancient), ...parseMembersFile(PATHS.modern)];
}

function writeLocalMembers(list) {
  writeSplitFiles(list);
}

function upsertLocalMember(doc) {
  if (!doc || (!doc._id && !doc.memberId)) {
    return { ok: false, message: '缺少 _id 或 memberId' };
  }
  upsertMember(doc);
  return { ok: true };
}

function deleteLocalMember(id) {
  deleteMember(id);
  return { ok: true, removed: 1 };
}

function cleanUpdatePayload(data) {
  const skip = new Set(['_id', '_fatherName', '_motherName', '_spouseName']);
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (skip.has(k)) continue;
    if (v === undefined) continue;
    if ((k === 'memberId' || k === 'originalId') && v === '') continue;
    out[k] = v;
  }
  out.updatedAt = new Date().toISOString();
  return out;
}

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: '云函数代理服务器运行中（node-sdk + 本地同步）',
    env: CLOUD_ENV || null,
    localMembers: PATHS.membersAll,
    splitAncient: PATHS.ancient,
    splitModern: PATHS.modern
  });
});

app.post('/call/:functionName', async (req, res) => {
  const { functionName } = req.params;
  const data = req.body || {};

  console.log(`\n=== 调用云函数: ${functionName} ===`);
  console.log('数据:', JSON.stringify(data).slice(0, 500));

  try {
    const tcb = getApp();
    const result = await tcb.callFunction({
      name: functionName,
      data
    });
    const payload = result && result.result != null ? result.result : result;
    res.json(payload);
  } catch (error) {
    console.error('调用云函数失败:', error.message || error);
    res.status(500).json({
      success: false,
      message: error.message || '调用云函数失败',
      error: String(error)
    });
  }
});

function unwrapDoc(result) {
  if (!result) return null;
  if (Array.isArray(result.data)) return result.data[0] || null;
  return result.data || null;
}

/** 直连更新成员：写云库 + 同步本地 JSON */
app.post('/members/update', async (req, res) => {
  try {
    const body = req.body || {};
    const _id = body._id;
    if (!_id) return res.status(400).json({ success: false, message: '缺少 _id' });

    const patch = cleanUpdatePayload(body);
    const db = getDb();
    await db.collection('members').doc(_id).update(patch);

    const got = await db.collection('members').doc(_id).get();
    const full = unwrapDoc(got) || { _id, ...patch };
    upsertLocalMember(full);

    console.log(`[members/update] ${_id} → 云库+本地已同步`);
    res.json({ success: true, data: full, syncedLocal: true });
  } catch (error) {
    console.error('members/update 失败:', error);
    res.status(500).json({ success: false, message: error.message || String(error) });
  }
});

/** 直连创建成员 */
app.post('/members/create', async (req, res) => {
  try {
    const body = req.body || {};
    const db = getDb();
    let doc = cleanUpdatePayload(body);
    doc = await assignMemberIdsForCreate(db, doc, readAllMembers());
    delete doc.updatedAt;
    doc.createdAt = new Date().toISOString();
    doc.updatedAt = doc.createdAt;

    const result = await db.collection('members').add(doc);
    const _id = result.id;
    const full = { _id, ...doc };
    upsertLocalMember(full);

    console.log(`[members/create] ${_id} ${full.memberId} originalId=${full.originalId}`);
    res.json({
      success: true,
      data: { _id, memberId: full.memberId, originalId: full.originalId },
      syncedLocal: true
    });
  } catch (error) {
    console.error('members/create 失败:', error);
    res.status(500).json({ success: false, message: error.message || String(error) });
  }
});

/** 直连删除 */
app.post('/members/delete', async (req, res) => {
  try {
    const { _id } = req.body || {};
    if (!_id) return res.status(400).json({ success: false, message: '缺少 _id' });
    await getDb().collection('members').doc(_id).remove();
    deleteLocalMember(_id);
    res.json({ success: true, syncedLocal: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || String(error) });
  }
});

/** 导出全部族人（不分页、不补全亲属，适合 Excel） */
app.get('/members/export-all', async (req, res) => {
  try {
    const db = getDb();
    const PAGE = 100;
    let skip = 0;
    const all = [];

    for (;;) {
      const { data } = await db
        .collection('members')
        .skip(skip)
        .limit(PAGE)
        .get();
      if (!data.length) break;
      all.push(...data);
      if (data.length < PAGE) break;
      skip += PAGE;
    }

    res.json({ success: true, data: all, total: all.length });
  } catch (error) {
    console.error('export-all 失败:', error);
    res.status(500).json({ success: false, message: error.message || String(error) });
  }
});

/** 荣誉榜直连云库（不依赖云函数部署，避免 add/update 带脏字段失败） */
const HONOR_COLLECTIONS = new Set(['patriarchs', 'sages', 'elite']);

function cleanHonorPayload(data) {
  const skip = new Set([
    '_id', '_openid', 'createdAt', 'updatedAt',
    'hasLink', 'paragraphs', 'titles', 'titleText', 'educations', 'birthText', 'dynastyEra'
  ]);
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (skip.has(k)) continue;
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

function isCollectionMissingError(err) {
  const msg = String((err && (err.message || err.errMsg || err)) || '');
  const code = err && (err.code || err.errCode);
  return (
    code === -502005 ||
    code === 'DATABASE_COLLECTION_NOT_EXIST' ||
    /collection not exists|Db or Table not exist|DATABASE_COLLECTION_NOT_EXIST|-502005/i.test(msg)
  );
}

async function ensureHonorCollection(name) {
  const db = getDb();
  try {
    if (typeof db.createCollection === 'function') {
      await db.createCollection(name);
      console.log('[honor] 已创建集合:', name);
      return;
    }
  } catch (e) {
    if (!isCollectionMissingError(e)) {
      console.log('[honor] createCollection', name, e.message || e);
    }
  }
  // 无 createCollection 时：写一条再删，触发建表
  try {
    const addRes = await db.collection(name).add({
      _honorBootstrap: true,
      createdAt: new Date().toISOString()
    });
    const id = addRes && (addRes.id || addRes._id);
    if (id) {
      try { await db.collection(name).doc(id).remove(); } catch (_) { /* ignore */ }
    }
    console.log('[honor] 通过写入引导创建集合:', name);
  } catch (e2) {
    console.error('[honor] 无法创建集合', name, e2.message || e2);
    throw e2;
  }
}

app.post('/honor/:collection/list', async (req, res) => {
  try {
    const { collection } = req.params;
    if (!HONOR_COLLECTIONS.has(collection)) {
      return res.status(400).json({ success: false, message: '非法集合' });
    }
    const page = Math.max(1, Number(req.body.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.body.pageSize) || 100));
    const db = getDb();
    const where = {};
    if (collection === 'sages' && req.body.dynasty) where.dynasty = req.body.dynasty;
    if (collection === 'elite' && req.body.achievementType) where.achievementType = req.body.achievementType;
    if (collection === 'patriarchs' && req.body.branch) where.branch = req.body.branch;

    let total = 0;
    let data = [];
    try {
      let query = db.collection(collection);
      if (Object.keys(where).length) query = query.where(where);
      const countRes = await query.count();
      total = countRes.total || 0;
      try {
        const orderField = collection === 'patriarchs' || collection === 'elite' ? 'sortOrder' : 'generation';
        const got = await query.orderBy(orderField, 'asc').skip((page - 1) * pageSize).limit(pageSize).get();
        data = got.data || [];
      } catch (e) {
        const got = await query.skip((page - 1) * pageSize).limit(pageSize).get();
        data = got.data || [];
      }
    } catch (error) {
      if (isCollectionMissingError(error)) {
        await ensureHonorCollection(collection);
        total = 0;
        data = [];
      } else {
        throw error;
      }
    }
    res.json({ success: true, data, total, page, pageSize });
  } catch (error) {
    console.error('honor list 失败:', error);
    res.status(500).json({ success: false, message: error.message || String(error) });
  }
});

app.post('/honor/:collection/get', async (req, res) => {
  try {
    const { collection } = req.params;
    const _id = req.body && req.body._id;
    if (!HONOR_COLLECTIONS.has(collection) || !_id) {
      return res.status(400).json({ success: false, message: '参数错误' });
    }
    try {
      const got = await getDb().collection(collection).doc(_id).get();
      const item = unwrapDoc(got);
      if (!item) return res.status(404).json({ success: false, message: '未找到记录' });
      return res.json({ success: true, data: item });
    } catch (error) {
      if (isCollectionMissingError(error)) {
        await ensureHonorCollection(collection);
        return res.status(404).json({ success: false, message: '未找到记录（集合已新建，请先重置/导入数据）' });
      }
      throw error;
    }
  } catch (error) {
    console.error('honor get 失败:', error);
    res.status(500).json({ success: false, message: error.message || String(error) });
  }
});

app.post('/honor/:collection/create', async (req, res) => {
  try {
    const { collection } = req.params;
    if (!HONOR_COLLECTIONS.has(collection)) {
      return res.status(400).json({ success: false, message: '非法集合' });
    }
    const payload = cleanHonorPayload(req.body || {});
    if (!payload.name) return res.status(400).json({ success: false, message: '姓名不能为空' });
    const now = new Date().toISOString();
    payload.createdAt = now;
    payload.updatedAt = now;
    let result;
    try {
      result = await getDb().collection(collection).add(payload);
    } catch (error) {
      if (isCollectionMissingError(error)) {
        await ensureHonorCollection(collection);
        result = await getDb().collection(collection).add(payload);
      } else {
        throw error;
      }
    }
    const _id = result.id || result._id;
    res.json({ success: true, data: { _id }, message: '创建成功' });
  } catch (error) {
    console.error('honor create 失败:', error);
    res.status(500).json({ success: false, message: error.message || String(error) });
  }
});

app.post('/honor/:collection/update', async (req, res) => {
  try {
    const { collection } = req.params;
    const body = req.body || {};
    const _id = body._id;
    if (!HONOR_COLLECTIONS.has(collection) || !_id) {
      return res.status(400).json({ success: false, message: '参数错误' });
    }
    const payload = cleanHonorPayload(body);
    payload.updatedAt = new Date().toISOString();
    if (Object.prototype.hasOwnProperty.call(body, 'achievements')) {
      payload.achievements = body.achievements == null ? '' : String(body.achievements);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'biography')) {
      payload.biography = body.biography == null ? '' : String(body.biography);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'summary')) {
      payload.summary = body.summary == null ? '' : String(body.summary);
    }
    try {
      await getDb().collection(collection).doc(_id).update(payload);
    } catch (error) {
      if (isCollectionMissingError(error)) {
        await ensureHonorCollection(collection);
        return res.status(404).json({ success: false, message: '集合刚创建，记录不存在，请先新增或重置七人' });
      }
      throw error;
    }
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('honor update 失败:', error);
    res.status(500).json({ success: false, message: error.message || String(error) });
  }
});

app.post('/honor/:collection/delete', async (req, res) => {
  try {
    const { collection } = req.params;
    const _id = req.body && req.body._id;
    if (!HONOR_COLLECTIONS.has(collection) || !_id) {
      return res.status(400).json({ success: false, message: '参数错误' });
    }
    try {
      await getDb().collection(collection).doc(_id).remove();
    } catch (error) {
      if (isCollectionMissingError(error)) {
        await ensureHonorCollection(collection);
        return res.json({ success: true, message: '集合不存在，已自动创建' });
      }
      throw error;
    }
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('honor delete 失败:', error);
    res.status(500).json({ success: false, message: error.message || String(error) });
  }
});

/** 仅同步本地（云库已更新时用） */
app.post('/local/members/upsert', (req, res) => {
  try {
    const result = upsertLocalMember(req.body || {});
    if (!result.ok) return res.status(400).json({ success: false, message: result.message });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || String(error) });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`代理服务器: http://localhost:${PORT}`);
  console.log(`云环境: ${CLOUD_ENV || '(未配置)'}`);
  console.log(`本地族人: ${MEMBERS_LOCAL}`);
  console.log(`POST /members/update  /members/create  /members/delete`);
  console.log(`GET  /members/export-all`);
  console.log(`POST /honor/{patriarchs|sages|elite}/{list|get|create|update|delete}`);
  console.log(`POST /call/{云函数名}`);
});
