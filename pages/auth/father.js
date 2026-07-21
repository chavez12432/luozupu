const authService = require('../../utils/authService');

Page({
  data: {
    ticketId: '',
    fatherName: '',
    error: '',
    canAppeal: false,
    loading: false
  },

  onLoad(options) {
    this.setData({
      ticketId: decodeURIComponent(options.ticketId || '')
    });
  },

  onInput(e) {
    this.setData({ fatherName: e.detail.value, error: '', canAppeal: false });
  },

  async submit() {
    if (this.data.loading) return;
    const fatherName = String(this.data.fatherName || '').trim();
    if (!fatherName) {
      this.setData({ error: '请输入父亲全名' });
      return;
    }
    if (!fatherName.startsWith('罗')) {
      this.setData({ error: '请输入父亲含「罗」姓的全名，例如：罗鼓声' });
      return;
    }
    if (!this.data.ticketId) {
      this.setData({ error: '验证会话无效，请重新开始' });
      return;
    }

    this.setData({ loading: true, error: '', canAppeal: false });
    wx.showLoading({ title: '验证中...' });

    try {
      const res = await authService.verifyFather(this.data.ticketId, fatherName);
      wx.hideLoading();
      this.setData({ loading: false });

      if (!res.success) {
        this.setData({
          error: res.message || '验证失败',
          canAppeal: !!res.canAppeal
        });
        return;
      }

      const personName = (res.person && res.person.name) || '';
      wx.navigateTo({
        url: `/pages/auth/bind?ticketId=${encodeURIComponent(res.ticketId)}&name=${encodeURIComponent(personName)}`
      });
    } catch (err) {
      wx.hideLoading();
      this.setData({ loading: false, error: err.message || '网络错误' });
    }
  },

  goAppeal() {
    wx.navigateTo({
      url: `/pages/auth/appeal?fatherHint=${encodeURIComponent(this.data.fatherName || '')}`
    });
  },

  restart() {
    wx.reLaunch({ url: '/pages/auth/welcome' });
  }
});
