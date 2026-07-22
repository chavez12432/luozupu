Component({
  properties: {
    title: { type: String, value: '高洲罗氏家谱' },
    /** images/headers/{scene}.jpg */
    scene: { type: String, value: 'honor' },
    showBack: { type: Boolean, value: false }
  },

  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    bgSrc: '/images/headers/honor.jpg'
  },

  observers: {
    scene(v) {
      const key = String(v || 'honor').trim() || 'honor';
      this.setData({ bgSrc: `/images/headers/${key}.jpg` });
    }
  },

  lifetimes: {
    attached() {
      try {
        const sys = wx.getSystemInfoSync();
        const menu = wx.getMenuButtonBoundingClientRect();
        const statusBarHeight = sys.statusBarHeight || 20;
        const gap = Math.max(0, (menu.top || statusBarHeight) - statusBarHeight);
        const navBarHeight = gap * 2 + (menu.height || 32);
        this.setData({
          statusBarHeight,
          navBarHeight: Math.max(44, navBarHeight)
        });
      } catch (e) {
        // keep defaults
      }
      const key = String(this.data.scene || 'honor').trim() || 'honor';
      this.setData({ bgSrc: `/images/headers/${key}.jpg` });
    }
  },

  methods: {
    onBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack({ delta: 1 });
      } else {
        wx.reLaunch({ url: '/pages/index/index' });
      }
    }
  }
});
