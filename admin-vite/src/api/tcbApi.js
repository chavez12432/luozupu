/**
 * 腾讯云开发 API
 * 使用 HTTP 方式调用云函数
 */

// 云开发环境配置
const CLOUD_ENV = 'luoshi-7g0fx8maef33f709';

// 代理服务器地址
// 开发环境使用本地代理服务器
const PROXY_URL = 'http://localhost:3000';

/**
 * 调用云函数 (通过本地代理服务器)
 * 
 * 使用步骤:
 * 1. cd proxy-server && npm install
 * 2. 复制 .env.example 为 .env，填入你的密钥
 * 3. npm start 启动代理服务器
 * 4. Web 前端会自动通过代理调用云函数
 */
export async function callCloudFunction(name, data = {}) {
  try {
    console.log('调用云函数:', name, '数据:', data);
    
    // 通过本地代理服务器调用云函数
    const url = `${PROXY_URL}/call/${name}`;
    console.log('请求 URL:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('HTTP 错误:', response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status}, ${errorText}`);
    }
    
    const result = await response.json();
    console.log('云函数返回:', result);
    return result;
  } catch (error) {
    console.error('调用云函数失败:', error);
    // 返回友好的错误信息
    return {
      success: false,
      message: '连接代理服务器失败，请确保代理服务器已启动 (npm start)',
      error: error.message
    };
  }
}

/**
 * 初始化云开发 (HTTP 方式不需要初始化)
 */
export async function initCloud() {
  console.log('使用 HTTP 方式访问云函数，无需初始化');
  return true;
}

/**
 * 成员 API
 */
export const memberApi = {
  // 获取列表
  async getList(params = {}) {
    return callCloudFunction('adminApi', {
      action: 'list',
      ...params
    });
  },

  // 获取单个
  async getById(id) {
    return callCloudFunction('adminApi', {
      action: 'get',
      data: { _id: id }
    });
  },

  // 创建
  async create(data) {
    return callCloudFunction('adminApi', {
      action: 'create',
      data
    });
  },

  // 更新
  async update(id, data) {
    return callCloudFunction('adminApi', {
      action: 'update',
      data: { _id: id, ...data }
    });
  },

  // 删除
  async delete(id) {
    return callCloudFunction('adminApi', {
      action: 'delete',
      data: { _id: id }
    });
  },

  // 批量导入
  async batchImport(members) {
    return callCloudFunction('adminApi', {
      action: 'batchImport',
      members
    });
  }
};

/**
 * 同步 API
 */
export const syncApi = {
  // 获取云端数量
  async getCloudCount() {
    return callCloudFunction('adminApi', {
      action: 'getCount'
    });
  },

  // 清空云端数据
  async clearCloudData() {
    return callCloudFunction('adminApi', {
      action: 'clearAll'
    });
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
        const result = await callCloudFunction('adminApi', {
          action: 'batchImport',
          members: batch
        });
        
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
  }
};

export default {
  initCloud,
  callCloudFunction,
  memberApi,
  syncApi
};
