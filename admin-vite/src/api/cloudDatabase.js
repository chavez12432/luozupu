/**
 * 云开发数据库直接访问
 * 使用云开发 Web SDK 访问数据库
 * 
 * 需要在云开发控制台配置 Web 访问安全域名
 */

// 云开发环境配置
const CLOUD_ENV = 'luoshi-7g0fx8maef33f709';

// 初始化状态
let isInitialized = false;
let db = null;

/**
 * 初始化云开发
 */
export async function initCloud() {
  if (isInitialized) return true;
  
  try {
    // 检查云开发 SDK 是否加载
    if (typeof window.cloud === 'undefined') {
      console.error('云开发 SDK 未加载');
      return false;
    }

    // 初始化云开发
    window.cloud.init({
      env: CLOUD_ENV,
      traceUser: true
    });

    // 获取数据库实例
    db = window.cloud.database();
    
    isInitialized = true;
    console.log('云开发初始化成功');
    return true;
  } catch (error) {
    console.error('云开发初始化失败:', error);
    return false;
  }
}

/**
 * 获取数据库实例
 */
export function getDB() {
  if (!isInitialized) {
    throw new Error('云开发未初始化，请先调用 initCloud()');
  }
  return db;
}

/**
 * 获取成员列表（从云端）
 */
export async function getMembersFromCloud(params = {}) {
  await initCloud();
  
  const { branch, generation, page = 1, pageSize = 20 } = params;
  
  let query = db.collection('members');
  
  // 添加查询条件
  if (branch) {
    query = query.where({ branch });
  }
  if (generation) {
    query = query.where({ generation });
  }
  
  // 获取总数
  const countResult = await query.count();
  const total = countResult.total;
  
  // 分页查询
  const { data } = await query
    .orderBy('generation', 'asc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  
  return {
    success: true,
    data,
    total
  };
}

/**
 * 获取单个成员（从云端）
 */
export async function getMemberFromCloud(id) {
  await initCloud();
  
  const { data } = await db.collection('members').doc(id).get();
  
  return {
    success: !!data,
    data
  };
}

/**
 * 添加成员到云端
 */
export async function addMemberToCloud(memberData) {
  await initCloud();
  
  const result = await db.collection('members').add({
    data: {
      ...memberData,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });
  
  return {
    success: true,
    data: { _id: result._id }
  };
}

/**
 * 更新云端成员
 */
export async function updateMemberInCloud(id, updateData) {
  await initCloud();
  
  await db.collection('members').doc(id).update({
    data: {
      ...updateData,
      updatedAt: db.serverDate()
    }
  });
  
  return { success: true };
}

/**
 * 删除云端成员
 */
export async function deleteMemberFromCloud(id) {
  await initCloud();
  
  await db.collection('members').doc(id).remove();
  
  return { success: true };
}

/**
 * 批量导入到云端
 */
export async function batchImportToCloud(members, progressCallback = null) {
  await initCloud();
  
  const results = {
    success: true,
    total: members.length,
    imported: 0,
    failed: 0,
    errors: []
  };

  // 分批导入，每批20条（避免单请求过大）
  const batchSize = 20;
  
  for (let i = 0; i < members.length; i += batchSize) {
    const batch = members.slice(i, i + batchSize);
    
    try {
      // 使用云函数的批量导入
      const { result } = await window.cloud.callFunction({
        name: 'batchImportMembers',
        data: {
          members: batch,
          startIndex: 0,
          batchSize: batchSize
        }
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

      // 更新进度
      if (progressCallback) {
        progressCallback({
          current: Math.min(i + batchSize, members.length),
          total: members.length,
          percentage: Math.round(((i + batchSize) / members.length) * 100)
        });
      }
    } catch (error) {
      console.error(`批次 ${i / batchSize} 失败:`, error);
      results.failed += batch.length;
      results.errors.push({ batch: i / batchSize, error: error.message });
    }
  }

  results.success = results.failed === 0;
  return results;
}

/**
 * 获取云端数据数量
 */
export async function getCloudCount() {
  await initCloud();
  
  const result = await db.collection('members').count();
  return result.total;
}

/**
 * 清空云端数据
 */
export async function clearCloudData() {
  await initCloud();
  
  const { data } = await db.collection('members').get();
  
  const deletePromises = data.map(doc => {
    return db.collection('members').doc(doc._id).remove();
  });
  
  await Promise.all(deletePromises);
  
  return {
    success: true,
    deletedCount: data.length
  };
}

// 成员 API 对象（兼容 localStorage.js 的接口）
export const memberApi = {
  async getList(params = {}) {
    return getMembersFromCloud(params);
  },

  async getById(id) {
    return getMemberFromCloud(id);
  },

  async create(data) {
    return addMemberToCloud(data);
  },

  async update(id, data) {
    return updateMemberInCloud(id, data);
  },

  async delete(id) {
    return deleteMemberFromCloud(id);
  },

  async batchImport(members) {
    return batchImportToCloud(members);
  }
};

export default {
  initCloud,
  getDB,
  getMembersFromCloud,
  getMemberFromCloud,
  addMemberToCloud,
  updateMemberInCloud,
  deleteMemberFromCloud,
  batchImportToCloud,
  getCloudCount,
  clearCloudData,
  memberApi
};
