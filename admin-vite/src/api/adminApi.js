/**
 * 管理员 API
 * 通过 HTTP 调用云函数，实现 Web 后台直接操作云数据库
 */

// 云开发环境 ID
const CLOUD_ENV = 'luoshi-7g0fx8maef33f709';

// 云函数 HTTP 触发器基础 URL
const BASE_URL = `https://luoshi-7g0fx8maef33f709-1423035114.sh.ap-shanghai.app.tcloudbase.com/adminApi`;

/**
 * 调用云函数 HTTP 触发器
 */
async function callCloudFunction(action, data = {}) {
  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action,
        data,
        members: data.members
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('调用云函数失败:', error);
    throw new Error('连接云开发失败，请检查云函数是否已部署并开启 HTTP 触发器');
  }
}

/**
 * 成员 API
 */
export const memberApi = {
  // 获取列表
  async getList(params = {}) {
    return callCloudFunction('list', params);
  },

  // 获取单个
  async getById(id) {
    return callCloudFunction('get', { _id: id });
  },

  // 创建
  async create(data) {
    return callCloudFunction('create', data);
  },

  // 更新
  async update(id, data) {
    return callCloudFunction('update', { _id: id, ...data });
  },

  // 删除
  async delete(id) {
    return callCloudFunction('delete', { _id: id });
  },

  // 批量导入
  async batchImport(members) {
    return callCloudFunction('batchImport', { members });
  }
};

/**
 * 数据同步 API
 */
export const syncApi = {
  // 获取云端数量
  async getCloudCount() {
    return callCloudFunction('getCount');
  },

  // 清空云端数据
  async clearCloudData() {
    return callCloudFunction('clearAll');
  },

  // 批量导入到云端
  async batchImportToCloud(members, progressCallback) {
    const results = {
      success: true,
      total: members.length,
      imported: 0,
      failed: 0,
      errors: []
    };

    // 分批导入，每批50条
    const batchSize = 50;

    for (let i = 0; i < members.length; i += batchSize) {
      const batch = members.slice(i, i + batchSize);

      try {
        const result = await callCloudFunction('batchImport', { members: batch });

        if (result.success) {
          results.imported += result.imported;
          if (result.errors) {
            results.errors.push(...result.errors);
            results.failed += result.errors.length;
          }
        } else {
          results.failed += batch.length;
          results.errors.push({ batch: i / batchSize, error: result.message });
        }

        if (progressCallback) {
          progressCallback({
            current: Math.min(i + batchSize, members.length),
            total: members.length,
            percentage: Math.round(((i + batchSize) / members.length) * 100)
          });
        }
      } catch (error) {
        results.failed += batch.length;
        results.errors.push({ batch: i / batchSize, error: error.message });
      }
    }

    results.success = results.failed === 0;
    return results;
  },

  // 更新婚配信息
  async updateSpouseInfo() {
    return callCloudFunction('updateSpouseInfo', {});
  }
};

export default {
  memberApi,
  syncApi
};
