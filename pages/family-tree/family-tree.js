// pages/family-tree/family-tree.js
const { buildPedigreeLayout, drawPedigree } = require('../../utils/pedigreeLayout');
const { FAMILY_TREE_HALLS } = require('../../utils/familyTreeHalls');
const authGuard = require('../../utils/authGuard');
const nav = require('../../utils/nav');

/** 世系图用户缩放档位（按比例缩放即可，极小比例可不求清晰） */
const SCALE_STEPS = [1.5, 1, 0.75, 0.5, 0.3, 0.1];
const DEFAULT_SCALE_INDEX = 1; // 100%

function scaleLabelOf(scale) {
  return `${Math.round(Number(scale) * 100)}%`;
}

Page({
  data: {
    mode: 'hub',
    halls: FAMILY_TREE_HALLS,
    currentBranch: '',
    loading: false,
    stats: null,
    scale: SCALE_STEPS[DEFAULT_SCALE_INDEX],
    scaleIndex: DEFAULT_SCALE_INDEX,
    scaleLabel: scaleLabelOf(SCALE_STEPS[DEFAULT_SCALE_INDEX]),
    displayWidth: 0,
    displayHeight: 0
  },

  layout: null,
  canvasNode: null,
  drawScale: 1,

  async onLoad() {
    if (!(await authGuard.requireAuthAsync({ replace: true }))) return;
    // 四堂入口用静态数据，不请求云端
    this.setData({ mode: 'hub', halls: FAMILY_TREE_HALLS, loading: false });
  },

  async onShow() {
    await authGuard.requireAuthAsync({ replace: true });
  },

  openHall(e) {
    const branch = e.currentTarget.dataset.branch;
    const scale = SCALE_STEPS[DEFAULT_SCALE_INDEX];
    this.setData({
      currentBranch: branch,
      mode: 'chart',
      scale,
      scaleIndex: DEFAULT_SCALE_INDEX,
      scaleLabel: scaleLabelOf(scale)
    });
    this.loadChart(branch);
  },

  backToHub() {
    this.layout = null;
    this.canvasNode = null;
    const scale = SCALE_STEPS[DEFAULT_SCALE_INDEX];
    this.setData({
      mode: 'hub',
      loading: false,
      currentBranch: '',
      stats: null,
      displayWidth: 0,
      displayHeight: 0,
      scale,
      scaleIndex: DEFAULT_SCALE_INDEX,
      scaleLabel: scaleLabelOf(scale)
    });
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

        // 物理像素硬顶，避免 150%×dpr 撑爆 Canvas 导致白屏/闪退
        const MAX_PHYS = 4096;
        const physW = cssW * dpr;
        const physH = cssH * dpr;
        const maxSide = Math.max(physW, physH, 1);
        const storeScale = maxSide > MAX_PHYS ? MAX_PHYS / maxSide : 1;

        canvas.width = Math.max(1, Math.floor(physW * storeScale));
        canvas.height = Math.max(1, Math.floor(physH * storeScale));
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr * drawScale * userScale * storeScale, dpr * drawScale * userScale * storeScale);
        drawPedigree(ctx, layout);
      });
  },

  zoomIn() {
    const idx = Math.max(0, (this.data.scaleIndex != null ? this.data.scaleIndex : DEFAULT_SCALE_INDEX) - 1);
    this.applyScaleAt(idx);
  },

  zoomOut() {
    const idx = Math.min(
      SCALE_STEPS.length - 1,
      (this.data.scaleIndex != null ? this.data.scaleIndex : DEFAULT_SCALE_INDEX) + 1
    );
    this.applyScaleAt(idx);
  },

  applyScaleAt(scaleIndex) {
    if (!this.layout) return;
    const idx = Math.max(0, Math.min(SCALE_STEPS.length - 1, scaleIndex));
    const scale = SCALE_STEPS[idx];
    const drawScale = this.drawScale || 1;
    this.setData({
      scale,
      scaleIndex: idx,
      scaleLabel: scaleLabelOf(scale),
      displayWidth: Math.ceil(this.layout.width * drawScale * scale),
      displayHeight: Math.ceil(this.layout.height * drawScale * scale)
    });
    setTimeout(() => this.renderCanvas(), 50);
  },

  applyScale(scale) {
    // 兼容旧调用：落到最接近的档位
    let best = 0;
    let bestDiff = Infinity;
    SCALE_STEPS.forEach((s, i) => {
      const d = Math.abs(s - scale);
      if (d < bestDiff) {
        bestDiff = d;
        best = i;
      }
    });
    this.applyScaleAt(best);
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
