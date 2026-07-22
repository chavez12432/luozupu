const authGuard = require('../../utils/authGuard');
const authService = require('../../utils/authService');
const config = require('../../utils/config');
const localDb = require('../../utils/localDb');

Page({
  data: {
    isVerified: false,
    account: null,
    nameInitial: '',
    phoneMasked: '',
    isAdmin: false,
    isLocal: false,
    stats: {
      totalMembers: 0,
      brokenCount: 0
    }
  },

  onShow() {
    if (!authGuard.requireAuth({ replace: true })) return;
    this.refreshAccount();
    this.loadStats();
  },

  refreshAccount() {
    const { displayNameChar } = require('../../utils/nameInitial');
    const account = authService.getCachedAccount();
    this.setData({
      isVerified: !!account,
      account,
      nameInitial: account
        ? displayNameChar(account.name, {})
        : '',
      phoneMasked: account ? authService.maskPhone(account.phone) : '',
      isLocal: config.isLocalMode()
    });
  },

  async loadStats() {
    try {
      if (config.isLocalMode()) {
        const stats = localDb.getStats();
        const broken = localDb.filterCollection('members', { hasBrokenLineage: true }).length;
        this.setData({
          stats: {
            totalMembers: stats.members,
            brokenCount: broken
          }
        });
        return;
      }

      const db = wx.cloud.database();
      const { total } = await db.collection('members').count();
      const { total: brokenTotal } = await db.collection('members')
        .where({ hasBrokenLineage: true })
        .count();

      this.setData({
        stats: {
          totalMembers: total,
          brokenCount: brokenTotal
        }
      });
    } catch (err) {
      console.error('加载统计失败', err);
    }
  },

  goVerify() {
    wx.navigateTo({ url: '/pages/auth/welcome' });
  },

  goMyProfile() {
    const account = authService.getCachedAccount();
    if (!account || !account.personId) {
      this.goVerify();
      return;
    }
    wx.navigateTo({ url: `/pages/member/detail?id=${account.personId}` });
  },

  goRebind() {
    wx.navigateTo({ url: '/pages/account/rebind' });
  },

  resetBinding() {
    wx.showModal({
      title: '清除认证并重新关联',
      content: '将删除本微信在云端的旧绑定，然后可重新走身份验证。确认继续？',
      confirmText: '清除并重验',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '清除中...' });
        try {
          const result = await authService.resetMyBinding();
          wx.hideLoading();
          if (!result || !result.success) {
            wx.showToast({ title: (result && result.message) || '清除失败', icon: 'none' });
            return;
          }
          wx.showModal({
            title: '已清除',
            content: '请重新完成身份验证以关联族人。',
            showCancel: false,
            success: () => {
              wx.reLaunch({ url: '/pages/auth/welcome' });
            }
          });
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: err.message || '清除失败', icon: 'none' });
        }
      }
    });
  },

  logout() {
    if (!config.isLocalMode()) {
      this.resetBinding();
      return;
    }
    wx.showModal({
      title: '退出登录',
      content: '仅清除本机认证状态（本地调试）',
      success: (res) => {
        if (!res.confirm) return;
        authService.logoutLocal();
        wx.reLaunch({ url: '/pages/index/index' });
      }
    });
  },

  importData() {
    wx.showActionSheet({
      itemList: ['从Excel导入', '查看导入模板'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.chooseExcelFile();
        } else {
          this.downloadTemplate();
        }
      }
    });
  },

  chooseExcelFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xlsx', 'xls', 'csv'],
      success: (res) => {
        const filePath = res.tempFiles[0].path;
        this.uploadAndImport(filePath);
      }
    });
  },

  async uploadAndImport(filePath) {
    wx.showLoading({ title: '上传中...' });

    try {
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `imports/${Date.now()}.xlsx`,
        filePath: filePath
      });

      wx.showLoading({ title: '导入中...' });

      const { result } = await wx.cloud.callFunction({
        name: 'importMembers',
        data: {
          fileID: uploadRes.fileID
        }
      });

      wx.hideLoading();

      if (result.success) {
        wx.showModal({
          title: '导入成功',
          content: `成功导入 ${result.successCount} 条，失败 ${result.failCount} 条`,
          showCancel: false
        });
        this.loadStats();
      } else {
        wx.showModal({
          title: '导入失败',
          content: result.message,
          showCancel: false
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('导入失败', err);
      wx.showToast({ title: '导入失败', icon: 'none' });
    }
  },

  downloadTemplate() {
    wx.showModal({
      title: '导入模板',
      content: '模板字段：序号、世代、分堂、姓名、性别、出生日期、父亲姓名、父亲世代、是否断层、断层说明',
      showCancel: false
    });
  }
});
