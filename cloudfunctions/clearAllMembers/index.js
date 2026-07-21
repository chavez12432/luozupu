// 分页清空人员三集合：members / wives / sons_in_law
// 不触碰 dynasty_eras、荣誉、认证、序文等其它数据
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const MAX_LIMIT = 100;
const PERSONNEL_COLLECTIONS = ['members', 'wives', 'sons_in_law'];

async function clearCollection(name) {
  let deleted = 0;
  // 循环分页删除，直到为空
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data } = await db.collection(name).limit(MAX_LIMIT).get();
    if (!data || data.length === 0) break;
    await Promise.all(data.map(doc => db.collection(name).doc(doc._id).remove()));
    deleted += data.length;
    if (data.length < MAX_LIMIT) break;
  }
  return deleted;
}

exports.main = async (event, context) => {
  try {
    const collections = Array.isArray(event && event.collections) && event.collections.length
      ? event.collections.filter(c => PERSONNEL_COLLECTIONS.includes(c))
      : PERSONNEL_COLLECTIONS.slice();

    const results = {};
    let total = 0;
    for (const name of collections) {
      const n = await clearCollection(name);
      results[name] = n;
      total += n;
    }

    return {
      success: true,
      message: `已清空人员集合，共删除 ${total} 条`,
      deletedCount: total,
      details: results,
      preservedNote: '未清空 dynasty_eras / 荣誉 / 认证 / 序文等'
    };
  } catch (err) {
    console.error('清空人员数据失败:', err);
    return {
      success: false,
      message: err.message
    };
  }
};
