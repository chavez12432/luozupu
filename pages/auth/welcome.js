const authService = require('../../utils/authService');

Page({
  async onShow() {
    await authService.waitAuthReady();
    if (authService.isVerified()) {
      wx.reLaunch({ url: '/pages/index/index' });
    }
  },

  startVerify() {
    wx.navigateTo({ url: '/pages/auth/name' });
  },

  resetBinding() {
    wx.showModal({
      title: '清除旧绑定',
      content: '将清除本微信的旧认证记录，然后可重新关联族人。确认？',
      confirmText: '清除',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '清除中...' });
        try {
          const result = await authService.resetMyBinding();
          wx.hideLoading();
          if (!result || !result.success) {
            wx.showToast({ title: (result && result.message) || '清除失败', icon: 'none' });
            return;
          }
          wx.showToast({ title: '已清除，请重新验证', icon: 'success' });
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: err.message || '清除失败', icon: 'none' });
        }
      }
    });
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
