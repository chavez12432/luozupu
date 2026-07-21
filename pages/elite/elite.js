// pages/elite/elite.js
const authGuard = require('../../utils/authGuard');

Page({
  data: {
    elite: [],
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
        data: { action: 'listElite', page: 1, pageSize: 100 }
      });
      const list = (res.result && res.result.success && res.result.data) || [];
      this.setData({
        elite: list.map(item => ({
          id: item._id,
          heroId: item.heroId || '',
          name: item.name,
          branch: item.branch,
          generation: item.generation
        }))
      });
    } catch (err) {
      console.error('加载失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ elite: [] });
    } finally {
      this.setData({ loading: false });
    }
  },

  viewHero(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/elite/detail?id=${encodeURIComponent(id)}` });
  },

  goBack() {
    wx.navigateBack();
  },

  goToHonor() {
    wx.redirectTo({ url: '/pages/honor/index' });
  }
});
