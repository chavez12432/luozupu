const config = require('../../utils/config');
const authService = require('../../utils/authService');

function phoneAuthErrorMessage(detail) {
  const msg = (detail && detail.errMsg) || '';
  const errno = detail && detail.errno;
  if (msg.indexOf('deny') >= 0 || msg.indexOf('cancel') >= 0 || errno === 103) {
    return '您未允许获取手机号。请再次点击上方按钮并选择允许，或直接在下方手动填写手机号。';
  }
  if (msg.indexOf('no permission') >= 0 || errno === 1400001 || errno === 10001) {
    return '当前小程序暂未开通手机号快速验证能力。请使用下方手动填写手机号完成绑定。';
  }
  if (msg.indexOf('privacy') >= 0) {
    return '请先同意隐私保护指引，再授权手机号；也可在下方手动填写。';
  }
  return '未能通过微信获取手机号，请再次点击授权，或在下方手动填写。';
}

Page({
  data: {
    ticketId: '',
    personName: '',
    isLocal: false,
    phone: '',
    error: '',
    loading: false
  },

  onLoad(options) {
    this.setData({
      ticketId: decodeURIComponent(options.ticketId || ''),
      personName: decodeURIComponent(options.name || ''),
      isLocal: config.isLocalMode()
    });
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value, error: '' });
  },

  onAgreePrivacy() {
    // 隐私协议同意回调，无需额外处理；手机号授权在 bindgetphonenumber
  },

  async finishBind(payload) {
    this.setData({ loading: true, error: '' });
    wx.showLoading({ title: '绑定中...' });
    try {
      const res = await authService.bindPhone(this.data.ticketId, payload);
      wx.hideLoading();
      this.setData({ loading: false });

      if (!res.success) {
        this.setData({ error: res.message || '绑定失败' });
        return;
      }

      if (res.account) {
        wx.setStorageSync(authService.ACCOUNT_KEY, res.account);
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.authAccount = res.account;
          app.globalData.isVerified = true;
        }
      }

      wx.showToast({ title: '认证成功', icon: 'success' });
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/index/index' });
      }, 500);
    } catch (err) {
      wx.hideLoading();
      this.setData({ loading: false, error: err.message || '网络错误' });
    }
  },

  onGetPhoneNumber(e) {
    const detail = e.detail || {};
    if (detail.errMsg !== 'getPhoneNumber:ok') {
      this.setData({ error: phoneAuthErrorMessage(detail) });
      return;
    }
    const cloudID = detail.cloudID;
    if (!cloudID) {
      this.setData({
        error: '未获取到手机号凭证。请升级微信后重试，或在下方手动填写手机号。'
      });
      return;
    }
    this.finishBind({ cloudID });
  },

  bindManualPhone() {
    const phone = String(this.data.phone || '').trim();
    if (!/^1\d{10}$/.test(phone)) {
      this.setData({ error: '请输入有效的11位手机号' });
      return;
    }
    this.finishBind({ phone });
  }
});
