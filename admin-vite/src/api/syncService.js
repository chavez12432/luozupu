/**
 * 数据同步服务
 * 实现 Web 后台本地数据与微信云开发的同步
 */

import { getMembers, saveMembers, clearAllMembers } from './localStorage.js';

// 云开发环境配置
const CLOUD_ENV = 'luoshi-7g0fx8maef33f709';

/**
 * 同步本地数据到云端
 * @param {Function} progressCallback - 进度回调函数
 * @returns {Promise<Object>} 同步结果
 */
export async function syncToCloud(progressCallback = null) {
  const localData = getMembers();
  
  if (localData.length === 0) {
    return { success: false, message: '本地没有数据可同步' };
  }

  const results = {
    success: true,
    total: localData.length,
    uploaded: 0,
    failed: 0,
    errors: []
  };

  // 分批上传，每批50条
  const batchSize = 50;
  
  for (let i = 0; i < localData.length; i += batchSize) {
    const batch = localData.slice(i, i + batchSize);
    
    try {
      // 清理本地字段，准备上传
      const cleanBatch = batch.map(member => {
        const { _id, createdAt, updatedAt, ...cleanMember } = member;
        return {
          ...cleanMember,
          syncId: _id, // 保留本地ID用于关联
          syncAt: new Date().toISOString()
        };
      });

      // 调用云函数上传
      const result = await callCloudFunction('batchImportMembers', {
        members: cleanBatch,
        startIndex: 0,
        batchSize: batchSize
      });

      if (result.success) {
        results.uploaded += result.imported;
        if (result.errors) {
          results.errors.push(...result.errors);
          results.failed += result.errors.length;
        }
      } else {
        results.failed += batch.length;
        results.errors.push({ batch: i / batchSize, error: result.message });
      }

      // 更新进度
      if (progressCallback) {
        progressCallback({
          current: Math.min(i + batchSize, localData.length),
          total: localData.length,
          percentage: Math.round(((i + batchSize) / localData.length) * 100)
        });
      }
    } catch (error) {
      console.error(`批次 ${i / batchSize} 上传失败:`, error);
      results.failed += batch.length;
      results.errors.push({ batch: i / batchSize, error: error.message });
    }
  }

  results.success = results.failed === 0;
  return results;
}

/**
 * 从云端同步数据到本地
 * @param {Function} progressCallback - 进度回调函数
 * @returns {Promise<Object>} 同步结果
 */
export async function syncFromCloud(progressCallback = null) {
  try {
    // 调用云函数获取所有数据
    const result = await callCloudFunction('getAllMembers', {});
    
    if (!result.success) {
      return { success: false, message: result.message || '获取云端数据失败' };
    }

    const cloudData = result.data || [];
    
    if (cloudData.length === 0) {
      return { success: false, message: '云端没有数据' };
    }

    // 清空本地数据
    clearAllMembers();

    // 转换云端数据为本地格式
    const localFormatData = cloudData.map(item => ({
      ...item,
      _id: item._id || 'cloud_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString()
    }));

    // 保存到本地
    saveMembers(localFormatData);

    if (progressCallback) {
      progressCallback({
        current: localFormatData.length,
        total: localFormatData.length,
        percentage: 100
      });
    }

    return {
      success: true,
      count: localFormatData.length,
      message: `成功同步 ${localFormatData.length} 条数据到本地`
    };
  } catch (error) {
    console.error('从云端同步失败:', error);
    return { success: false, message: error.message };
  }
}

/**
 * 比较本地和云端数据差异
 */
export async function compareData() {
  const localData = getMembers();
  
  try {
    const result = await callCloudFunction('getAllMembers', {});
    const cloudData = result.data || [];

    // 统计差异
    const localIds = new Set(localData.map(m => m.memberId));
    const cloudIds = new Set(cloudData.map(m => m.memberId));

    const onlyInLocal = localData.filter(m => !cloudIds.has(m.memberId));
    const onlyInCloud = cloudData.filter(m => !localIds.has(m.memberId));
    const inBoth = localData.filter(m => cloudIds.has(m.memberId));

    return {
      success: true,
      localCount: localData.length,
      cloudCount: cloudData.length,
      onlyInLocal: onlyInLocal.length,
      onlyInCloud: onlyInCloud.length,
      inBoth: inBoth.length,
      details: {
        onlyInLocal: onlyInLocal.map(m => ({ memberId: m.memberId, name: m.name })),
        onlyInCloud: onlyInCloud.map(m => ({ memberId: m.memberId, name: m.name }))
      }
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * 清空云端数据
 */
export async function clearCloudData() {
  try {
    const result = await callCloudFunction('clearAllMembers', {});
    return result;
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * 调用云函数
 */
async function callCloudFunction(name, data = {}) {
  // 方案1: 如果在微信开发者工具的 WebView 中
  if (typeof wx !== 'undefined' && wx.cloud) {
    try {
      const result = await wx.cloud.callFunction({
        name,
        data
      });
      return result.result;
    } catch (err) {
      console.error('云函数调用失败:', err);
      throw new Error(err.message || '云函数调用失败');
    }
  }
  
  // 方案2: 使用 HTTP API（需要配置云开发 HTTP 访问服务）
  // 这里需要您配置云开发的 HTTP API 访问
  throw new Error('请在微信开发者工具中打开此页面，或配置云开发 HTTP API 访问');
}

export default {
  syncToCloud,
  syncFromCloud,
  compareData,
  clearCloudData
};
