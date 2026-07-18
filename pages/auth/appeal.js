const authService = require('../../utils/authService');

Page({
  data: {
    name: '',
    birthHint: '',
    fatherHint: '',
    phone: '',
    wechat: '',
    reason: '',
    error: '',
    loading: false
  },

  onLoad(options) {
    this.setData({
      name: decodeURIComponent(options.name || ''),
      fatherHint: decodeURIComponent(options.fatherHint || ''),
      birthHint: decodeURIComponent(options.birthHint || '')
    });
  },

  onField(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value, error: '' });
  },

  async submit() {
    if (this.data.loading) return;
    const { name, reason, phone, wechat, birthHint, fatherHint } = this.data;
    if (!String(name).trim() || !String(reason).trim()) {
      this.setData({ error: '请填写姓名和申诉理由' });
      return;
    }

    this.setData({ loading: true });
    wx.showLoading({ title: '提交中...' });
    try {
      const res = await authService.submitAppeal({
        name: String(name).trim(),
        reason: String(reason).trim(),
        phone: String(phone).trim(),
        wechat: String(wechat).trim(),
        birthHint: String(birthHint).trim(),
        fatherHint: String(fatherHint).trim()
      });
      wx.hideLoading();
      this.setData({ loading: false });

      if (!res.success) {
        this.setData({ error: res.message || '提交失败' });
        return;
      }

      wx.showModal({
        title: '已提交',
        content: res.message || '申诉已提交，管理员将尽快处理',
        showCancel: false,
        success: () => {
          wx.reLaunch({ url: '/pages/index/index' });
        }
      });
    } catch (err) {
      wx.hideLoading();
      this.setData({ loading: false, error: err.message || '网络错误' });
    }
  }
});
