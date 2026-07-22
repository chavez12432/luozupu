/**
 * 家庭成员增删改（本地 / 云）
 */
const config = require('./config');
const localDb = require('./localDb');
const authService = require('./authService');
const { withClanSurname } = require('./clanName');
const {
  evaluatePermission,
  pickEditable,
  memberKey,
  RELATION,
  MAX_ADD_FAMILY
} = require('./familyPermission');
const { nextIdsForBranch } = require('./memberIdAssign');

function countCreatedByViewerLocal(viewer) {
  if (!viewer) return 0;
  localDb.init();
  const keys = new Set(
    [viewer._id, memberKey(viewer), viewer.originalId, viewer.memberId]
      .filter((v) => v != null && String(v) !== '')
      .map(String)
  );
  const list = (localDb.store && localDb.store.members) || [];
  return list.filter((m) => {
    if (!m) return false;
    const a = m.createdByPersonId != null ? String(m.createdByPersonId) : '';
    const b = m.createdByKey != null ? String(m.createdByKey) : '';
    return (a && keys.has(a)) || (b && keys.has(b));
  }).length;
}

function getVerifiedPersonIdSet() {
  if (config.isLocalMode()) {
    const accounts = wx.getStorageSync('auth_all_accounts') || [];
    const current = authService.getCachedAccount();
    const set = new Set(accounts.map(a => a.personId));
    if (current && current.personId) set.add(current.personId);
    return set;
  }
  return null; // 云端由云函数查询
}

function getViewerMember() {
  const account = authService.getCachedAccount();
  if (!account || !account.personId) return null;
  localDb.init();
  return localDb.findById('members', account.personId);
}

function isTargetVerifiedLocal(personId) {
  const set = getVerifiedPersonIdSet();
  return !!(set && set.has(personId));
}

function getManagePermission(targetId) {
  const viewer = getViewerMember();
  const target = localDb.findById('members', targetId);
  const addFamilyUsed = countCreatedByViewerLocal(viewer);
  if (!viewer || !target) {
    return {
      success: true,
      permission: evaluatePermission({
        viewerMember: viewer,
        targetMember: target,
        targetVerified: false,
        addFamilyUsed
      })
    };
  }
  return {
    success: true,
    permission: evaluatePermission({
      viewerMember: viewer,
      targetMember: target,
      targetVerified: isTargetVerifiedLocal(targetId),
      addFamilyUsed
    }),
    viewerId: viewer._id,
    targetId
  };
}

async function callCloud(action, data = {}) {
  try {
    const { result } = await wx.cloud.callFunction({
      name: 'memberManageApi',
      data: Object.assign({ action }, data)
    });
    if (!result) return { success: false, message: '云函数无响应，请确认已部署 memberManageApi' };
    return result;
  } catch (err) {
    console.error('memberManageApi', action, err);
    const msg = (err && (err.errMsg || err.message)) || '调用失败';
    return { success: false, message: msg };
  }
}

async function getPermission(targetId) {
  if (config.isLocalMode()) return getManagePermission(targetId);
  return callCloud('getPermission', { targetId });
}

function localUpdateMember(targetId, patch) {
  const permRes = getManagePermission(targetId);
  const perm = permRes.permission;
  if (!perm.canEdit) {
    return {
      success: false,
      message: perm.lockReason || '无权修改该成员资料'
    };
  }
  const data = pickEditable(patch);
  if (!Object.keys(data).length) {
    return { success: false, message: '没有可更新的字段' };
  }
  return localDb.updateMemberLocal(targetId, data);
}

function localDeleteMember(targetId) {
  const permRes = getManagePermission(targetId);
  const perm = permRes.permission;
  if (!perm.canDelete) {
    return {
      success: false,
      message: perm.locked
        ? perm.lockReason
        : '无权删除该成员（仅可删除未认证的配偶或子女）'
    };
  }
  return localDb.deleteMemberLocal(targetId);
}

function localAddFamily(payload) {
  const viewer = getViewerMember();
  if (!viewer) return { success: false, message: '请先完成身份认证' };

  const relation = payload.relation; // child | spouse
  const rawName = String(payload.name || '').trim();
  const gender = payload.gender === '女' ? '女' : '男';
  // 与云端一致：含「氏」视为外姓表述，不加「罗」
  const name = /氏/.test(rawName) ? rawName.replace(/^罗+/, '') : withClanSurname(rawName);
  if (!name) return { success: false, message: '请填写姓名' };

  const addFamilyUsed = countCreatedByViewerLocal(viewer);
  const selfPerm = evaluatePermission({
    viewerMember: viewer,
    targetMember: viewer,
    targetVerified: true,
    addFamilyUsed
  });
  if (!selfPerm.canAddChild && relation === 'child') {
    return { success: false, message: selfPerm.lockReason || '无权添加子女', code: 'ADD_LIMIT' };
  }
  if (!selfPerm.canAddSpouse && relation === 'spouse') {
    return { success: false, message: selfPerm.lockReason || '无权添加配偶', code: 'ADD_LIMIT' };
  }
  if (addFamilyUsed >= MAX_ADD_FAMILY) {
    return {
      success: false,
      message: `每人最多新增 ${MAX_ADD_FAMILY} 位族人资料，已达上限`,
      code: 'ADD_LIMIT'
    };
  }

  localDb.init();
  const branch = viewer.branch || '';
  const ids = nextIdsForBranch(localDb.store.members || [], branch);
  const originalId = ids.originalId;
  const memberId = ids.memberId;
  const vKey = memberKey(viewer);
  const creatorMeta = {
    createdByPersonId: viewer._id != null ? String(viewer._id) : '',
    createdByKey: vKey,
    eraCategory: 'modern'
  };

  if (relation === 'child') {
    const member = {
      name,
      gender,
      generation: (viewer.generation || 0) + 1,
      branch,
      fatherId: vKey,
      fatherName: viewer.name,
      originalId,
      memberId,
      birthDate: { lunar: {} },
      remark: '',
      phone: '',
      residence: '',
      ...creatorMeta
    };
    return localDb.addMemberLocal(member);
  }

  if (relation === 'spouse') {
    const member = {
      name,
      gender,
      generation: viewer.generation || 0,
      branch,
      fatherId: '',
      spouseId: vKey,
      originalId,
      memberId,
      birthDate: { lunar: {} },
      remark: '',
      phone: '',
      residence: '',
      ...creatorMeta
    };
    const addRes = localDb.addMemberLocal(member);
    if (!addRes.success) return addRes;
    // 双向绑定
    localDb.updateMemberLocal(viewer._id, { spouseId: String(originalId) });
    return addRes;
  }

  return { success: false, message: '不支持的关系类型' };
}

async function updateMember(targetId, patch) {
  if (config.isLocalMode()) return localUpdateMember(targetId, patch);
  return callCloud('updateMember', { targetId, patch });
}

async function deleteMember(targetId) {
  if (config.isLocalMode()) return localDeleteMember(targetId);
  return callCloud('deleteMember', { targetId });
}

async function addFamily(payload) {
  if (config.isLocalMode()) return localAddFamily(payload);
  return callCloud('addFamily', payload);
}

module.exports = {
  getPermission,
  updateMember,
  deleteMember,
  addFamily,
  getViewerMember,
  RELATION
};
