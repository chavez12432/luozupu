// pages/sages/sages.js
const authGuard = require('../../utils/authGuard');

Page({
  data: {
    dynasties: ['全部', '宋', '元', '明', '清', '近现代'],
    currentDynasty: '全部',
    intro: '',
    sages: [],
    loading: false,
    page: 1,
    hasMore: true
  },

  onLoad() {
    if (!authGuard.requireAuth({ replace: true })) return;
    this.loadData();
  },

  onShow() {
    authGuard.requireAuth({ replace: true });
  },

  switchDynasty(e) {
    const dynasty = e.currentTarget.dataset.dynasty;
    this.setData({ currentDynasty: dynasty, page: 1, sages: [] });
    this.loadData();
  },

  async loadData() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'adminApi',
        data: {
          action: 'listSages',
          dynasty: this.data.currentDynasty === '全部' ? null : this.data.currentDynasty,
          page: this.data.page,
          pageSize: 50,
          // 清理臆造乡贤请走管理端 purgeFabricatedSages，勿挂在列表首屏
          purgeFabricated: false
        }
      });

      if (res.result && res.result.success) {
        const newData = res.result.data || [];
        this.setData({
          intro: res.result.intro || this.data.intro,
          sages: this.data.page === 1 ? newData : [...this.data.sages, ...newData],
          hasMore: newData.length >= 50
        });
      }
    } catch (err) {
      console.error('加载失败', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  loadMore() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadData();
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
