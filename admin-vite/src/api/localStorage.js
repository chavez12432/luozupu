/**
 * 本地存储 API 封装
 * 用于在 admin-vite 独立项目中临时存储数据
 * 后续可替换为真实云开发 API
 */

const STORAGE_KEY = 'luozupu_members';

// 获取所有成员
export function getMembers() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

// 保存所有成员
export function saveMembers(members) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
}

// 添加单个成员
export function addMember(member) {
  const members = getMembers();
  member._id = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  member.createdAt = new Date().toISOString();
  member.updatedAt = new Date().toISOString();
  members.push(member);
  saveMembers(members);
  return { success: true, data: { _id: member._id } };
}

// 批量导入成员
export function batchImportMembers(members, options = {}) {
  // 默认清空现有数据，除非指定 append: true
  const existingMembers = options.append ? getMembers() : [];
  const results = [];
  const errors = [];
  let imported = 0;

  for (const member of members) {
    try {
      // 清理内部字段
      const { _relationshipErrors, ...cleanMember } = member;
      
      cleanMember._id = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      cleanMember.createdAt = new Date().toISOString();
      cleanMember.updatedAt = new Date().toISOString();
      
      existingMembers.push(cleanMember);
      
      results.push({
        originalId: member.originalId,
        newId: cleanMember._id,
        name: member.name,
        success: true
      });
      imported++;
    } catch (err) {
      errors.push({
        name: member.name,
        originalId: member.originalId,
        error: err.message
      });
    }
  }

  saveMembers(existingMembers);

  return {
    success: errors.length === 0,
    imported: imported,
    failed: errors.length,
    results: results,
    errors: errors
  };
}

// 更新成员
export function updateMember(id, data) {
  const members = getMembers();
  const index = members.findIndex(m => m._id === id);
  if (index === -1) {
    return { success: false, message: '成员不存在' };
  }
  members[index] = { ...members[index], ...data, updatedAt: new Date().toISOString() };
  saveMembers(members);
  return { success: true };
}

// 删除成员
export function deleteMember(id) {
  const members = getMembers();
  const filtered = members.filter(m => m._id !== id);
  saveMembers(filtered);
  return { success: true };
}

// 获取成员列表（支持分页和筛选）
export function getMemberList({ branch, generation, page = 1, pageSize = 20 } = {}) {
  let members = getMembers();
  
  // 筛选
  if (branch) {
    members = members.filter(m => m.branch === branch);
  }
  if (generation) {
    members = members.filter(m => m.generation === generation);
  }
  
  const total = members.length;
  
  // 分页
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const data = members.slice(start, end);
  
  return {
    success: true,
    data,
    total
  };
}

// 清空所有数据
export function clearAllMembers() {
  localStorage.removeItem(STORAGE_KEY);
}

// 导出为 JSON
export function exportToJSON() {
  const members = getMembers();
  return JSON.stringify(members, null, 2);
}

// 成员相关 API 对象（兼容 cloudbase.js 的接口）
export const memberApi = {
  async getList(params = {}) {
    return getMemberList(params);
  },

  async getById(id) {
    const members = getMembers();
    const member = members.find(m => m._id === id);
    return { success: !!member, data: member };
  },

  async create(data) {
    return addMember(data);
  },

  async update(id, data) {
    return updateMember(id, data);
  },

  async delete(id) {
    return deleteMember(id);
  },

  async batchImport(members) {
    return batchImportMembers(members);
  }
};

export default {
  getMembers,
  saveMembers,
  addMember,
  batchImportMembers,
  updateMember,
  deleteMember,
  getMemberList,
  clearAllMembers,
  exportToJSON,
  memberApi
};
