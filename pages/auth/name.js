const authService = require('../../utils/authService');

Page({
  data: {
    name: '',
    error: '',
    canAppeal: false,
    canReset: false,
    loading: false
  },

  async onShow() {
    await authService.waitAuthReady();
    if (authService.isVerified()) {
      wx.reLaunch({ url: '/pages/index/index' });
    }
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value, error: '', canAppeal: false, canReset: false });
  },

  async submit() {
    if (this.data.loading) return;
    const name = String(this.data.name || '').trim();
    if (!name) {
      this.setData({ error: '请输入全名' });
      return;
    }
    if (!name.startsWith('罗')) {
      this.setData({ error: '请输入含「罗」姓的全名，例如：罗青兰' });
      return;
    }

    this.setData({ loading: true, error: '', canAppeal: false, canReset: false });
    wx.showLoading({ title: '验证中...' });

    try {
      const res = await authService.verifyName(name);
      wx.hideLoading();
      this.setData({ loading: false });

      if (!res.success) {
        // 本微信已在云端绑定：直接恢复会话进入，避免卡在验证页
        if (res.code === 'ALREADY_BOUND' || /已绑定/.test(res.message || '')) {
          const account = await authService.restoreBoundSession();
          if (account) {
            wx.showToast({ title: '已恢复登录', icon: 'success' });
            setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 400);
            return;
          }
          this.setData({
            error: res.message || '该微信已绑定，请点下方清除后重试，或稍后再进',
            canReset: true
          });
          return;
        }
        this.setData({
          error: res.message || '验证失败',
          canAppeal: !!res.canAppeal,
          canReset: false
        });
        return;
      }

      wx.navigateTo({
        url: `/pages/auth/birthday?ticketId=${encodeURIComponent(res.ticketId)}&matchCount=${res.matchCount || 0}`
      });
    } catch (err) {
      wx.hideLoading();
      this.setData({ loading: false, error: err.message || '网络错误' });
    }
  },

  async resetBinding() {
    wx.showLoading({ title: '清除中...' });
    try {
      const result = await authService.resetMyBinding();
      wx.hideLoading();
      if (!result || !result.success) {
        this.setData({ error: (result && result.message) || '清除失败' });
        return;
      }
      this.setData({
        error: '旧绑定已清除，请再次点击「下一步」',
        canReset: false
      });
      wx.showToast({ title: '已清除', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      this.setData({ error: err.message || '清除失败' });
    }
  },

  goAppeal() {
    wx.navigateTo({
      url: `/pages/auth/appeal?name=${encodeURIComponent(this.data.name || '')}`
    });
  }
});
