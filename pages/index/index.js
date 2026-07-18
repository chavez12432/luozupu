const { DEFAULT_PAGE_SIZE } = require('../../utils/constants');
const authGuard = require('../../utils/authGuard');
const authService = require('../../utils/authService');
const nav = require('../../utils/nav');

Page({
  data: {
    isVerified: false,
    accountName: '',
    currentBranch: '',
    branches: ['全部', '中和堂', '明儒堂', '德裕堂', '忠爱堂'],
    members: [],
    currentGeneration: null,
    generationRange: [],
    loading: false,
    loadingMore: false,
    page: 1,
    hasMore: true,
    totalCount: 0,
    branchGenerationRanges: {
      '全部': { min: 1, max: 50 },
      '中和堂': { min: 1, max: 20 },
      '明儒堂': { min: 18, max: 50 },
      '德裕堂': { min: 18, max: 50 },
      '忠爱堂': { min: 18, max: 50 }
    }
  },

  onShow() {
    const verified = authGuard.checkVerified();
    const account = authService.getCachedAccount();
    this.setData({
      isVerified: verified,
      accountName: (account && account.name) || ''
    });
    if (verified) {
      this.updateGenerationRange();
      if (!this.data.members.length) {
        this.loadMembers(true);
      }
    }
  },

  onLoad() {
    // 数据加载在 onShow 中按认证状态决定
  },

  updateGenerationRange() {
    const branch = this.data.currentBranch || '全部';
    const range = this.data.branchGenerationRanges[branch] || { min: 1, max: 35 };
    const rangeArray = [{ value: null, label: '全部世代' }];

    for (let i = range.min; i <= range.max; i++) {
      rangeArray.push({ value: i, label: `第 ${i} 世` });
    }

    this.setData({ generationRange: rangeArray });
  },

  switchBranch(e) {
    if (!this.data.isVerified) return;
    const branch = e.currentTarget.dataset.branch;
    this.setData({
      currentBranch: branch === '全部' ? '' : branch,
      currentGeneration: null
    });
    this.updateGenerationRange();
    this.loadMembers(true);
  },

  onGenerationChange(e) {
    if (!this.data.isVerified) return;
    const index = parseInt(e.detail.value, 10);
    const selected = this.data.generationRange[index];
    this.setData({ currentGeneration: selected.value });
    this.loadMembers(true);
  },

  buildParams(page) {
    const params = {
      branch: this.data.currentBranch,
      page,
      pageSize: DEFAULT_PAGE_SIZE
    };
    if (this.data.currentGeneration) {
      params.generation = this.data.currentGeneration;
    }
    return params;
  },

  async loadMembers(reset) {
    if (!this.data.isVerified) return;

    if (reset) {
      this.setData({ loading: true, page: 1, hasMore: true, members: [] });
    } else {
      if (!this.data.hasMore || this.data.loadingMore) return;
      this.setData({ loadingMore: true });
    }

    const page = reset ? 1 : this.data.page;

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'getMembers',
        data: this.buildParams(page)
      });

      if (!result || result.success === false) {
        throw new Error((result && result.message) || '加载失败');
      }

      const list = result.data || [];
      this.setData({
        members: reset ? list : this.data.members.concat(list),
        totalCount: result.total != null ? result.total : list.length,
        page: page + 1,
        hasMore: result.hasMore != null ? result.hasMore : list.length >= DEFAULT_PAGE_SIZE,
        loading: false,
        loadingMore: false
      });
    } catch (err) {
      console.error('加载失败', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false, loadingMore: false });
    }
  },

  loadMore() {
    this.loadMembers(false);
  },

  onPersonTap(e) {
    if (!authGuard.requireAuth()) return;
    const id = e.detail && e.detail.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/member/detail?id=${id}` });
  },

  viewMember(e) {
    if (!authGuard.requireAuth()) return;
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/member/detail?id=${id}` });
  },

  goToPreface() {
    wx.navigateTo({ url: '/pages/preface/list' });
  },

  goToHonor() {
    nav.goToHonor();
  },

  goToHall() {
    nav.goToHall();
  },

  goToAuth() {
    wx.navigateTo({ url: '/pages/auth/welcome' });
  },

  goToMe() {
    nav.goToMe();
  },

  goToProfile() {
    nav.goToMe();
  }
});
