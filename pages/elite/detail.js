// pages/elite/detail.js
const { getEliteHeroById } = require('../../utils/eliteHeroes');
const authGuard = require('../../utils/authGuard');

Page({
  data: {
    hero: null
  },

  onLoad(options) {
    if (!authGuard.requireAuth({ replace: true })) return;
    const hero = getEliteHeroById(options.id);
    if (!hero) {
      wx.showToast({ title: '未找到该小传', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({ hero });
    wx.setNavigationBarTitle({ title: `${hero.name}小传` });
  },

  goBack() {
    wx.navigateBack();
  }
});
