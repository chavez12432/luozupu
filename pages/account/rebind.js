const authGuard = require('../../utils/authGuard');
const authService = require('../../utils/authService');
const config = require('../../utils/config');

Page({
  data: {
    isLocal: false,
    phoneMasked: '',
    phone: '',
    wechatId: '',
    error: '',
    loadingPhone: false
  },

  onShow() {
    if (!authGuard.requireAuth({ replace: true })) return;
    const account = authService.getCachedAccount() || {};
    this.setData({
      isLocal: config.isLocalMode(),
      phoneMasked: account.phoneMasked || authService.maskPhone(account.phone) || '',
      wechatId: account.wechatId || '',
      error: ''
    });
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value, error: '' });
  },

  onWechatInput(e) {
    this.setData({ wechatId: e.detail.value, error: '' });
  },

  async applyAccount(res) {
    if (res.account) {
      wx.setStorageSync(authService.ACCOUNT_KEY, res.account);
      const app = getApp();
      if (app && app.globalData) {
        app.globalData.authAccount = res.account;
        app.globalData.isVerified = true;
      }
      this.setData({
        phoneMasked: res.account.phoneMasked || authService.maskPhone(res.account.phone),
        wechatId: res.account.wechatId || this.data.wechatId
      });
    }
  },

  async onGetPhoneNumber(e) {
    const detail = e.detail || {};
    if (detail.errMsg !== 'getPhoneNumber:ok') {
      const msg = detail.errMsg || '';
      let error = '未能通过微信获取手机号，请再次授权或在下方手动填写。';
      if (msg.indexOf('deny') >= 0 || msg.indexOf('cancel') >= 0) {
        error = '您未允许获取手机号，请再次点击授权并选择允许，或手动填写。';
      } else if (msg.indexOf('no permission') >= 0) {
        error = '小程序暂未开通手机号快速验证，请手动填写新手机号。';
      }
      this.setData({ error });
      return;
    }
    const cloudID = detail.cloudID;
    if (!cloudID) {
      this.setData({ error: '未获取到手机号凭证，请手动填写新手机号。' });
      return;
    }
    this.setData({ loadingPhone: true, error: '' });
    wx.showLoading({ title: '更新中...' });
    try {
      const res = await authService.updatePhone({ cloudID });
      wx.hideLoading();
      this.setData({ loadingPhone: false });
      if (!res.success) {
        this.setData({ error: res.message || '更新失败' });
        return;
      }
      await this.applyAccount(res);
      wx.showToast({ title: '手机号已更新', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      this.setData({ loadingPhone: false, error: err.message || '更新失败' });
    }
  },

  async submitPhoneManual() {
    this.setData({ loadingPhone: true, error: '' });
    wx.showLoading({ title: '保存中...' });
    try {
      const res = await authService.updatePhone({ phone: this.data.phone });
      wx.hideLoading();
      this.setData({ loadingPhone: false });
      if (!res.success) {
        this.setData({ error: res.message || '保存失败' });
        return;
      }
      await this.applyAccount(res);
      wx.showToast({ title: '手机号已更新', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      this.setData({ loadingPhone: false, error: err.message || '保存失败' });
    }
  },

  async submitWechat() {
    wx.showLoading({ title: '保存中...' });
    try {
      const res = await authService.updateWechatId(this.data.wechatId);
      wx.hideLoading();
      if (!res.success) {
        this.setData({ error: res.message || '保存失败' });
        return;
      }
      await this.applyAccount(res);
      wx.showToast({ title: '微信号已更新', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      this.setData({ error: err.message || '保存失败' });
    }
  }
});
