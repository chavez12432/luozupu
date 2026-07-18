// 云函数入口文件
const cloud = require('wx-server-sdk');
const { convertDate } = require('../utils/lunarCalendar');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const { action, data, members } = event;
  
  try {
    switch (action) {
      case 'create':
        return await createMember(data);
      case 'batchImport':
        return await batchImportMembers(members);
      case 'update':
        return await updateMember(data);
      case 'delete':
        return await deleteMember(data);
      case 'get':
        return await getMember(data);
      case 'list':
        return await listMembers(data);
      default:
        return { success: false, message: '未知操作' };
    }
  } catch (err) {
    console.error('操作失败', err);
    return { success: false, message: err.message };
  }
};

// 创建成员
async function createMember(data) {
  // 转换日期
  const birthDate = await convertDate(data.birthDate, db);
  const deathDate = data.deathDate ? await convertDate(data.deathDate, db) : null;
  
  const memberData = {
    ...data,
    birthDate,
    deathDate,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  };
  
  const result = await db.collection('members').add({
    data: memberData
  });
  
  return {
    success: true,
    data: { _id: result._id }
  };
}

// 批量导入成员
async function batchImportMembers(members) {
  if (!members || !Array.isArray(members) || members.length === 0) {
    return { success: false, message: '没有要导入的数据' };
  }
  
  const results = [];
  const errors = [];
  let imported = 0;
  
  // 批量处理，每批100条
  const batchSize = 100;
  for (let i = 0; i < members.length; i += batchSize) {
    const batch = members.slice(i, i + batchSize);
    
    for (const member of batch) {
      try {
        // 转换日期
        let birthDate = member.birthDate;
        let deathDate = member.deathDate;
        
        // 清理内部字段
        const { _relationshipErrors, originalId, ...cleanMember } = member;
        
        const memberData = {
          ...cleanMember,
          birthDate,
          deathDate,
          originalId: originalId || null,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        };
        
        const result = await db.collection('members').add({
          data: memberData
        });
        
        results.push({
          originalId: originalId,
          newId: result._id,
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
  }
  
  return {
    success: errors.length === 0,
    imported: imported,
    failed: errors.length,
    results: results,
    errors: errors
  };
}

// 更新成员
async function updateMember(data) {
  const { _id, ...updateData } = data;
  
  // 转换日期
  if (updateData.birthDate) {
    updateData.birthDate = await convertDate(updateData.birthDate, db);
  }
  if (updateData.deathDate) {
    updateData.deathDate = await convertDate(updateData.deathDate, db);
  }
  
  updateData.updatedAt = db.serverDate();
  
  await db.collection('members').doc(_id).update({
    data: updateData
  });
  
  return { success: true };
}

// 删除成员
async function deleteMember(data) {
  const { _id } = data;
  await db.collection('members').doc(_id).remove();
  return { success: true };
}

// 获取单个成员
async function getMember(data) {
  const { _id } = data;
  
  const { data: member } = await db.collection('members').doc(_id).get();
  
  if (!member) {
    return { success: false, message: '成员不存在' };
  }
  
  // 查询关联信息
  const relations = await getRelations(member);
  
  return {
    success: true,
    data: { ...member, ...relations }
  };
}

// 获取成员列表
async function listMembers(params) {
  const { branch, generation, page = 1, pageSize = 20 } = params || {};
  
  let whereCondition = {};
  
  if (branch) {
    whereCondition.branch = branch;
  }
  if (generation) {
    whereCondition.generation = generation;
  }
  
  const { data } = await db.collection('members')
    .where(whereCondition)
    .orderBy('generation', 'asc')
    .orderBy('birthDate.lunar.year', 'asc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  
  return {
    success: true,
    data
  };
}

// 获取关联信息
async function getRelations(member) {
  const relations = {};
  
  // 父亲
  if (member.fatherId) {
    try {
      const { data: father } = await db.collection('members').doc(member.fatherId).get();
      relations.father = father ? { _id: father._id, name: father.name } : null;
    } catch (e) {
      relations.father = null;
    }
  }
  
  // 母亲
  if (member.motherId) {
    try {
      const { data: mother } = await db.collection('wives').doc(member.motherId).get();
      relations.mother = mother ? { _id: mother._id, name: mother.name } : null;
    } catch (e) {
      relations.mother = null;
    }
  }
  
  // 配偶
  if (member.spouseId) {
    try {
      const { data: spouse } = await db.collection('wives').doc(member.spouseId).get();
      relations.spouse = spouse ? { _id: spouse._id, name: spouse.name } : null;
    } catch (e) {
      relations.spouse = null;
    }
  }
  
  // 子女
  if (member.childrenIds && member.childrenIds.length > 0) {
    const { data: children } = await db.collection('members')
      .where({
        _id: db.command.in(member.childrenIds)
      })
      .get();
    relations.children = children.map(c => ({ _id: c._id, name: c.name, gender: c.gender }));
  }
  
  return relations;
}
