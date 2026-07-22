// pages/honor/index.js
const authGuard = require('../../utils/authGuard');
const nav = require('../../utils/nav');

Page({
  data: {},

  onShow() {
    authGuard.requireAuth({ replace: true });
  },

  goToIndex() {
    nav.goToIndex();
  },

  goToPreface() {
    nav.goToPreface();
  },

  goToPatriarchs() {
    wx.navigateTo({ url: '/pages/patriarchs/patriarchs' });
  },

  goToSages() {
    wx.navigateTo({ url: '/pages/sages/sages' });
  },

  goToElite() {
    wx.navigateTo({ url: '/pages/elite/elite' });
  },

  goToGraduates() {
    wx.navigateTo({ url: '/pages/graduates/graduates' });
  },

  goToSongshou() {
    wx.navigateTo({ url: '/pages/songshou/list' });
  },

  goToFengtu() {
    wx.navigateTo({ url: '/pages/fengtu/list' });
  },

  goToHall() {
    nav.goToHall();
  },

  goToMe() {
    nav.goToMe();
  }
});
