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
        return await createWife(data);
      case 'update':
        return await updateWife(data);
      case 'delete':
        return await deleteWife(data);
      case 'get':
        return await getWife(data);
      case 'listByHusband':
        return await listWivesByHusband(data);
      case 'listByGeneration':
        return await listWivesByGeneration(data);
      default:
        return { success: false, message: '未知操作' };
    }
  } catch (err) {
    console.error('操作失败', err);
    return { success: false, message: err.message };
  }
};

// 创建媳妇记录
async function createWife(data) {
  // 转换日期
  const birthDate = await convertDate(data.birthDate, db);
  const deathDate = data.deathDate ? await convertDate(data.deathDate, db) : null;
  
  const wifeData = {
    ...data,
    birthDate,
    deathDate,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  };
  
  const result = await db.collection('wives').add({
    data: wifeData
  });
  
  // 更新丈夫的配偶ID
  if (data.husbandId) {
    await db.collection('members').doc(data.husbandId).update({
      data: {
        spouseId: result._id,
        updatedAt: db.serverDate()
      }
    });
  }
  
  return {
    success: true,
    data: { _id: result._id }
  };
}

// 更新媳妇记录
async function updateWife(data) {
  const { _id, ...updateData } = data;
  
  // 转换日期
  if (updateData.birthDate) {
    updateData.birthDate = await convertDate(updateData.birthDate, db);
  }
  if (updateData.deathDate) {
    updateData.deathDate = await convertDate(updateData.deathDate, db);
  }
  
  updateData.updatedAt = db.serverDate();
  
  await db.collection('wives').doc(_id).update({
    data: updateData
  });
  
  return { success: true };
}

// 删除媳妇记录
async function deleteWife(data) {
  const { _id } = data;
  
  // 获取媳妇信息
  const { data: wife } = await db.collection('wives').doc(_id).get();
  
  // 解除与丈夫的关联
  if (wife.husbandId) {
    await db.collection('members').doc(wife.husbandId).update({
      data: {
        spouseId: null,
        updatedAt: db.serverDate()
      }
    });
  }
  
  await db.collection('wives').doc(_id).remove();
  return { success: true };
}

// 获取单个媳妇
async function getWife(data) {
  const { _id } = data;
  
  const { data: wife } = await db.collection('wives').doc(_id).get();
  
  if (!wife) {
    return { success: false, message: '记录不存在' };
  }
  
  // 查询丈夫信息
  if (wife.husbandId) {
    try {
      const { data: husband } = await db.collection('members').doc(wife.husbandId).get();
      wife.husband = husband ? { _id: husband._id, name: husband.name, generation: husband.generation } : null;
    } catch (e) {
      wife.husband = null;
    }
  }
  
  // 查询子女信息
  if (wife.childrenIds && wife.childrenIds.length > 0) {
    const { data: children } = await db.collection('members')
      .where({
        _id: db.command.in(wife.childrenIds)
      })
      .get();
    wife.children = children.map(c => ({ _id: c._id, name: c.name, gender: c.gender }));
  }
  
  return {
    success: true,
    data: wife
  };
}

// 根据丈夫ID查询媳妇
async function listWivesByHusband(params) {
  const { husbandId } = params || {};
  
  const { data } = await db.collection('wives')
    .where({ husbandId })
    .get();
  
  return {
    success: true,
    data
  };
}

// 按世代查询媳妇
async function listWivesByGeneration(params) {
  const { generation } = params || {};
  
  const { data } = await db.collection('wives')
    .where({ generation })
    .orderBy('maidenName', 'asc')
    .get();
  
  // 补充丈夫姓名
  const enrichedData = await Promise.all(data.map(async (wife) => {
    if (wife.husbandId) {
      try {
        const { data: husband } = await db.collection('members').doc(wife.husbandId).get();
        wife.husbandName = husband ? husband.name : '未知';
      } catch (e) {
        wife.husbandName = '未知';
      }
    }
    return wife;
  }));
  
  return {
    success: true,
    data: enrichedData
  };
}
