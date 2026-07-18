const config = require('./utils/config');
const dataService = require('./utils/dataService');
const authService = require('./utils/authService');

App({
  onLaunch: function () {
    if (config.isLocalMode()) {
      // 族人主数据在主包，同步即可用；分包（配偶/农历）按需加载，避免启动报 mod/errcode
      dataService.bootstrap();
      authService.bootstrap();
      console.log('高洲罗氏族谱小程序启动（本地调试模式）');
      return;
    }

    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上基础库，并在微信开发者工具中开通云开发');
      return;
    }

    wx.cloud.init({
      env: config.CLOUD_ENV_ID || undefined,
      traceUser: true
    });

    authService.bootstrap().then(res => {
      console.log('认证会话', res.verified ? '已绑定' : '未认证');
    });

    console.log('高洲罗氏族谱小程序启动（云开发模式）');
  },

  globalData: {
    userInfo: null,
    authAccount: null,
    isVerified: false,
    currentBranch: '中和堂',
    branches: ['中和堂', '明儒堂', '德裕堂', '忠爱堂']
  }
});
