// 云函数：更新婚配信息（按 remark 解析）
const cloud = require('wx-server-sdk');
const {
  parseSpousesFromRemark,
  spousesToSpouseInfo,
  normalizeSpouseName
} = require('./spouseParser');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event) => {
  const { action } = event;

  try {
    if (action === 'updateAll') {
      return await updateAllSpouses();
    }
    if (action === 'updateOne') {
      return await updateOneSpouse(event._id);
    }
    return { success: false, message: '需要指定 action: updateAll 或 updateOne' };
  } catch (err) {
    console.error('更新失败:', err);
    return { success: false, message: err.message };
  }
};

async function updateOneSpouse(_id) {
  const { data: member } = await db.collection('members').doc(_id).get();
  if (!member) return { success: false, message: '成员不存在' };

  const spouses = parseSpousesFromRemark(member.remark || '');
  const spouseName = spouses[0] ? spouses[0].name : normalizeSpouseName(member.spouseName || '');
  const spouseInfo = spouses.length ? spousesToSpouseInfo(spouses) : [];

  await db.collection('members').doc(_id).update({
    data: {
      spouseName,
      spouseInfo,
      updatedAt: db.serverDate()
    }
  });

  return {
    success: true,
    data: { name: member.name, spouseName, allSpouses: spouseInfo }
  };
}

async function updateAllSpouses() {
  const results = { updated: 0, hasSpouse: 0, noSpouse: 0, failed: [] };
  let skip = 0;
  const limit = 100;

  while (true) {
    const { data: members } = await db.collection('members').limit(limit).skip(skip).get();
    if (!members.length) break;

    for (const member of members) {
      try {
        const spouses = parseSpousesFromRemark(member.remark || '');
        if (spouses.length) {
          await db.collection('members').doc(member._id).update({
            data: {
              spouseName: spouses[0].name,
              spouseInfo: spousesToSpouseInfo(spouses),
              updatedAt: db.serverDate()
            }
          });
          results.hasSpouse++;
        } else {
          results.noSpouse++;
        }
        results.updated++;
        await new Promise(resolve => setTimeout(resolve, 30));
      } catch (err) {
        results.failed.push({ name: member.name, error: err.message });
      }
    }

    skip += limit;
    if (members.length < limit) break;
  }

  return {
    success: true,
    message: `更新完成：共更新 ${results.updated} 条，有配偶 ${results.hasSpouse} 条，无配偶 ${results.noSpouse} 条`,
    data: results
  };
}
