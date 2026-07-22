const config = require('../../utils/config');
const localSeed = require('../../utils/fengtuSeed');

Page({
  data: {
    items: [],
    loading: false
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      let list = [];
      if (config.isLocalMode && config.isLocalMode()) {
        list = localSeed.list || [];
      } else {
        const res = await wx.cloud.callFunction({
          name: 'adminApi',
          data: { action: 'listFengtu', page: 1, pageSize: 100 }
        });
        if (res.result && res.result.success) {
          list = res.result.data || [];
        } else {
          list = localSeed.list || [];
        }
      }
      this.setData({ items: list });
    } catch (e) {
      console.error(e);
      this.setData({ items: localSeed.list || [] });
    } finally {
      this.setData({ loading: false });
    }
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/fengtu/detail?id=${encodeURIComponent(id)}` });
  }
});
