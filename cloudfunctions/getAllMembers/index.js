// 获取所有成员数据
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const MAX_LIMIT = 100;

exports.main = async (event, context) => {
  try {
    // 先获取总数
    const countResult = await db.collection('members').count();
    const total = countResult.total;
    
    // 分批获取所有数据
    const batchTimes = Math.ceil(total / MAX_LIMIT);
    const tasks = [];
    
    for (let i = 0; i < batchTimes; i++) {
      const promise = db.collection('members')
        .skip(i * MAX_LIMIT)
        .limit(MAX_LIMIT)
        .get();
      tasks.push(promise);
    }
    
    // 等待所有请求完成
    const results = await Promise.all(tasks);
    
    // 合并数据
    let allData = [];
    for (const result of results) {
      allData = allData.concat(result.data);
    }
    
    return {
      success: true,
      total: allData.length,
      data: allData
    };
  } catch (err) {
    console.error('获取数据失败:', err);
    return {
      success: false,
      message: err.message
    };
  }
};
