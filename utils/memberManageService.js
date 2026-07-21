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
  RELATION
} = require('./familyPermission');

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
  if (!viewer || !target) {
    return {
      success: true,
      permission: evaluatePermission({
        viewerMember: viewer,
        targetMember: target,
        targetVerified: false
      })
    };
  }
  return {
    success: true,
    permission: evaluatePermission({
      viewerMember: viewer,
      targetMember: target,
      targetVerified: isTargetVerifiedLocal(targetId)
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
  const name = withClanSurname(String(payload.name || '').trim());
  const gender = payload.gender === '女' ? '女' : '男';
  if (!name) return { success: false, message: '请填写姓名' };

  const selfPerm = evaluatePermission({
    viewerMember: viewer,
    targetMember: viewer,
    targetVerified: true
  });
  if (!selfPerm.canAddChild && relation === 'child') {
    return { success: false, message: '无权添加子女' };
  }
  if (!selfPerm.canAddSpouse && relation === 'spouse') {
    return { success: false, message: '无权添加配偶' };
  }

  const originalId = localDb.nextLocalOriginalId();
  const vKey = memberKey(viewer);

  if (relation === 'child') {
    const member = {
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
      residence: ''
    };
    return localDb.addMemberLocal(member);
  }

  if (relation === 'spouse') {
    const member = {
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
      residence: ''
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
