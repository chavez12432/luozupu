// 荣誉榜数据表初始化
// 需要创建：patriarchs, sages, elite, graduates

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const { action = 'init' } = event;
  
  try {
    if (action === 'init') {
      console.log('开始初始化荣誉榜数据表...');
      
      // 1. 创建族长表初始数据
      const patriarchsData = [
        { name: '罗公瑾', title: '一世基祖', generation: 1, branch: '中和堂', branchTitle: '初代基祖', originRegion: '未知', achievements: '罗氏迁高洲始祖', sortOrder: 1 },
        { name: '罗浩然', title: '十一世', generation: 11, branch: '中和堂', branchTitle: '安福基祖', originRegion: '安福', achievements: '安福分支始祖', sortOrder: 2 },
        { name: '罗原', title: '十四世', generation: 14, branch: '忠爱堂', branchTitle: '鹧湖基祖', originRegion: '鹧湖', achievements: '鹧湖分支始祖', sortOrder: 3 },
        { name: '罗筮元', title: '十六世', generation: 16, branch: '德裕堂', branchTitle: '高洲基祖', originRegion: '高洲', achievements: '高洲分支始祖', sortOrder: 4 },
        { name: '罗英', title: '十八世', generation: 18, branch: '明儒堂', branchTitle: '明儒堂基祖', originRegion: '高洲', achievements: '明儒堂始祖', sortOrder: 5 },
        { name: '罗华', title: '十八世', generation: 18, branch: '德裕堂', branchTitle: '德裕堂基祖', originRegion: '高洲', achievements: '德裕堂始祖', sortOrder: 6 },
        { name: '罗芬', title: '十八世', generation: 18, branch: '忠爱堂', branchTitle: '忠爱堂基祖', originRegion: '高洲', achievements: '忠爱堂始祖', sortOrder: 7 }
      ];
      
      // 添加族长数据
      for (const patriarch of patriarchsData) {
        // 检查是否已存在
        const exist = await db.collection('patriarchs').where({ name: patriarch.name, generation: patriarch.generation }).count();
        if (exist.total === 0) {
          await db.collection('patriarchs').add({
            data: {
              ...patriarch,
              createdAt: db.serverDate(),
              updatedAt: db.serverDate()
            }
          });
          console.log(`添加族长: ${patriarch.name}`);
        }
      }
      
      console.log('族长表初始化完成');
      
      return {
        success: true,
        message: '荣誉榜数据表初始化完成',
        data: { patriarchsCount: patriarchsData.length }
      };
    }
    
    // 从 members 表筛选数据填充各表
    if (action === 'syncFromMembers') {
      console.log('从 members 表同步数据...');
      
      const members = await db.collection('members')
        .field({
          _id: true,
          name: true,
          originalId: true,
          generation: true,
          birthDate: true,
          positions: true,
          education: true,
          honors: true,
          isAlive: true
        })
        .get();
      
      let synced = { elite: 0, graduates: 0 };
      
      for (const member of members.data) {
        // 处理学历数据 -> graduates 表
        if (member.education && member.education.length > 0) {
          for (const edu of member.education) {
            // 只收录本科及以上，且有毕业年份的
            const highDegrees = ['本科', '学士', '硕士', '博士', '博士后', '博学鸿儒'];
            if (edu.year && highDegrees.some(d => edu.degree && edu.degree.includes(d))) {
              const exist = await db.collection('graduates').where({ 
                memberId: String(member.originalId),
                graduationYear: edu.year,
                degree: edu.degree
              }).count();
              
              if (exist.total === 0) {
                await db.collection('graduates').add({
                  data: {
                    name: member.name,
                    generation: member.generation,
                    memberId: String(member.originalId),
                    degree: edu.degree,
                    school: edu.school || '',
                    major: edu.major || '',
                    graduationYear: edu.year,
                    createdAt: db.serverDate(),
                    updatedAt: db.serverDate()
                  }
                });
                synced.graduates++;
              }
            }
          }
        }
        
        // 建国后群英榜已改为「当今族人撷英」固定七人，不再从 positions 同步到 elite
      }
      
      return {
        success: true,
        message: '同步完成',
        data: synced
      };
    }
    
    return { success: false, message: '未知操作' };
    
  } catch (err) {
    console.error('初始化失败:', err);
    return { success: false, message: err.message };
  }
};

// 根据职位判断成就类型
function getAchievementType(position) {
  const title = position.title || '';
  const org = position.organization || '';
  
  if (org.includes('党委') || org.includes('政府') || org.includes('人大') || org.includes('政协') || title.includes('书记') || title.includes('长')) {
    return '政务';
  }
  if (org.includes('部队') || org.includes('军') || title.includes('司令') || title.includes('军官')) {
    return '军事';
  }
  if (org.includes('学校') || org.includes('大学') || org.includes('学院') || title.includes('教授') || title.includes('教师')) {
    return '教育';
  }
  if (title.includes('总') || title.includes('董') || title.includes('经理') || title.includes('企业家')) {
    return '企业';
  }
  if (org.includes('医院') || org.includes('研究所') || title.includes('医生') || title.includes('工程师')) {
    return '科研';
  }
  return '其他';
}
