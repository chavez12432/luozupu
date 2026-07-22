/**
 * 页面访问门禁：游客仅可访问序文与认证相关页
 */
const authService = require('./authService');

const PUBLIC_PREFIXES = [
  'pages/preface/',
  'pages/songshou/',
  'pages/fengtu/',
  'pages/auth/',
  'pages/message/'
];

function getCurrentRoute() {
  const pages = getCurrentPages();
  if (!pages.length) return '';
  const cur = pages[pages.length - 1];
  return cur.route || cur.__route__ || '';
}

function isPublicRoute(route) {
  const r = String(route || '');
  return PUBLIC_PREFIXES.some(prefix => r.indexOf(prefix) === 0 || r.indexOf(prefix.replace(/\/$/, '')) === 0);
}

/**
 * 未认证则跳转欢迎页。返回 true 表示已认证可继续。
 * 若会话仍在恢复中，先短等再判定，减少冷启动误踢。
 * @param {object} [options]
 * @param {boolean} [options.replace] 使用 redirectTo
 */
function requireAuth(options = {}) {
  if (authService.isVerified()) return true;

  const route = getCurrentRoute();
  if (isPublicRoute(route)) return true;

  // 同步门禁：尽量读缓存；异步恢复由 waitAuthReady 在启动时完成
  try {
    const cached = authService.getCachedAccount && authService.getCachedAccount();
    if (cached && cached.personId) return true;
  } catch (_) { /* ignore */ }

  const url = '/pages/auth/welcome';
  if (options.replace) {
    wx.redirectTo({ url });
  } else {
    wx.navigateTo({ url });
  }
  return false;
}

async function requireAuthAsync(options = {}) {
  try {
    await authService.waitAuthReady();
  } catch (_) { /* ignore */ }
  return requireAuth(options);
}

/**
 * 首页游客态：不跳转，仅返回是否已认证
 */
function checkVerified() {
  return authService.isVerified();
}

module.exports = {
  requireAuth,
  requireAuthAsync,
  checkVerified,
  isPublicRoute,
  PUBLIC_PREFIXES
};
