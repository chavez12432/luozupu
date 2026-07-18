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
  if (viewer._id === target._id) return 'self';
  const vKey = memberKey(viewer);
  const tKey = memberKey(target);
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
        return t ? { degree: t, school: '', isDefault: false } : null;
      }
      const degree = String(e.degree || '').trim();
      const school = String(e.school || '').trim();
      if (!degree && !school) return null;
      return {
        degree,
        school,
        year: e.year != null && e.year !== '' ? Number(e.year) : null,
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

async function getOpenId() {
  const ctx = cloud.getWXContext();
  return ctx.OPENID || '';
}

async function getAccountByOpenId(openid) {
  if (!openid) return null;
  const res = await db.collection(COL_ACCOUNTS).where({ openid }).limit(1).get();
  return res.data[0] || null;
}

async function getMember(id) {
  if (!id) return null;
  const res = await db.collection(COL_MEMBERS).doc(id).get().catch(() => null);
  return res && res.data ? res.data : null;
}

async function isPersonVerified(personId) {
  const res = await db.collection(COL_ACCOUNTS).where({ personId }).limit(1).get();
  return res.data.length > 0;
}

async function getViewerContext() {
  const openid = await getOpenId();
  if (!openid) return { error: fail('无法获取微信身份') };
  const account = await getAccountByOpenId(openid);
  if (!account) return { error: fail('请先完成身份认证') };
  const viewer = await getMember(account.personId);
  if (!viewer) return { error: fail('绑定的族谱成员不存在') };
  return { openid, account, viewer };
}

async function getPermission(params) {
  const ctx = await getViewerContext();
  if (ctx.error) return ctx.error;
  const target = await getMember(params.targetId);
  if (!target) return fail('成员不存在');
  const targetVerified = await isPersonVerified(target._id);
  return ok({
    permission: evaluatePermission(ctx.viewer, target, targetVerified),
    viewerId: ctx.viewer._id,
    targetId: target._id
  });
}

async function updateMember(params) {
  const ctx = await getViewerContext();
  if (ctx.error) return ctx.error;
  const target = await getMember(params.targetId);
  if (!target) return fail('成员不存在');
  const targetVerified = await isPersonVerified(target._id);
  const perm = evaluatePermission(ctx.viewer, target, targetVerified);
  if (!perm.canEdit) {
    return fail(perm.lockReason || '无权修改该成员资料');
  }
  const data = pickEditable(params.patch || {});
  if (!Object.keys(data).length) return fail('没有可更新的字段');
  data.updatedAt = db.serverDate();
  await db.collection(COL_MEMBERS).doc(target._id).update({ data });
  return ok();
}

async function deleteMember(params) {
  const ctx = await getViewerContext();
  if (ctx.error) return ctx.error;
  const target = await getMember(params.targetId);
  if (!target) return fail('成员不存在');
  const targetVerified = await isPersonVerified(target._id);
  const perm = evaluatePermission(ctx.viewer, target, targetVerified);
  if (!perm.canDelete) {
    return fail(perm.lockReason || '无权删除该成员（仅可删除未认证的配偶或子女）');
  }
  await db.collection(COL_MEMBERS).doc(target._id).remove();
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
  const name = String(params.name || '').trim().replace(/^罗/, '');
  const gender = params.gender === '女' ? '女' : '男';
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
