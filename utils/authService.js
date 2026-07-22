/**
 * 本地/云端统一的身份认证服务
 */
const config = require('./config');
const localDb = require('./localDb');
const { isVerifiableModernMember } = require('./memberEra');

const ANCIENT_LOCKED_MSG =
  '古人族谱资料已锁死，不可用于身份验证。仅今人（民国元年1912年起）可验证入谱。';

const ACCOUNT_KEY = 'auth_user_account';
const TICKET_KEY = 'auth_verify_ticket';
const TICKET_TTL_MS = 30 * 60 * 1000;

function maskPhone(phone) {
  const p = String(phone || '');
  if (p.length < 7) return p;
  return `${p.slice(0, 3)}****${p.slice(-4)}`;
}

function publicMember(m) {
  const lunar = (m.birthDate && m.birthDate.lunar) || {};
  return {
    _id: m._id,
    name: m.name,
    generation: m.generation,
    branch: m.branch,
    fatherName: m.fatherName || localDb.getFatherDisplayName(m) || '',
    hasBirth: localDb.hasFullLunarBirth(m),
    birthYear: lunar.year || null
  };
}

function readLocalAccount() {
  try {
    return wx.getStorageSync(ACCOUNT_KEY) || null;
  } catch (e) {
    return null;
  }
}

function writeLocalAccount(account) {
  const app = getApp();
  if (!account) {
    try {
      wx.removeStorageSync(ACCOUNT_KEY);
    } catch (e) { /* ignore */ }
    if (app && app.globalData) {
      app.globalData.authAccount = null;
      app.globalData.isVerified = false;
    }
    return;
  }
  wx.setStorageSync(ACCOUNT_KEY, account);
  if (app && app.globalData) {
    app.globalData.authAccount = account;
    app.globalData.isVerified = true;
  }
}

function clearLocalAccount() {
  try {
    wx.removeStorageSync(ACCOUNT_KEY);
  } catch (e) { /* ignore */ }
  const app = getApp();
  if (app && app.globalData) {
    app.globalData.authAccount = null;
    app.globalData.isVerified = false;
  }
}

function readTicket() {
  try {
    const ticket = wx.getStorageSync(TICKET_KEY);
    if (!ticket) return null;
    if (ticket.expireAt && ticket.expireAt < Date.now()) {
      wx.removeStorageSync(TICKET_KEY);
      return null;
    }
    return ticket;
  } catch (e) {
    return null;
  }
}

function writeTicket(ticket) {
  const next = Object.assign({}, ticket, {
    expireAt: Date.now() + TICKET_TTL_MS
  });
  wx.setStorageSync(TICKET_KEY, next);
  return next;
}

function clearTicket() {
  try {
    wx.removeStorageSync(TICKET_KEY);
  } catch (e) { /* ignore */ }
}

function genTicketId() {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function callCloud(action, data = {}) {
  const { result } = await wx.cloud.callFunction({
    name: 'authApi',
    data: Object.assign({ action }, data)
  });
  return result || { success: false, message: '无响应' };
}

function localGetSession() {
  const account = readLocalAccount();
  if (!account) return { success: true, verified: false, account: null };
  return {
    success: true,
    verified: true,
    account: Object.assign({}, account, {
      phoneMasked: maskPhone(account.phone)
    })
  };
}

function localVerifyName({ name }) {
  if (readLocalAccount()) {
    return { success: false, message: '该微信已绑定族谱账号', code: 'ALREADY_BOUND' };
  }
  const full = localDb.normalizeFullName(name);
  if (full === '') {
    return { success: false, message: '请输入姓名' };
  }
  if (full == null) {
    return {
      success: false,
      message: '请输入含「罗」姓的全名，例如：罗青兰',
      code: 'NEED_FULL_NAME'
    };
  }
  const allMatches = localDb.findMembersByName(full);
  if (!allMatches.length) {
    return {
      success: false,
      message: '未找到您的族谱信息。请确认全名是否正确（须含「罗」姓）。',
      code: 'NOT_FOUND',
      canAppeal: true
    };
  }
  const matches = allMatches.filter(isVerifiableModernMember);
  if (!matches.length) {
    return {
      success: false,
      message: ANCIENT_LOCKED_MSG,
      code: 'ANCIENT_LOCKED',
      canAppeal: true
    };
  }
  const ticket = writeTicket({
    ticketId: genTicketId(),
    candidatePersonIds: matches.map(m => m._id),
    step: 'name'
  });
  return {
    success: true,
    ticketId: ticket.ticketId,
    matchCount: matches.length,
    candidates: matches.map(publicMember),
    needBirthday: true
  };
}

function localVerifyBirthday({ ticketId, year, month, day }) {
  const ticket = readTicket();
  if (!ticket || ticket.ticketId !== ticketId) {
    return { success: false, message: '验证已过期，请重新开始', code: 'TICKET_EXPIRED' };
  }
  if (ticket.step !== 'name' && ticket.step !== 'birthday') {
    return { success: false, message: '请按顺序完成验证' };
  }
  if (!year || !month || !day) {
    return { success: false, message: '请选择完整农历出生日期' };
  }

  const members = (ticket.candidatePersonIds || [])
    .map(id => localDb.findById('members', id))
    .filter(Boolean)
    .filter(isVerifiableModernMember);
  if (!members.length) {
    return {
      success: false,
      message: ANCIENT_LOCKED_MSG,
      code: 'ANCIENT_LOCKED',
      canAppeal: true
    };
  }
  const matched = members.filter(m => localDb.matchLunarBirth(m, year, month, day));

  if (!matched.length) {
    return {
      success: false,
      message: '出生信息验证失败。请重新确认。',
      code: 'BIRTHDAY_MISMATCH',
      canAppeal: true
    };
  }

  const next = writeTicket({
    ticketId: ticket.ticketId,
    candidatePersonIds: matched.map(m => m._id),
    step: 'birthday'
  });

  return {
    success: true,
    ticketId: next.ticketId,
    matchCount: matched.length,
    candidates: matched.map(publicMember),
    needFather: true
  };
}

function localVerifyFather({ ticketId, fatherName }) {
  const ticket = readTicket();
  if (!ticket || ticket.ticketId !== ticketId) {
    return { success: false, message: '验证已过期，请重新开始', code: 'TICKET_EXPIRED' };
  }
  if (ticket.step !== 'birthday' && ticket.step !== 'father') {
    return { success: false, message: '请先完成出生日期验证' };
  }

  const fname = localDb.normalizeFullName(fatherName);
  if (fname === '') return { success: false, message: '请输入父亲姓名' };
  if (fname == null) {
    return {
      success: false,
      message: '请输入父亲含「罗」姓的全名，例如：罗鼓声',
      code: 'NEED_FULL_NAME'
    };
  }

  const members = (ticket.candidatePersonIds || [])
    .map(id => localDb.findById('members', id))
    .filter(Boolean)
    .filter(isVerifiableModernMember);
  if (!members.length) {
    return {
      success: false,
      message: ANCIENT_LOCKED_MSG,
      code: 'ANCIENT_LOCKED',
      canAppeal: true
    };
  }
  const matched = members.filter(m => localDb.getFatherDisplayName(m) === fname);

  if (!matched.length) {
    return {
      success: false,
      message: '父亲信息验证失败。',
      code: 'FATHER_MISMATCH',
      canAppeal: true
    };
  }
  if (matched.length > 1) {
    return {
      success: false,
      message: '仍有多名同名族人，请选择人工申诉由管理员核实。',
      code: 'STILL_AMBIGUOUS',
      canAppeal: true,
      matchCount: matched.length
    };
  }

  const person = matched[0];
  if (!isVerifiableModernMember(person)) {
    return {
      success: false,
      message: ANCIENT_LOCKED_MSG,
      code: 'ANCIENT_LOCKED',
      canAppeal: true
    };
  }
  const accounts = wx.getStorageSync('auth_all_accounts') || [];
  if (accounts.some(a => a.personId === person._id)) {
    return { success: false, message: '该族谱成员已绑定其他账号', code: 'PERSON_BOUND' };
  }

  const next = writeTicket({
    ticketId: ticket.ticketId,
    candidatePersonIds: [person._id],
    step: 'ready'
  });

  return {
    success: true,
    ticketId: next.ticketId,
    person: publicMember(person),
    readyToBind: true
  };
}

function localBindPhone({ ticketId, phone }) {
  const existing = readLocalAccount();
  if (existing) {
    return {
      success: true,
      alreadyBound: true,
      account: Object.assign({}, existing, { phoneMasked: maskPhone(existing.phone) })
    };
  }

  const ticket = readTicket();
  if (!ticket || ticket.ticketId !== ticketId || ticket.step !== 'ready') {
    return { success: false, message: '请先完成身份验证', code: 'NOT_READY' };
  }

  const personId = (ticket.candidatePersonIds || [])[0];
  const member = localDb.findById('members', personId);
  if (!member) return { success: false, message: '族谱成员不存在' };
  if (!isVerifiableModernMember(member)) {
    return {
      success: false,
      message: ANCIENT_LOCKED_MSG,
      code: 'ANCIENT_LOCKED',
      canAppeal: true
    };
  }

  const phoneNum = String(phone || '').trim();
  if (!/^1\d{10}$/.test(phoneNum)) {
    return { success: false, message: '请输入有效手机号' };
  }

  const accounts = wx.getStorageSync('auth_all_accounts') || [];
  if (accounts.some(a => a.phone === phoneNum)) {
    return { success: false, message: '该手机号已绑定其他族谱账号', code: 'PHONE_BOUND' };
  }
  if (accounts.some(a => a.personId === personId)) {
    return { success: false, message: '该族谱成员已绑定其他账号', code: 'PERSON_BOUND' };
  }

  const account = {
    _id: `local_${Date.now()}`,
    personId,
    originalId: member.originalId != null ? member.originalId : null,
    name: member.name,
    phone: phoneNum,
    phoneVerified: true,
    openid: 'local_openid',
    unionid: '',
    verifyStatus: 'verified',
    createTime: new Date().toISOString()
  };

  accounts.push(account);
  wx.setStorageSync('auth_all_accounts', accounts);
  writeLocalAccount(account);
  clearTicket();

  return {
    success: true,
    account: Object.assign({}, account, { phoneMasked: maskPhone(phoneNum) })
  };
}

function localSubmitAppeal(data) {
  const list = wx.getStorageSync('auth_appeals') || [];
  list.push(Object.assign({}, data, {
    status: 'pending',
    createTime: new Date().toISOString()
  }));
  wx.setStorageSync('auth_appeals', list);
  return { success: true, message: '申诉已提交，管理员将尽快处理' };
}

async function getSession() {
  if (config.isLocalMode()) return localGetSession();
  return callCloud('getSession');
}

async function verifyName(name) {
  if (config.isLocalMode()) return localVerifyName({ name });
  return callCloud('verifyName', { name });
}

async function verifyBirthday(ticketId, year, month, day) {
  if (config.isLocalMode()) {
    return localVerifyBirthday({ ticketId, year, month, day });
  }
  return callCloud('verifyBirthday', { ticketId, year, month, day });
}

async function verifyFather(ticketId, fatherName) {
  if (config.isLocalMode()) {
    return localVerifyFather({ ticketId, fatherName });
  }
  return callCloud('verifyFather', { ticketId, fatherName });
}

async function bindPhone(ticketId, { cloudID, phone } = {}) {
  if (config.isLocalMode()) {
    return localBindPhone({ ticketId, phone });
  }
  return callCloud('bindPhone', { ticketId, cloudID, phone });
}

async function submitAppeal(data) {
  if (config.isLocalMode()) return localSubmitAppeal(data);
  return callCloud('submitAppeal', data);
}

function localUpdatePhone({ phone, cloudID }) {
  const account = readLocalAccount();
  if (!account) return { success: false, message: '请先完成身份认证' };
  const phoneNum = String(phone || '').trim();
  if (!/^1\d{10}$/.test(phoneNum)) {
    return { success: false, message: '请输入有效手机号' };
  }
  const accounts = wx.getStorageSync('auth_all_accounts') || [];
  if (accounts.some(a => a.phone === phoneNum && a._id !== account._id)) {
    return { success: false, message: '该手机号已绑定其他族谱账号', code: 'PHONE_BOUND' };
  }
  account.phone = phoneNum;
  account.phoneVerified = true;
  writeLocalAccount(account);
  const next = accounts.map(a => (a._id === account._id ? account : a));
  if (!next.find(a => a._id === account._id)) next.push(account);
  wx.setStorageSync('auth_all_accounts', next);
  if (account.personId) {
    localDb.updateMemberLocal(account.personId, { phone: phoneNum });
  }
  return {
    success: true,
    account: Object.assign({}, account, { phoneMasked: maskPhone(phoneNum) })
  };
}

function localUpdateWechatId({ wechatId }) {
  const account = readLocalAccount();
  if (!account) return { success: false, message: '请先完成身份认证' };
  const id = String(wechatId || '').trim();
  if (!id) return { success: false, message: '请填写微信号' };
  account.wechatId = id;
  writeLocalAccount(account);
  const accounts = wx.getStorageSync('auth_all_accounts') || [];
  const next = accounts.map(a => (a._id === account._id ? account : a));
  if (!next.find(a => a._id === account._id)) next.push(account);
  wx.setStorageSync('auth_all_accounts', next);
  if (account.personId) {
    localDb.updateMemberLocal(account.personId, { wechat: id });
  }
  return { success: true, account };
}

async function updatePhone(payload = {}) {
  if (config.isLocalMode()) return localUpdatePhone(payload);
  return callCloud('updatePhone', payload);
}

async function updateWechatId(wechatId) {
  if (config.isLocalMode()) return localUpdateWechatId({ wechatId });
  return callCloud('updateWechatId', { wechatId });
}

function isVerified() {
  const app = getApp();
  if (app && app.globalData && app.globalData.isVerified) return true;
  return !!readLocalAccount();
}

function getCachedAccount() {
  const app = getApp();
  if (app && app.globalData && app.globalData.authAccount) {
    return app.globalData.authAccount;
  }
  return readLocalAccount();
}

async function bootstrap() {
  if (config.isLocalMode()) {
    try {
      localDb.init();
    } catch (e) { /* already inited */ }
    const account = readLocalAccount();
    writeLocalAccount(account);
    return { verified: !!account, account };
  }

  const trySession = async () => {
    const res = await getSession();
    if (res.success && res.verified && res.account) {
      writeLocalAccount(res.account);
      return { verified: true, account: res.account };
    }
    if (res.success && !res.verified) {
      // 云端明确无绑定：清本机
      clearLocalAccount();
      clearTicket();
      if (res.staleBinding) {
        return { verified: false, account: null, staleBinding: true, message: res.message };
      }
      return { verified: false, account: null };
    }
    throw new Error((res && res.message) || 'getSession 失败');
  };

  try {
    return await trySession();
  } catch (err) {
    console.warn('[authService] getSession failed, retry once', err);
    try {
      await new Promise(r => setTimeout(r, 400));
      return await trySession();
    } catch (err2) {
      console.warn('[authService] getSession retry failed', err2);
      // 瞬时网络错误：保留本机缓存，避免误踢已登录用户
      const cached = readLocalAccount();
      if (cached) {
        writeLocalAccount(cached);
        return { verified: true, account: cached, offline: true };
      }
      return { verified: false, account: null };
    }
  }
}

/** 等待 App 启动时的认证会话恢复完成 */
function waitAuthReady() {
  try {
    const app = getApp();
    if (app && app.globalData && app.globalData.authReadyPromise) {
      return app.globalData.authReadyPromise;
    }
  } catch (e) { /* ignore */ }
  return Promise.resolve({ verified: isVerified() });
}

/**
 * 若云端已绑定，拉会话写入本机并返回账号；否则 null
 */
async function restoreBoundSession() {
  if (config.isLocalMode()) {
    const account = readLocalAccount();
    return account || null;
  }
  try {
    const res = await getSession();
    if (res.success && res.verified && res.account) {
      writeLocalAccount(res.account);
      return res.account;
    }
  } catch (e) {
    console.warn('[authService] restoreBoundSession', e);
  }
  return null;
}

function logoutLocal() {
  clearLocalAccount();
  clearTicket();
}

/** 清除云端绑定 + 本机缓存，便于重新验证关联 */
async function resetMyBinding() {
  if (config.isLocalMode()) {
    logoutLocal();
    return { success: true, message: '已清除本机认证状态' };
  }
  try {
    const res = await callCloud('resetMyBinding');
    logoutLocal();
    return res && res.success
      ? res
      : { success: false, message: (res && res.message) || '清除失败' };
  } catch (err) {
    logoutLocal();
    return { success: false, message: err.message || '清除失败' };
  }
}

module.exports = {
  bootstrap,
  waitAuthReady,
  restoreBoundSession,
  getSession,
  verifyName,
  verifyBirthday,
  verifyFather,
  bindPhone,
  updatePhone,
  updateWechatId,
  submitAppeal,
  isVerified,
  getCachedAccount,
  maskPhone,
  logoutLocal,
  resetMyBinding,
  ACCOUNT_KEY
};
