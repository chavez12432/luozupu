const authService = require('../../utils/authService');
const devMessageService = require('../../utils/devMessageService');

Page({
  data: {
    name: '',
    phone: '',
    wechat: '',
    content: '',
    error: '',
    loading: false
  },

  onLoad() {
    const account = authService.getCachedAccount();
    if (account) {
      this.setData({
        name: account.name || '',
        phone: account.phone || '',
        wechat: account.wechatId || ''
      });
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value, error: '' });
  },

  async submit() {
    if (this.data.loading) return;
    this.setData({ loading: true, error: '' });
    wx.showLoading({ title: '提交中...' });
    try {
      const res = await devMessageService.submitMessage({
        name: this.data.name,
        phone: this.data.phone,
        wechat: this.data.wechat,
        content: this.data.content
      });
      wx.hideLoading();
      this.setData({ loading: false });
      if (!res.success) {
        this.setData({ error: res.message || '提交失败' });
        return;
      }
      wx.showModal({
        title: '已提交',
        content: res.message || '留言已提交，开发人员将尽快查看处理。',
        showCancel: false,
        success: () => wx.navigateBack()
      });
    } catch (err) {
      wx.hideLoading();
      this.setData({ loading: false, error: err.message || '提交失败' });
    }
  }
});
