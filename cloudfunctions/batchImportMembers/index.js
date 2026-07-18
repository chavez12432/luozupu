// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const { members, startIndex = 0, batchSize = 50, clearExisting = false } = event;
  
  try {
    // 验证参数
    if (!members || !Array.isArray(members) || members.length === 0) {
      return {
        success: false,
        message: '没有要导入的数据'
      };
    }

    console.log(`开始批量导入，从第 ${startIndex} 条开始，本批 ${members.length} 条记录`);

    // 可选：清空现有数据（仅在第一批时执行）
    if (clearExisting && startIndex === 0) {
      console.log('清空现有数据...');
      const existing = await db.collection('members').get();
      for (const doc of existing.data) {
        await db.collection('members').doc(doc._id).remove();
      }
    }

    const results = [];
    const errors = [];
    let imported = 0;

    // 只处理当前批次的数据
    const endIndex = Math.min(startIndex + batchSize, members.length);
    const currentBatch = members.slice(startIndex, endIndex);

    for (const member of currentBatch) {
      try {
        // 清理数据，移除不需要的字段
        const { 
          _relationshipErrors, 
          _id,
          ...cleanMember 
        } = member;

        // 准备导入数据
        const memberData = {
          ...cleanMember,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        };

        // 添加到数据库
        const result = await db.collection('members').add({
          data: memberData
        });

        results.push({
          name: member.name,
          memberId: member.memberId,
          newId: result._id,
          success: true
        });
        imported++;

      } catch (err) {
        console.error(`导入失败: ${member.name}`, err);
        errors.push({
          name: member.name,
          memberId: member.memberId,
          error: err.message
        });
      }
    }

    const hasMore = endIndex < members.length;
    const nextIndex = hasMore ? endIndex : null;

    console.log(`本批导入完成，成功 ${imported} 条，失败 ${errors.length} 条，${hasMore ? '还有' + (members.length - endIndex) + '条待导入' : '全部完成'}`);

    return {
      success: errors.length === 0,
      imported: imported,
      failed: errors.length,
      total: members.length,
      processed: endIndex,
      hasMore: hasMore,
      nextIndex: nextIndex,
      results: results,
      errors: errors
    };

  } catch (err) {
    console.error('批量导入失败:', err);
    return {
      success: false,
      message: err.message,
      imported: 0,
      failed: 0
    };
  }
};
