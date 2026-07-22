/**
 * 底部导航公共跳转
 * 枢纽页统一 reLaunch，避免 navigateTo 堆栈触达 10 页上限
 */
const authService = require('./authService');
const authGuard = require('./authGuard');

function goToMe() {
  if (!authGuard.requireAuth()) return;
  const account = authService.getCachedAccount();
  if (!account || !account.personId) {
    wx.navigateTo({ url: '/pages/auth/welcome' });
    return;
  }
  wx.navigateTo({ url: `/pages/member/detail?id=${account.personId}` });
}

function goToIndex() {
  wx.reLaunch({ url: '/pages/index/index' });
}

function goToPreface() {
  wx.reLaunch({ url: '/pages/preface/list' });
}

function goToHonor() {
  if (!authGuard.requireAuth()) return;
  wx.reLaunch({ url: '/pages/honor/index' });
}

function goToHall() {
  if (!authGuard.requireAuth()) return;
  wx.reLaunch({ url: '/pages/family-tree/family-tree' });
}

module.exports = {
  goToMe,
  goToIndex,
  goToPreface,
  goToHonor,
  goToHall
};
