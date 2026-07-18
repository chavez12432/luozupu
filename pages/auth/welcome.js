const authService = require('../../utils/authService');

Page({
  onShow() {
    if (authService.isVerified()) {
      wx.reLaunch({ url: '/pages/index/index' });
    }
  },

  startVerify() {
    wx.navigateTo({ url: '/pages/auth/name' });
  },

  goPreface() {
    wx.navigateTo({ url: '/pages/preface/list' });
  },

  exitApp() {
    if (wx.exitMiniProgram) {
      wx.exitMiniProgram({
        fail: () => {
          wx.showToast({ title: '请点击右上角关闭', icon: 'none' });
        }
      });
    } else {
      wx.showToast({ title: '请点击右上角关闭', icon: 'none' });
    }
  }
});
