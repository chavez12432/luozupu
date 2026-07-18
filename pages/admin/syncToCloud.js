// 将本地存储数据同步到云端
const authGuard = require('../../utils/authGuard');

Page({
  data: {
    localCount: 0,
    cloudCount: 0,
    syncing: false,
    progress: 0,
    status: '',
    imported: 0,
    total: 0,
    errors: []
  },

  onLoad() {
    if (!authGuard.requireAuth({ replace: true })) return;
    this.checkLocalData();
    this.checkCloudData();
  },

  onShow() {
    authGuard.requireAuth({ replace: true });
  },

  // 检查本地存储的数据
  checkLocalData() {
    try {
      const localData = wx.getStorageSync('luozupu_members');
      const members = localData ? JSON.parse(localData) : [];
      this.setData({ localCount: members.length });
    } catch (e) {
      console.error('读取本地数据失败:', e);
      this.setData({ localCount: 0 });
    }
  },

  // 检查云端数据数量
  async checkCloudData() {
    try {
      const db = wx.cloud.database();
      const countResult = await db.collection('members').count();
      this.setData({ cloudCount: countResult.total });
    } catch (e) {
      console.error('读取云端数据失败:', e);
      this.setData({ cloudCount: 0 });
    }
  },

  // 开始同步
  async startSync() {
    // 读取本地数据
    let members = [];
    try {
      const localData = wx.getStorageSync('luozupu_members');
      members = localData ? JSON.parse(localData) : [];
    } catch (e) {
      wx.showToast({ title: '读取本地数据失败', icon: 'none' });
      return;
    }

    if (members.length === 0) {
      wx.showToast({ title: '本地没有数据', icon: 'none' });
      return;
    }

    // 确认同步
    const res = await wx.showModal({
      title: '确认同步',
      content: `确定要将本地 ${members.length} 条数据同步到云端吗？`,
      confirmText: '确定',
      cancelText: '取消'
    });

    if (!res.confirm) return;

    this.setData({
      syncing: true,
      progress: 0,
      status: '准备同步...',
      imported: 0,
      total: members.length,
      errors: []
    });

    // 分批导入
    const batchSize = 50;
    let imported = 0;
    const errors = [];

    for (let i = 0; i < members.length; i += batchSize) {
      const batch = members.slice(i, i + batchSize);
      
      // 清理数据
      const cleanBatch = batch.map(member => {
        const { _id, createdAt, updatedAt, ...cleanMember } = member;
        return cleanMember;
      });

      try {
        const result = await wx.cloud.callFunction({
          name: 'batchImportMembers',
          data: {
            members: cleanBatch,
            startIndex: 0,
            batchSize: batchSize
          }
        });

        if (result.result.success) {
          imported += result.result.imported;
          if (result.result.errors) {
            errors.push(...result.result.errors);
          }
        } else {
          errors.push({ batch: i / batchSize, error: result.result.message });
        }

        // 更新进度
        const progress = Math.round(((i + batchSize) / members.length) * 100);
        this.setData({
          progress: progress > 100 ? 100 : progress,
          imported: imported,
          status: `已导入 ${imported} / ${members.length} 条...`
        });

      } catch (err) {
        console.error(`批次 ${i / batchSize} 失败:`, err);
        errors.push({ batch: i / batchSize, error: err.message });
      }
    }

    this.setData({
      syncing: false,
      progress: 100,
      status: errors.length === 0 ? '同步完成' : `完成，失败 ${errors.length} 条`,
      errors: errors
    });

    // 更新云端数量
    await this.checkCloudData();

    wx.showToast({
      title: `成功导入 ${imported} 条`,
      icon: 'success'
    });
  },

  // 清空云端数据
  async clearCloudData() {
    const res = await wx.showModal({
      title: '确认清空',
      content: '确定要清空云端所有数据吗？此操作不可恢复！',
      confirmText: '确定',
      cancelText: '取消',
      confirmColor: '#ff4d4f'
    });

    if (!res.confirm) return;

    wx.showLoading({ title: '清空中...' });

    try {
      const db = wx.cloud.database();
      const { data } = await db.collection('members').get();
      
      // 批量删除
      const deleteTasks = data.map(doc => {
        return db.collection('members').doc(doc._id).remove();
      });
      
      await Promise.all(deleteTasks);
      
      wx.hideLoading();
      wx.showToast({ title: '清空完成', icon: 'success' });
      this.setData({ cloudCount: 0 });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '清空失败', icon: 'none' });
    }
  },

  // 从云端下载到本地
  async downloadFromCloud() {
    const res = await wx.showModal({
      title: '确认下载',
      content: '确定要从云端下载数据到本地吗？本地数据将被覆盖！',
      confirmText: '确定',
      cancelText: '取消'
    });

    if (!res.confirm) return;

    wx.showLoading({ title: '下载中...' });

    try {
      const db = wx.cloud.database();
      const MAX_LIMIT = 100;
      
      // 先获取总数
      const countResult = await db.collection('members').count();
      const total = countResult.total;
      
      // 分批获取
      const batchTimes = Math.ceil(total / MAX_LIMIT);
      const tasks = [];
      
      for (let i = 0; i < batchTimes; i++) {
        const promise = db.collection('members')
          .skip(i * MAX_LIMIT)
          .limit(MAX_LIMIT)
          .get();
        tasks.push(promise);
      }
      
      const results = await Promise.all(tasks);
      let allData = [];
      for (const result of results) {
        allData = allData.concat(result.data);
      }
      
      // 保存到本地存储
      wx.setStorageSync('luozupu_members', JSON.stringify(allData));
      
      wx.hideLoading();
      wx.showToast({ 
        title: `下载 ${allData.length} 条数据`, 
        icon: 'success' 
      });
      
      this.setData({ localCount: allData.length });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '下载失败', icon: 'none' });
    }
  }
});
