// 云函数入口文件 - 更新族人详细信息
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 导入族人详细信息
const memberDetails = require('./memberDetails.js');

// 堂份到分支的映射
const branchMap = {
  '明儒堂': '明儒堂',
  '德裕堂': '德裕堂',
  '忠爱堂': '忠爱堂',
  '中和堂': '中和堂'
};

// 世代映射（从姓名判断世代）
const generationMap = {
  '相文': 35, '传芳': 33, '国才': 34, '德才': 34, '庆良': 35, '志坚': 36,
  '冬香': 35, '建新': 35, '娇云': 35, '阳先': 36, '顶飞': 36, '强飞': 36,
  '少林': 36, '聪': 36, '毅': 36, '群': 36, '双群': 36, '艳群': 36,
  '明华': 36, '夏弦': 36, '荣': 36,
  '池美': 34, '现才': 35, '京华': 35, '京丽': 35, '志兵': 36, '志青': 36,
  '志芳': 36, '凤英': 35, '志萍': 36, '胜良': 36, '玲': 36, '微': 36,
  '钟良': 37, '志丽': 37, '吴首': 37, '储才': 36, '晓燕': 36, '晓红': 36,
  '建明': 35, '青': 35, '莉': 35, '慧兰': 35, '林': 36, '飞': 37,
  '琴': 37, '娟': 36, '娟娟': 37
};

// 云函数入口函数
exports.main = async (event, context) => {
  const { action, name } = event;
  
  try {
    if (action === 'updateAll') {
      // 更新所有族人详细信息
      return await updateAllMembers();
    } else if (action === 'updateOne' && name) {
      // 更新单个族人
      return await updateOneMember(name);
    } else {
      return {
        success: false,
        message: '请指定 action（updateAll 或 updateOne）和 name'
      };
    }
  } catch (err) {
    console.error('更新失败', err);
    return {
      success: false,
      message: err.message
    };
  }
};

// 更新单个族人
async function updateOneMember(name) {
  const details = memberDetails[name];
  if (!details) {
    return {
      success: false,
      message: `未找到族人 ${name} 的详细信息`
    };
  }
  
  // 查询该族人
  const { data: members } = await db.collection('members')
    .where({
      name: name
    })
    .get();
  
  if (members.length === 0) {
    return {
      success: false,
      message: `数据库中未找到族人 ${name}`
    };
  }
  
  const member = members[0];
  
  // 准备更新数据
  const updateData = {};
  
  if (details.gender) updateData.gender = details.gender;
  if (details.education) updateData.education = details.education.map(e => ({
    degree: e,
    school: '',
    major: ''
  }));
  if (details.positions) {
    updateData.positions = details.positions.map((p, index) => ({
      title: p.title,
      organization: p.organization || '',
      level: '',
      isCurrent: p.isCurrent || false,
      isDefault: index === details.positions.length - 1
    }));
  }
  if (details.residence) updateData.residence = details.residence;
  
  // 更新数据库
  await db.collection('members')
    .doc(member._id)
    .update({
      data: updateData
    });
  
  return {
    success: true,
    message: `成功更新 ${name} 的详细信息`,
    data: {
      name: name,
      updated: updateData
    }
  };
}

// 更新所有族人
async function updateAllMembers() {
  const results = {
    success: [],
    failed: [],
    notFound: []
  };
  
  const names = Object.keys(memberDetails);
  
  for (const name of names) {
    try {
      const details = memberDetails[name];
      
      // 查询该族人
      const { data: members } = await db.collection('members')
        .where({
          name: name
        })
        .get();
      
      if (members.length === 0) {
        results.notFound.push(name);
        continue;
      }
      
      const member = members[0];
      
      // 准备更新数据
      const updateData = {};
      
      if (details.gender) updateData.gender = details.gender;
      if (details.education) {
        updateData.education = details.education.map(e => ({
          degree: e,
          school: '',
          major: ''
        }));
      }
      if (details.positions) {
        updateData.positions = details.positions.map((p, index) => ({
          title: p.title,
          organization: p.organization || '',
          level: '',
          isCurrent: p.isCurrent || false,
          isDefault: index === details.positions.length - 1
        }));
      }
      if (details.residence) updateData.residence = details.residence;
      if (details.honors) {
        updateData.honors = details.honors.map(h => ({
          type: '',
          title: h,
          level: '',
          year: null,
          description: ''
        }));
      }
      
      // 更新数据库
      await db.collection('members')
        .doc(member._id)
        .update({
          data: updateData
        });
      
      results.success.push(name);
      
      // 添加延迟避免频率限制
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (err) {
      console.error(`更新 ${name} 失败:`, err);
      results.failed.push({ name, error: err.message });
    }
  }
  
  return {
    success: true,
    message: `更新完成：成功 ${results.success.length}，未找到 ${results.notFound.length}，失败 ${results.failed.length}`,
    data: results
  };
}
