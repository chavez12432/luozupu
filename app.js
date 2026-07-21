const config = require('./utils/config');
const dataService = require('./utils/dataService');
const authService = require('./utils/authService');

App({
  onLaunch: function () {
    if (config.isLocalMode()) {
      dataService.bootstrap();
      this.globalData.authReadyPromise = Promise.resolve(authService.bootstrap());
      console.log('高洲罗氏族谱小程序启动（本地调试模式）');
      return;
    }

    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上基础库，并在微信开发者工具中开通云开发');
      this.globalData.authReadyPromise = Promise.resolve({ verified: false });
      return;
    }

    wx.cloud.init({
      env: config.CLOUD_ENV_ID || undefined,
      traceUser: true
    });

    this.globalData.authReadyPromise = authService.bootstrap().then(res => {
      console.log('认证会话', res.verified ? '已绑定' : '未认证');
      return res;
    });

    console.log('高洲罗氏族谱小程序启动（云开发模式）');
  },

  globalData: {
    userInfo: null,
    authAccount: null,
    isVerified: false,
    authReadyPromise: null,
    currentBranch: '中和堂',
    branches: ['中和堂', '明儒堂', '德裕堂', '忠爱堂']
  }
});
