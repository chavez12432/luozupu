// pages/family-tree/family-tree.js
const { buildPedigreeLayout, drawPedigree } = require('../../utils/pedigreeLayout');
const authGuard = require('../../utils/authGuard');
const nav = require('../../utils/nav');

Page({
  data: {
    mode: 'hub',
    halls: [],
    currentBranch: '',
    loading: false,
    stats: null,
    scale: 1,
    scaleLabel: '100%',
    displayWidth: 0,
    displayHeight: 0
  },

  layout: null,
  canvasNode: null,
  drawScale: 1,

  onLoad() {
    if (!authGuard.requireAuth({ replace: true })) return;
    this.loadHub();
  },

  onShow() {
    authGuard.requireAuth({ replace: true });
  },

  async loadHub() {
    this.setData({ loading: true, mode: 'hub' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminApi',
        data: { action: 'getFamilyTree' }
      });
      if (res.result && res.result.success) {
        this.setData({ halls: res.result.data.halls || [] });
      }
    } catch (err) {
      console.error(err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  openHall(e) {
    const branch = e.currentTarget.dataset.branch;
    this.setData({ currentBranch: branch, mode: 'chart', scale: 1, scaleLabel: '100%' });
    this.loadChart(branch);
  },

  backToHub() {
    this.layout = null;
    this.canvasNode = null;
    this.loadHub();
  },

  async loadChart(branch) {
    this.setData({ loading: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminApi',
        data: { action: 'getFamilyTree', branch }
      });
      if (!res.result || !res.result.success) {
        throw new Error('no data');
      }
      const members = res.result.data.members || [];
      const layout = buildPedigreeLayout(members, branch, { maxCanvasW: 4096 });
      this.layout = layout;

      // 控制像素上限，过大则整体缩放绘制
      const maxPx = 4096;
      let drawScale = 1;
      if (layout.width > maxPx) drawScale = maxPx / layout.width;
      if (layout.height * drawScale > maxPx) {
        drawScale = Math.min(drawScale, maxPx / layout.height);
      }
      this.drawScale = drawScale;

      const userScale = this.data.scale || 1;
      const displayWidth = Math.ceil(layout.width * drawScale * userScale);
      const displayHeight = Math.ceil(layout.height * drawScale * userScale);

      this.setData({
        stats: layout.stats,
        displayWidth,
        displayHeight,
        loading: false
      });

      setTimeout(() => this.renderCanvas(), 50);
    } catch (err) {
      console.error(err);
      this.setData({ loading: false });
      wx.showToast({ title: '世系图加载失败', icon: 'none' });
    }
  },

  renderCanvas() {
    const layout = this.layout;
    if (!layout) return;

    const query = wx.createSelectorQuery();
    query.select('#pedigreeCanvas')
      .fields({ node: true, size: true })
      .exec(res => {
        const canvas = res && res[0] && res[0].node;
        if (!canvas) return;
        this.canvasNode = canvas;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio || 1;
        const drawScale = this.drawScale || 1;
        const userScale = this.data.scale || 1;
        const cssW = Math.ceil(layout.width * drawScale * userScale);
        const cssH = Math.ceil(layout.height * drawScale * userScale);

        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
        ctx.scale(dpr * drawScale * userScale, dpr * drawScale * userScale);
        drawPedigree(ctx, layout);
      });
  },

  zoomIn() {
    const scale = Math.min(2.5, +(this.data.scale + 0.25).toFixed(2));
    this.applyScale(scale);
  },

  zoomOut() {
    const scale = Math.max(0.5, +(this.data.scale - 0.25).toFixed(2));
    this.applyScale(scale);
  },

  applyScale(scale) {
    if (!this.layout) return;
    const drawScale = this.drawScale || 1;
    this.setData({
      scale,
      scaleLabel: `${Math.round(scale * 100)}%`,
      displayWidth: Math.ceil(this.layout.width * drawScale * scale),
      displayHeight: Math.ceil(this.layout.height * drawScale * scale)
    });
    setTimeout(() => this.renderCanvas(), 50);
  },

  goBack() {
    if (this.data.mode === 'chart') {
      this.backToHub();
      return;
    }
    wx.navigateBack();
  },

  goToIndex() {
    nav.goToIndex();
  },

  goToPreface() {
    nav.goToPreface();
  },

  goToHonor() {
    nav.goToHonor();
  },

  goToMe() {
    nav.goToMe();
  }
});
