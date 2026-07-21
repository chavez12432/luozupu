/**
 * 认证用户：本人及直系家属增删改
 * actions: getPermission | updateMember | deleteMember | addFamily
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const COL_ACCOUNTS = 'user_accounts';
const COL_MEMBERS = 'members';

const EDITABLE_FIELDS = [
  'name', 'gender', 'phone', 'wechat', 'residence', 'burialPlace', 'remark',
  'photo', 'avatar', 'education', 'honors', 'positions', 'workplaces', 'birthDate', 'deathDate'
];

const MAX_MULTI = 5;

function ok(data = {}) {
  return Object.assign({ success: true }, data);
}

function fail(message, extra = {}) {
  return Object.assign({ success: false, message }, extra);
}

function oid(v) {
  if (v == null || v === '') return '';
  return String(v);
}

function memberKey(m) {
  if (!m) return '';
  if (m.originalId != null && m.originalId !== '') return oid(m.originalId);
  if (m.memberId) return oid(m.memberId);
  return '';
}

function resolveRelation(viewer, target) {
  if (!viewer || !target) return 'none';
  const vid = viewer._id != null ? String(viewer._id) : '';
  const tid = target._id != null ? String(target._id) : '';
  if (vid && tid && vid === tid) return 'self';
  // 兼容 personId 与文档 id 不一致时用业务键互认
  const vKey = memberKey(viewer);
  const tKey = memberKey(target);
  if (vKey && tKey && vKey === tKey) return 'self';
  if (vKey && oid(target.fatherId) === vKey) return 'child';
  if (tKey && oid(viewer.fatherId) === tKey) return 'parent';
  if (vKey && oid(target.spouseId) === vKey) return 'spouse';
  if (tKey && oid(viewer.spouseId) === tKey) return 'spouse';
  return 'none';
}

function evaluatePermission(viewer, target, targetVerified) {
  const relation = resolveRelation(viewer, target);
  const empty = {
    relation,
    canEdit: false,
    canDelete: false,
    canAddChild: false,
    canAddSpouse: false,
    locked: false,
    lockReason: ''
  };
  if (!viewer || !target) return empty;

  if (targetVerified && relation !== 'self') {
    return Object.assign({}, empty, {
      locked: true,
      lockReason: '该成员已经完成身份认证，资料修改需要本人操作。'
    });
  }

  if (relation === 'none') return empty;

  if (relation === 'self') {
    return {
      relation,
      canEdit: true,
      canDelete: false,
      canAddChild: true,
      canAddSpouse: true,
      locked: false,
      lockReason: ''
    };
  }

  return {
    relation,
    canEdit: true,
    canDelete: (relation === 'spouse' || relation === 'child') && !targetVerified,
    canAddChild: false,
    canAddSpouse: false,
    locked: false,
    lockReason: ''
  };
}

function normalizeMultiList(list, mapFn) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_MULTI).map(mapFn).filter(Boolean);
}

function pickEditable(patch) {
  const out = {};
  EDITABLE_FIELDS.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(patch || {}, key)) {
      out[key] = patch[key];
    }
  });
  if (patch && patch.birthDate && typeof patch.birthDate === 'object') {
    out.birthDate = patch.birthDate;
  }
  if (Array.isArray(patch && patch.education)) {
    out.education = normalizeMultiList(patch.education, e => {
      if (!e) return null;
      if (typeof e === 'string') {
        const t = e.trim();
        return t ? { degree: t, school: '', year: null, major: '', isDefault: false } : null;
      }
      const degree = String(e.degree || '').trim();
      const school = String(e.school || '').trim();
      if (!degree && !school) return null;
      let year = null;
      if (e.year != null && e.year !== '') {
        const n = Number(e.year);
        year = Number.isFinite(n) ? n : null;
      }
      return {
        degree,
        school,
        year,
        major: String(e.major || '').trim(),
        isDefault: !!e.isDefault
      };
    });
  }
  if (Array.isArray(patch && patch.honors)) {
    out.honors = normalizeMultiList(patch.honors, h => {
      if (!h) return null;
      if (typeof h === 'string') {
        const t = h.trim();
        return t ? { title: t, type: 'user', description: t } : null;
      }
      const title = String(h.title || h.name || '').trim();
      if (!title) return null;
      return { title, type: h.type || 'user', description: title };
    });
  }
  if (Array.isArray(patch && patch.positions)) {
    out.positions = normalizeMultiList(patch.positions, p => {
      if (!p) return null;
      if (typeof p === 'string') {
        const t = p.trim();
        return t ? { title: t, isCurrent: false, isDefault: false } : null;
      }
      const title = String(p.title || '').trim();
      if (!title) return null;
      return { title, isCurrent: !!p.isCurrent, isDefault: !!p.isDefault };
    });
  }
  if (Array.isArray(patch && patch.workplaces)) {
    out.workplaces = normalizeMultiList(patch.workplaces, w => {
      if (!w) return null;
      if (typeof w === 'string') {
        const t = w.trim();
        return t ? { name: t, isCurrent: false } : null;
      }
      const name = String(w.name || w.organization || '').trim();
      if (!name) return null;
      return { name, title: String(w.title || '').trim(), isCurrent: !!w.isCurrent };
    });
  }
  return out;
}

/** 去掉 undefined / null / NaN，避免云库 update 因嵌套 null 报错 */
function sanitizeForCloudUpdate(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number' && Number.isNaN(value)) return undefined;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(sanitizeForCloudUpdate).filter(v => v !== undefined);
  }
  const out = {};
  Object.keys(value).forEach(k => {
    const v = sanitizeForCloudUpdate(value[k]);
    if (v !== undefined) out[k] = v;
  });
  return out;
}

async function getOpenId() {
  const ctx = cloud.getWXContext();
  return ctx.OPENID || '';
}

async function getAccountByOpenId(openid) {
  if (!openid) return null;
  const res = await db.collection(COL_ACCOUNTS).where({ openid }).limit(1).get();
  return res.data[0] || null;
}

function attachId(doc, id) {
  if (!doc) return null;
  const next = Object.assign({}, doc);
  if (!next._id && id) next._id = String(id);
  return next;
}

/** 按云 _id / originalId / memberId 解析成员（并确保带 _id） */
async function getMember(id) {
  if (id == null || id === '') return null;
  const key = String(id);

  try {
    const res = await db.collection(COL_MEMBERS).doc(key).get();
    if (res && res.data) return attachId(res.data, key);
  } catch (_) { /* continue */ }

  // 兼容 personId / 跳转 id 存的是 originalId 或 memberId
  const tries = [
    { originalId: key },
    { memberId: key }
  ];
  // 纯数字 originalId
  if (/^\d+$/.test(key)) {
    tries.unshift({ originalId: Number(key) });
  }
  for (const where of tries) {
    try {
      const res = await db.collection(COL_MEMBERS).where(where).limit(1).get();
      if (res.data && res.data[0]) {
        const row = res.data[0];
        return attachId(row, row._id);
      }
    } catch (_) { /* continue */ }
  }
  return null;
}

async function isPersonVerified(member) {
  if (!member) return false;
  const ids = [
    member._id,
    member.originalId,
    member.memberId
  ].filter(v => v != null && String(v) !== '').map(String);
  const uniq = [...new Set(ids)];
  for (const personId of uniq) {
    const res = await db.collection(COL_ACCOUNTS).where({ personId }).limit(1).get();
    if (res.data && res.data.length) return true;
  }
  return false;
}

async function getViewerContext() {
  const openid = await getOpenId();
  if (!openid) return { error: fail('无法获取微信身份') };
  const account = await getAccountByOpenId(openid);
  if (!account) return { error: fail('请先完成身份认证') };
  const viewer = await getMember(account.personId);
  if (!viewer) return { error: fail('绑定的族谱成员不存在，请重新验证身份') };
  return { openid, account, viewer };
}

async function getPermission(params) {
  const ctx = await getViewerContext();
  if (ctx.error) return ctx.error;
  const target = await getMember(params.targetId);
  if (!target) return fail('成员不存在');
  const targetVerified = await isPersonVerified(target);
  return ok({
    permission: evaluatePermission(ctx.viewer, target, targetVerified),
    viewerId: ctx.viewer._id,
    targetId: target._id
  });
}

async function updateMember(params) {
  const ctx = await getViewerContext();
  if (ctx.error) return ctx.error;
  const targetId = params.targetId || (params.data && params.data.targetId);
  const patch = params.patch || (params.data && params.data.patch) || {};
  const target = await getMember(targetId);
  if (!target || !target._id) return fail('成员不存在');
  const targetVerified = await isPersonVerified(target);
  const perm = evaluatePermission(ctx.viewer, target, targetVerified);
  if (!perm.canEdit) {
    return fail(perm.lockReason || '无权修改该成员资料');
  }
  let data = pickEditable(patch);
  data = sanitizeForCloudUpdate(data);
  if (!data || !Object.keys(data).length) return fail('没有可更新的字段');
  data.updatedAt = db.serverDate();
  try {
    await db.collection(COL_MEMBERS).doc(String(target._id)).update({ data });
  } catch (err) {
    console.error('updateMember db', target._id, err);
    return fail(err.message || '写入云库失败');
  }
  return ok({ data: { _id: target._id } });
}

async function deleteMember(params) {
  const ctx = await getViewerContext();
  if (ctx.error) return ctx.error;
  const target = await getMember(params.targetId);
  if (!target || !target._id) return fail('成员不存在');
  const targetVerified = await isPersonVerified(target);
  const perm = evaluatePermission(ctx.viewer, target, targetVerified);
  if (!perm.canDelete) {
    return fail(perm.lockReason || '无权删除该成员（仅可删除未认证的配偶或子女）');
  }
  await db.collection(COL_MEMBERS).doc(String(target._id)).remove();
  return ok();
}

async function nextOriginalId() {
  const res = await db.collection(COL_MEMBERS)
    .orderBy('originalId', 'desc')
    .limit(1)
    .get()
    .catch(() => ({ data: [] }));
  const top = res.data[0];
  const n = top && top.originalId != null ? Number(top.originalId) : 0;
  return (isNaN(n) ? 0 : n) + 1;
}

async function addFamily(params) {
  const ctx = await getViewerContext();
  if (ctx.error) return ctx.error;
  const viewer = ctx.viewer;
  const selfPerm = evaluatePermission(viewer, viewer, true);
  const relation = params.relation;
  const { withClanSurname } = require('./clanName');
  const rawName = String(params.name || '').trim();
  const gender = params.gender === '女' ? '女' : '男';
  // 族人进 members：加罗姓；姓名含「氏」视为外姓表述，不加
  const name = /氏/.test(rawName) ? rawName.replace(/^罗+/, '') : withClanSurname(rawName);
  if (!name) return fail('请填写姓名');

  if (relation === 'child' && !selfPerm.canAddChild) return fail('无权添加子女');
  if (relation === 'spouse' && !selfPerm.canAddSpouse) return fail('无权添加配偶');

  const originalId = await nextOriginalId();
  const vKey = memberKey(viewer);
  let memberData;

  if (relation === 'child') {
    memberData = {
      name,
      gender,
      generation: (viewer.generation || 0) + 1,
      branch: viewer.branch || '',
      fatherId: vKey,
      fatherName: viewer.name,
      originalId,
      memberId: `M${String(originalId).padStart(6, '0')}`,
      birthDate: { lunar: {} },
      remark: '',
      phone: '',
      residence: '',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };
  } else if (relation === 'spouse') {
    memberData = {
      name,
      gender,
      generation: viewer.generation || 0,
      branch: viewer.branch || '',
      fatherId: '',
      spouseId: vKey,
      originalId,
      memberId: `M${String(originalId).padStart(6, '0')}`,
      birthDate: { lunar: {} },
      remark: '',
      phone: '',
      residence: '',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };
  } else {
    return fail('不支持的关系类型');
  }

  const addRes = await db.collection(COL_MEMBERS).add({ data: memberData });
  if (relation === 'spouse') {
    await db.collection(COL_MEMBERS).doc(viewer._id).update({
      data: { spouseId: String(originalId), updatedAt: db.serverDate() }
    });
  }

  return ok({ data: { _id: addRes._id, originalId } });
}

exports.main = async (event) => {
  const action = event.action;
  const data = event.data || event;
  try {
    switch (action) {
      case 'getPermission':
        return await getPermission(data);
      case 'updateMember':
        return await updateMember(data);
      case 'deleteMember':
        return await deleteMember(data);
      case 'addFamily':
        return await addFamily(data);
      default:
        return fail(`未知操作: ${action}`);
    }
  } catch (err) {
    console.error('memberManageApi', action, err);
    return fail(err.message || '服务器错误');
  }
};
