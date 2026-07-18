const authService = require('../../utils/authService');

Page({
  data: {
    name: '',
    error: '',
    canAppeal: false,
    loading: false
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value, error: '', canAppeal: false });
  },

  async submit() {
    if (this.data.loading) return;
    const name = String(this.data.name || '').trim();
    if (!name) {
      this.setData({ error: '请输入名字' });
      return;
    }

    this.setData({ loading: true, error: '', canAppeal: false });
    wx.showLoading({ title: '验证中...' });

    try {
      const res = await authService.verifyName(name);
      wx.hideLoading();
      this.setData({ loading: false });

      if (!res.success) {
        this.setData({
          error: res.message || '验证失败',
          canAppeal: !!res.canAppeal
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

  goAppeal() {
    wx.navigateTo({
      url: `/pages/auth/appeal?name=${encodeURIComponent(this.data.name || '')}`
    });
  }
});
