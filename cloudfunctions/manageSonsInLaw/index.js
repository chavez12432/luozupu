// 云函数入口文件
const cloud = require('wx-server-sdk');
const { convertDate } = require('../utils/lunarCalendar');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const { action, data } = event;
  
  try {
    switch (action) {
      case 'create':
        return await createSonInLaw(data);
      case 'update':
        return await updateSonInLaw(data);
      case 'delete':
        return await deleteSonInLaw(data);
      case 'get':
        return await getSonInLaw(data);
      case 'listByWife':
        return await listSonsInLawByWife(data);
      case 'listByGeneration':
        return await listSonsInLawByGeneration(data);
      default:
        return { success: false, message: '未知操作' };
    }
  } catch (err) {
    console.error('操作失败', err);
    return { success: false, message: err.message };
  }
};

// 创建女婿记录
async function createSonInLaw(data) {
  // 转换日期
  const birthDate = await convertDate(data.birthDate, db);
  const deathDate = data.deathDate ? await convertDate(data.deathDate, db) : null;
  
  const sonInLawData = {
    ...data,
    birthDate,
    deathDate,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  };
  
  const result = await db.collection('sons_in_law').add({
    data: sonInLawData
  });
  
  return {
    success: true,
    data: { _id: result._id }
  };
}

// 更新女婿记录
async function updateSonInLaw(data) {
  const { _id, ...updateData } = data;
  
  // 转换日期
  if (updateData.birthDate) {
    updateData.birthDate = await convertDate(updateData.birthDate, db);
  }
  if (updateData.deathDate) {
    updateData.deathDate = await convertDate(updateData.deathDate, db);
  }
  
  updateData.updatedAt = db.serverDate();
  
  await db.collection('sons_in_law').doc(_id).update({
    data: updateData
  });
  
  return { success: true };
}

// 删除女婿记录
async function deleteSonInLaw(data) {
  const { _id } = data;
  await db.collection('sons_in_law').doc(_id).remove();
  return { success: true };
}

// 获取单个女婿
async function getSonInLaw(data) {
  const { _id } = data;
  
  const { data: sonInLaw } = await db.collection('sons_in_law').doc(_id).get();
  
  if (!sonInLaw) {
    return { success: false, message: '记录不存在' };
  }
  
  // 查询妻子信息（罗家女儿）
  if (sonInLaw.wifeId) {
    try {
      const { data: wife } = await db.collection('members').doc(sonInLaw.wifeId).get();
      sonInLaw.wife = wife ? { 
        _id: wife._id, 
        name: wife.name, 
        generation: wife.generation 
      } : null;
    } catch (e) {
      sonInLaw.wife = null;
    }
  }
  
  return {
    success: true,
    data: sonInLaw
  };
}

// 根据妻子ID查询女婿
async function listSonsInLawByWife(params) {
  const { wifeId } = params || {};
  
  const { data: list } = await db.collection('sons_in_law')
    .where({ wifeId })
    .get();
  
  return {
    success: true,
    data: list
  };
}

// 按妻子世代查询女婿
async function listSonsInLawByGeneration(params) {
  const { generation } = params || {};
  
  const { data: list } = await db.collection('sons_in_law')
    .where({ wifeGeneration: generation })
    .orderBy('name', 'asc')
    .get();
  
  // 补充妻子姓名
  const enrichedData = await Promise.all((list || []).map(async (sonInLaw) => {
    if (sonInLaw.wifeId) {
      try {
        const { data: wife } = await db.collection('members').doc(sonInLaw.wifeId).get();
        sonInLaw.wifeName = wife ? wife.name : '未知';
      } catch (e) {
        sonInLaw.wifeName = '未知';
      }
    }
    return sonInLaw;
  }));
  
  return {
    success: true,
    data: enrichedData
  };
}
