Page({
  data: {
    phase: 0, // 0背景 1Logo 2名称 3水墨 4按钮
    entering: false
  },

  onLoad() {
    this._timers = [];
    this.playIntro();
  },

  onUnload() {
    (this._timers || []).forEach((t) => clearTimeout(t));
  },

  playIntro() {
    const steps = [80, 480, 980, 1480, 2100];
    steps.forEach((ms, i) => {
      const t = setTimeout(() => {
        this.setData({ phase: i + 1 });
      }, ms);
      this._timers.push(t);
    });
  },

  enterClan() {
    if (this.data.entering) return;
    this.setData({ entering: true });
    wx.reLaunch({ url: '/pages/index/index' });
  }
});
