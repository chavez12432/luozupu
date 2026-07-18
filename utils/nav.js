/**
 * 底部导航公共跳转
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
  wx.navigateTo({ url: '/pages/preface/list' });
}

function goToHonor() {
  if (!authGuard.requireAuth()) return;
  wx.navigateTo({ url: '/pages/honor/index' });
}

function goToHall() {
  if (!authGuard.requireAuth()) return;
  wx.navigateTo({ url: '/pages/family-tree/family-tree' });
}

module.exports = {
  goToMe,
  goToIndex,
  goToPreface,
  goToHonor,
  goToHall
};
