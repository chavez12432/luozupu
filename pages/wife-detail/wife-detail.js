// pages/wife-detail/wife-detail.js
const { BRANCH_CODE_MAP } = require('../../utils/constants');
const authGuard = require('../../utils/authGuard');

Page({
  data: {
    wife: null,
    husbandDocId: '',
    husbandBranch: '',
    husbandBranchCode: 'zhonghe',
    loading: true
  },

  onLoad(options) {
    if (!authGuard.requireAuth({ replace: true })) return;
    this.loadWifeDetail(options.id);
  },

  onShow() {
    authGuard.requireAuth({ replace: true });
  },

  async loadWifeDetail(id) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminApi',
        data: {
          action: 'getWife',
          data: { _id: id }
        }
      });

      if (!res.result || !res.result.success) {
        wx.showToast({ title: '加载失败', icon: 'none' });
        this.setData({ loading: false });
        return;
      }

      const wife = res.result.data;
      let husbandBranch = '中和堂';
      let husbandBranchCode = 'zhonghe';
      let husbandDocId = '';

      if (wife.husbandId) {
        const husbandRes = await wx.cloud.callFunction({
          name: 'adminApi',
          data: {
            action: 'getMemberByOriginalId',
            data: { originalId: wife.husbandId }
          }
        });

        if (husbandRes.result && husbandRes.result.data) {
          const husband = husbandRes.result.data;
          husbandDocId = husband._id;
          husbandBranch = husband.branch || '中和堂';
          husbandBranchCode = BRANCH_CODE_MAP[husbandBranch] || 'zhonghe';
        }
      }

      const statusMap = {
        married: '在婚',
        widowed: '丧偶',
        divorced: '离异'
      };

      this.setData({
        wife,
        husbandDocId,
        husbandBranch,
        husbandBranchCode,
        marriageStatusText: statusMap[wife.marriageStatus] || '',
        loading: false
      });
    } catch (err) {
      console.error('加载失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  goToHusband() {
    if (!this.data.husbandDocId) {
      wx.showToast({ title: '暂无详情', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/member/detail?id=${this.data.husbandDocId}`
    });
  },

  goBack() {
    wx.navigateBack();
  }
});
