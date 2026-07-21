// pages/patriarchs/patriarchs.js
const authGuard = require('../../utils/authGuard');

Page({
  data: {
    patriarchs: [],
    loading: false
  },

  onLoad() {
    if (!authGuard.requireAuth({ replace: true })) return;
    this.loadData();
  },

  onShow() {
    authGuard.requireAuth({ replace: true });
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminApi',
        data: { action: 'listPatriarchs' }
      });
      if (res.result && res.result.success) {
        this.setData({ patriarchs: res.result.data || [] });
      }
    } catch (err) {
      console.error('加载失败', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  viewMember(e) {
    const id = e.currentTarget.dataset.id;
    const hasLink = e.currentTarget.dataset.link;
    if (!id || hasLink === false || hasLink === 'false') {
      wx.showToast({ title: '暂未关联族谱详情', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/member/detail?id=${encodeURIComponent(id)}`
    });
  },

  goBack() {
    wx.navigateBack();
  },

  goToHonor() {
    wx.redirectTo({ url: '/pages/honor/index' });
  }
});
