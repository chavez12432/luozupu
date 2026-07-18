// pages/graduates/graduates.js
const authGuard = require('../../utils/authGuard');

Page({
  data: {
    tabs: [
      { key: 'imperial', label: '科举功名', count: 0 },
      { key: 'republican', label: '民国—2000', count: 0 },
      { key: 'modern', label: '1997年后', count: 0 }
    ],
    currentTab: 'imperial',
    imperial: [],
    republican: [],
    modern: [],
    list: [],
    loading: false,
    counts: { imperial: 0, republican: 0, modern: 0 }
  },

  onLoad() {
    if (!authGuard.requireAuth({ replace: true })) return;
    this.loadData();
  },

  onShow() {
    authGuard.requireAuth({ replace: true });
  },

  switchTab(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({
      currentTab: key,
      list: this.data[key] || []
    });
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminApi',
        data: { action: 'listEducationHonor' }
      });

      if (res.result && res.result.success) {
        const data = res.result.data || {};
        const imperial = data.imperial || [];
        const republican = data.republican || [];
        const modern = data.modern || [];
        const currentTab = this.data.currentTab;
        this.setData({
          imperial,
          republican,
          modern,
          list: { imperial, republican, modern }[currentTab] || [],
          counts: {
            imperial: imperial.length,
            republican: republican.length,
            modern: modern.length
          },
          tabs: [
            { key: 'imperial', label: '科举功名', count: imperial.length },
            { key: 'republican', label: '民国—2000', count: republican.length },
            { key: 'modern', label: '1997年后', count: modern.length }
          ]
        });
      }
    } catch (err) {
      console.error('加载学历榜失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  viewMember(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      wx.showToast({ title: '无法打开详情', icon: 'none' });
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
