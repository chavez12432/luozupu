// pages/elite/detail.js
const authGuard = require('../../utils/authGuard');

Page({
  data: {
    hero: null
  },

  onLoad(options) {
    if (!authGuard.requireAuth({ replace: true })) return;
    this.loadHero(options.id || '');
  },

  async loadHero(id) {
    if (!id) {
      wx.showToast({ title: '未找到该小传', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminApi',
        data: { action: 'getElite', data: { _id: id } }
      });
      wx.hideLoading();
      if (!res.result || !res.result.success || !res.result.data) {
        wx.showToast({ title: '未找到该小传', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1200);
        return;
      }
      const item = res.result.data;
      let paragraphs = item.paragraphs;
      if (!paragraphs || !paragraphs.length) {
        paragraphs = String(item.biography || '')
          .split(/\n\n+/)
          .map(s => s.trim())
          .filter(Boolean);
      }
      const hero = {
        name: item.name,
        branch: item.branch,
        generation: item.generation,
        birthYear: item.birthYear,
        summary: item.summary,
        paragraphs,
        memberDocId: item.memberDocId || '',
        hasLink: !!(item.hasLink || item.memberDocId)
      };
      this.setData({ hero });
      wx.setNavigationBarTitle({ title: `${hero.name}小传` });
    } catch (err) {
      wx.hideLoading();
      console.error(err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  viewMember() {
    const id = this.data.hero && this.data.hero.memberDocId;
    if (!id) {
      wx.showToast({ title: '暂未关联族谱详情', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/member/detail?id=${encodeURIComponent(id)}`
    });
  },

  goBack() {
    wx.navigateBack();
  }
});
