// 清空所有成员数据
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  try {
    // 获取所有数据
    const { data } = await db.collection('members').get();
    
    // 批量删除
    const deletePromises = data.map(doc => {
      return db.collection('members').doc(doc._id).remove();
    });
    
    await Promise.all(deletePromises);
    
    return {
      success: true,
      message: `成功删除 ${data.length} 条记录`,
      deletedCount: data.length
    };
  } catch (err) {
    console.error('清空数据失败:', err);
    return {
      success: false,
      message: err.message
    };
  }
};
