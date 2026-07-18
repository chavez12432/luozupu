const authGuard = require('../../utils/authGuard');
const memberManageService = require('../../utils/memberManageService');

Page({
  data: {
    relation: 'child',
    relationLabel: '子女',
    name: '',
    genders: ['男', '女'],
    genderIndex: 0,
    loading: false
  },

  onLoad(options) {
    if (!authGuard.requireAuth({ replace: true })) return;
    const relation = options.relation === 'spouse' ? 'spouse' : 'child';
    this.setData({
      relation,
      relationLabel: relation === 'spouse' ? '配偶' : '子女',
      genderIndex: relation === 'spouse' ? 1 : 0
    });
    wx.setNavigationBarTitle({
      title: relation === 'spouse' ? '添加配偶' : '添加子女'
    });
  },

  onName(e) {
    this.setData({ name: e.detail.value });
  },

  onGenderChange(e) {
    this.setData({ genderIndex: Number(e.detail.value) });
  },

  async submit() {
    if (this.data.loading) return;
    const name = String(this.data.name || '').trim();
    if (!name) {
      wx.showToast({ title: '请填写姓名', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    wx.showLoading({ title: '提交中...' });
    try {
      const res = await memberManageService.addFamily({
        relation: this.data.relation,
        name,
        gender: this.data.genders[this.data.genderIndex]
      });
      wx.hideLoading();
      this.setData({ loading: false });
      if (!res.success) {
        wx.showToast({ title: res.message || '添加失败', icon: 'none' });
        return;
      }
      wx.showToast({ title: '已添加', icon: 'success' });
      const newId = res.data && res.data._id;
      setTimeout(() => {
        if (newId) {
          wx.redirectTo({ url: `/pages/member/detail?id=${newId}` });
        } else {
          wx.navigateBack();
        }
      }, 400);
    } catch (err) {
      wx.hideLoading();
      this.setData({ loading: false });
      wx.showToast({ title: err.message || '添加失败', icon: 'none' });
    }
  }
});
