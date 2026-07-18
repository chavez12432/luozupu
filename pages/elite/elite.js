// pages/elite/elite.js
const { ELITE_HEROES } = require('../../utils/eliteHeroes');
const authGuard = require('../../utils/authGuard');

const RESET_FLAG = 'eliteHeroesResetV1';

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
      await this.clearLegacyEliteOnce();
      this.setData({
        elite: ELITE_HEROES.map(item => ({
          id: item.id,
          name: item.name,
          branch: item.branch,
          generation: item.generation
        }))
      });
    } catch (err) {
      console.error('加载失败', err);
      this.setData({
        elite: ELITE_HEROES.map(item => ({
          id: item.id,
          name: item.name,
          branch: item.branch,
          generation: item.generation
        }))
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async clearLegacyEliteOnce() {
    if (wx.getStorageSync(RESET_FLAG)) return;
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminApi',
        data: { action: 'resetEliteHeroes' }
      });
      if (res.result && res.result.success) {
        wx.setStorageSync(RESET_FLAG, 1);
      }
    } catch (err) {
      console.warn('清空群英榜关联失败（可忽略）', err);
    }
  },

  viewHero(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/elite/detail?id=${id}` });
  },

  goBack() {
    wx.navigateBack();
  },

  goToHonor() {
    wx.redirectTo({ url: '/pages/honor/index' });
  }
});
