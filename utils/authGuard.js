/**
 * 页面访问门禁：游客仅可访问序文与认证相关页
 */
const authService = require('./authService');

const PUBLIC_PREFIXES = [
  'pages/preface/',
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
 * @param {object} [options]
 * @param {boolean} [options.replace] 使用 redirectTo
 */
function requireAuth(options = {}) {
  if (authService.isVerified()) return true;

  const route = getCurrentRoute();
  if (isPublicRoute(route)) return true;

  const url = '/pages/auth/welcome';
  if (options.replace) {
    wx.redirectTo({ url });
  } else {
    wx.navigateTo({ url });
  }
  return false;
}

/**
 * 首页游客态：不跳转，仅返回是否已认证
 */
function checkVerified() {
  return authService.isVerified();
}

module.exports = {
  requireAuth,
  checkVerified,
  isPublicRoute,
  PUBLIC_PREFIXES
};
