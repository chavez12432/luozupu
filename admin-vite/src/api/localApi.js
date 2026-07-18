/**
 * 本地模拟 API
 * 用于没有云函数环境时的本地测试
 */

// 从 localStorage 获取成员数据
function getLocalMembers() {
  const data = localStorage.getItem('members');
  return data ? JSON.parse(data) : [];
}

// 保存成员数据到 localStorage
function saveLocalMembers(members) {
  localStorage.setItem('members', JSON.stringify(members));
}

// 初始化示例数据
function initSampleData() {
  const existing = getLocalMembers();
  if (existing.length > 0) return existing;
  
  const sampleData = [
    {
      _id: '1',
      memberId: 'G001',
      name: '罗万一',
      generation: 1,
      branch: '中和堂',
      gender: '男',
      birthDate: { lunar: { year: 1279, month: 1, day: 1 } },
      deathDate: null,
      lifespan: 85,
      fatherId: null,
      fatherName: '',
      motherId: null,
      motherName: '',
      spouseId: null,
      spouseName: '',
      education: [],
      positions: [],
      residence: '广东梅州',
      hasBrokenLineage: false
    },
    {
      _id: '2',
      memberId: 'G002',
      name: '罗万二',
      generation: 1,
      branch: '中和堂',
      gender: '男',
      birthDate: { lunar: { year: 1280, month: 3, day: 5 } },
      deathDate: null,
      lifespan: 78,
      fatherId: null,
      fatherName: '',
      motherId: null,
      motherName: '',
      spouseId: null,
      spouseName: '',
      education: [],
      positions: [],
      residence: '广东梅州',
      hasBrokenLineage: false
    },
    {
      _id: '3',
      memberId: 'G025',
      name: '罗荣华',
      generation: 25,
      branch: '明儒堂',
      gender: '男',
      birthDate: { lunar: { year: 1980, month: 5, day: 15 }, ganzhi: '庚申年' },
      deathDate: null,
      lifespan: null,
      fatherId: '4',
      fatherName: '罗光明',
      motherId: null,
      motherName: '李氏',
      spouseId: '5',
      spouseName: '张秀英',
      education: [{ degree: '本科', school: '中山大学' }],
      positions: [{ title: '教师', isCurrent: true }],
      residence: '深圳宝安',
      hasBrokenLineage: false
    },
    {
      _id: '4',
      memberId: 'G024',
      name: '罗光明',
      generation: 24,
      branch: '明儒堂',
      gender: '男',
      birthDate: { lunar: { year: 1955, month: 8, day: 20 }, ganzhi: '乙未年' },
      deathDate: null,
      lifespan: null,
      fatherId: null,
      fatherName: '罗氏（失考）',
      motherId: null,
      motherName: '',
      spouseId: null,
      spouseName: '李氏',
      education: [{ degree: '初中' }],
      positions: [],
      residence: '梅州蕉岭',
      hasBrokenLineage: true,
      brokenLineageNote: '父辈记录缺失'
    },
    {
      _id: '5',
      memberId: 'G025F',
      name: '张秀英',
      generation: 25,
      branch: '明儒堂',
      gender: '女',
      birthDate: { lunar: { year: 1982, month: 3, day: 10 }, ganzhi: '壬戌年' },
      deathDate: null,
      lifespan: null,
      fatherId: null,
      fatherName: '',
      motherId: null,
      motherName: '',
      spouseId: '3',
      spouseName: '罗荣华',
      education: [{ degree: '大专' }],
      positions: [],
      residence: '深圳宝安',
      hasBrokenLineage: false
    },
    {
      _id: '6',
      memberId: 'G026',
      name: '罗志强',
      generation: 26,
      branch: '明儒堂',
      gender: '男',
      birthDate: { lunar: { year: 2005, month: 10, day: 1 }, ganzhi: '乙酉年' },
      deathDate: null,
      lifespan: null,
      fatherId: '3',
      fatherName: '罗荣华',
      motherId: '5',
      motherName: '张秀英',
      spouseId: null,
      spouseName: '',
      education: [{ degree: '高中' }],
      positions: [],
      residence: '深圳',
      hasBrokenLineage: false
    },
    {
      _id: '7',
      memberId: 'G026',
      name: '罗志美',
      generation: 26,
      branch: '明儒堂',
      gender: '女',
      birthDate: { lunar: { year: 2008, month: 2, day: 15 }, ganzhi: '戊子年' },
      deathDate: null,
      lifespan: null,
      fatherId: '3',
      fatherName: '罗荣华',
      motherId: '5',
      motherName: '张秀英',
      spouseId: null,
      spouseName: '',
      education: [],
      positions: [],
      residence: '深圳',
      hasBrokenLineage: false
    },
    {
      _id: '8',
      memberId: 'G019',
      name: '罗文秀',
      generation: 19,
      branch: '明儒堂',
      gender: '男',
      birthDate: { lunar: { year: 1680, month: 5, day: 8 }, ganzhi: '庚申年' },
      deathDate: { lunar: { year: 1760, month: 12, day: 20 }, ganzhi: '庚辰年' },
      lifespan: 80,
      fatherId: null,
      fatherName: '罗氏（分家祖）',
      motherId: null,
      motherName: '',
      spouseId: null,
      spouseName: '陈氏',
      education: [{ degree: '举人' }],
      positions: [{ title: '族长', isCurrent: false }],
      residence: '梅州',
      hasBrokenLineage: false
    },
    {
      _id: '9',
      memberId: 'G019',
      name: '罗文华',
      generation: 19,
      branch: '德裕堂',
      gender: '男',
      birthDate: { lunar: { year: 1682, month: 7, day: 12 }, ganzhi: '壬戌年' },
      deathDate: { lunar: { year: 1755, month: 9, day: 5 }, ganzhi: '乙亥年' },
      lifespan: 73,
      fatherId: null,
      fatherName: '罗氏（分家祖）',
      motherId: null,
      motherName: '',
      spouseId: null,
      spouseName: '刘氏',
      education: [],
      positions: [],
      residence: '梅州',
      hasBrokenLineage: false
    },
    {
      _id: '10',
      memberId: 'G019',
      name: '罗文忠',
      generation: 19,
      branch: '忠爱堂',
      gender: '男',
      birthDate: { lunar: { year: 1685, month: 1, day: 20 }, ganzhi: '乙丑年' },
      deathDate: { lunar: { year: 1768, month: 4, day: 15 }, ganzhi: '戊子年' },
      lifespan: 83,
      fatherId: null,
      fatherName: '罗氏（分家祖）',
      motherId: null,
      motherName: '',
      spouseId: null,
      spouseName: '何氏',
      education: [{ degree: '进士' }],
      positions: [{ title: '县令', isCurrent: false }],
      residence: '梅州',
      hasBrokenLineage: false
    }
  ];
  
  saveLocalMembers(sampleData);
  return sampleData;
}

/**
 * 成员 API - 本地版本
 */
export const memberApi = {
  // 获取列表
  async getList(params = {}) {
    const { branch, generation, page = 1, pageSize = 20 } = params;
    
    // 初始化示例数据
    let members = initSampleData();
    
    // 过滤
    if (branch) {
      members = members.filter(m => m.branch === branch);
    }
    if (generation) {
      members = members.filter(m => m.generation === generation);
    }
    if (params.name) {
      members = members.filter(m => m.name.includes(params.name));
    }
    
    // 排序
    members.sort((a, b) => a.generation - b.generation);
    
    // 分页
    const total = members.length;
    const start = (page - 1) * pageSize;
    const data = members.slice(start, start + pageSize);
    
    return {
      success: true,
      data,
      total
    };
  },

  // 获取单个
  async getById(id) {
    const members = getLocalMembers();
    const member = members.find(m => m._id === id);
    return {
      success: !!member,
      data: member
    };
  },

  // 创建
  async create(data) {
    const members = getLocalMembers();
    const newMember = {
      ...data,
      _id: Date.now().toString(),
      memberId: `G${data.generation || 1}-${Date.now()}`
    };
    members.push(newMember);
    saveLocalMembers(members);
    return {
      success: true,
      data: { _id: newMember._id }
    };
  },

  // 更新
  async update(id, data) {
    const members = getLocalMembers();
    const index = members.findIndex(m => m._id === id);
    if (index !== -1) {
      members[index] = { ...members[index], ...data };
      saveLocalMembers(members);
    }
    return { success: true };
  },

  // 删除
  async delete(id) {
    const members = getLocalMembers();
    const filtered = members.filter(m => m._id !== id);
    saveLocalMembers(filtered);
    return { success: true };
  },

  // 批量导入
  async batchImport(newMembers) {
    const members = getLocalMembers();
    const imported = newMembers.length;
    const allMembers = [...members, ...newMembers.map((m, i) => ({
      ...m,
      _id: `imported-${Date.now()}-${i}`
    }))];
    saveLocalMembers(allMembers);
    return {
      success: true,
      imported,
      failed: 0,
      errors: []
    };
  },

  // 获取数量
  async getCount() {
    const members = getLocalMembers();
    return {
      success: true,
      count: members.length
    };
  },

  // 清空数据
  async clearAll() {
    saveLocalMembers([]);
    return {
      success: true,
      deletedCount: 0
    };
  }
};

// 初始化云开发（本地版本直接返回成功）
export async function initCloud() {
  initSampleData();
  return true;
}

// 调用云函数（本地版本直接返回成功）
export async function callCloudFunction(name, data = {}) {
  console.log('本地模式调用:', name, data);
  return { success: true };
}

// 导出同步API
export const syncApi = {
  async getCloudCount() {
    return { success: true, count: 0 };
  },
  async clearCloudData() {
    return { success: true };
  },
  async batchImportToCloud(members) {
    return { success: true, imported: 0 };
  }
};

export default {
  initCloud,
  callCloudFunction,
  memberApi,
  syncApi
};
