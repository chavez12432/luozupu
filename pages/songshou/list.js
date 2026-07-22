const { list, contents } = require('./data');

Page({
  data: {
    items: list
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/songshou/detail?id=${id}` });
  },

  goToHonor() {
    wx.redirectTo({ url: '/pages/honor/index' });
  }
});
