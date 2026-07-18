/**
 * 微信云开发 API 封装
 * 用于 admin-vite 后台管理界面调用云函数
 */

// 云开发环境配置
const CLOUD_ENV = 'luoshi-7g0fx8maef33f709';

// 调用云函数
export async function callCloudFunction(name, data = {}) {
  try {
    // 检查是否在云开发环境中
    if (typeof wx !== 'undefined' && wx.cloud) {
      // 微信小程序环境
      const result = await wx.cloud.callFunction({
        name,
        data
      });
      return result.result;
    } else {
      // Web 环境 - 使用 HTTP API
      // 需要先配置云开发 HTTP API 访问
      const response = await fetch(`/cloud-api/${name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      return await response.json();
    }
  } catch (error) {
    console.error('云函数调用失败:', error);
    throw error;
  }
}

// 成员相关 API
export const memberApi = {
  // 获取成员列表
  async getList(params = {}) {
    return callCloudFunction('addMember', {
      action: 'list',
      ...params
    });
  },

  // 获取单个成员
  async getById(id) {
    return callCloudFunction('addMember', {
      action: 'get',
      data: { _id: id }
    });
  },

  // 创建成员
  async create(data) {
    return callCloudFunction('addMember', {
      action: 'create',
      data
    });
  },

  // 更新成员
  async update(id, data) {
    return callCloudFunction('addMember', {
      action: 'update',
      data: { _id: id, ...data }
    });
  },

  // 删除成员
  async delete(id) {
    return callCloudFunction('addMember', {
      action: 'delete',
      data: { _id: id }
    });
  },

  // 批量导入
  async batchImport(members) {
    return callCloudFunction('addMember', {
      action: 'batchImport',
      members
    });
  }
};

// 获取成员列表（兼容旧版 getMembers 云函数）
export async function getMembers(params = {}) {
  return callCloudFunction('getMembers', params);
}

export default {
  callCloudFunction,
  memberApi,
  getMembers
};
