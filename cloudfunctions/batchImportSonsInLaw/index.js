// 批量导入女婿数据云函数
// 从 members 表的 remark 字段提取婚配信息，导入 sons_in_law 表
//
// 提取逻辑：
// - "适上沧洲张求贤" → 丈夫：张求贤，籍贯：上沧洲
// - "2001年出嫁胡凌峰，江西新余人" → 丈夫：胡凌峰，籍贯：江西新余人

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

// 常见姓氏列表
const COMMON_SURNAMES = ['王', '李', '张', '刘', '陈', '杨', '黄', '赵', '吴', '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗', '梁', '宋', '郑', '谢', '韩', '唐', '冯', '于', '董', '萧', '程', '曹', '袁', '邓', '许', '傅', '沈', '曾', '彭', '吕', '苏', '卢', '蒋', '蔡', '贾', '丁', '魏', '薛', '叶', '阎', '余', '潘', '杜', '戴', '夏', '钟', '汪', '田', '任', '姜', '范', '方', '石', '姚', '谭', '廖', '邹', '熊', '金', '陆', '郝', '孔', '白', '崔', '康', '毛', '邱', '秦', '江', '史', '顾', '侯', '邵', '孟', '龙', '万', '段', '漕', '钱', '汤', '尹', '黎', '易', '常', '武', '乔', '贺', '赖', '龚', '文', '旷'];

// 提取丈夫姓名和籍贯
function extractHusbandInfo(text) {
  // 如果已经是 "姓名 + 籍贯" 格式（如 "张求贤上沧洲"）
  for (const surname of COMMON_SURNAMES) {
    const idx = text.indexOf(surname);
    if (idx >= 0) {
      const hometown = text.substring(0, idx).trim();
      const name = text.substring(idx).trim();
      
      let cleanHometown = hometown.replace(/[的与和]$/, '');
      if (cleanHometown.length >= 2) {
        return { name, hometown: cleanHometown };
      }
      return { name, hometown: null };
    }
  }
  
  // "出嫁 + 姓名 + 籍贯" 格式
  const match1 = text.match(/(?:出嫁|嫁)\s*([^\s，。,；;（）、]+?)(?:\s*，\s*|\s*，\s*)([^\s，。,；;（）；]+?)(?:\s*人)?$/);
  if (match1) {
    let hometown = match1[2].replace(/人$/, '');
    return { name: match1[1], hometown: hometown || null };
  }
  
  // "出嫁 + 姓名" 格式
  const match2 = text.match(/(?:出嫁|嫁)\s*([^\s，。,；;（）、]+?)(?:\s|$|[，。;；])/);
  if (match2) {
    return { name: match2[1], hometown: null };
  }
  
  return { name: text.trim(), hometown: null };
}

exports.main = async (event, context) => {
  const { dryRun = false, clearFirst = false } = event;
  
  try {
    console.log('开始提取女婿信息...');
    
    const results = {
      totalMembers: 0,
      membersWithSpouse: 0,
      sonsInLawExtracted: 0,
      sonsInLawImported: 0,
      errors: [],
      sonsInLawList: [],
      samples: []
    };
    
    // 清空sons_in_law表
    if (!dryRun && clearFirst) {
      const count = await db.collection('sons_in_law').count();
      if (count.total > 0) {
        let deleted = 0;
        while (deleted < count.total) {
          const { data } = await db.collection('sons_in_law')
            .limit(100)
            .field({ _id: true })
            .get();
          if (data.length === 0) break;
          
          for (const item of data) {
            await db.collection('sons_in_law').doc(item._id).remove();
            deleted++;
          }
        }
        console.log(`已清空 ${deleted} 条 sons_in_law 记录`);
      }
    }
    
    // 循环获取所有成员
    const batchSize = 100;
    let skip = 0;
    
    while (true) {
      const { data: members } = await db.collection('members')
        .field({ _id: true, name: true, originalId: true, generation: true, remark: true })
        .limit(batchSize)
        .skip(skip)
        .get();
      
      if (members.length === 0) break;
      
      results.totalMembers += members.length;
      
      for (const member of members) {
        if (!member.remark) continue;
        
        // 匹配"适"字婚配信息
        let marriageCount = 0;
        
        // 匹配 "适 + 内容" 格式
        const pattern1 = /(?:适|嫁至|赘至)\s*(.+?)(?:\s|$|[，。,；;])/g;
        let match;
        
        while ((match = pattern1.exec(member.remark)) !== null) {
          const rawText = match[1].trim();
          if (!rawText || rawText.length < 2) continue;
          if (rawText.match(/^\d+年/)) continue; // 跳过年份开头
          
          marriageCount++;
          const info = extractHusbandInfo(rawText);
          
          if (!info.name) {
            marriageCount--;
            continue;
          }
          
          const sonInLaw = {
            name: info.name,
            hometown: info.hometown,
            generation: member.generation,
            wifeId: String(member.originalId),
            wifeName: member.name,
            marriageOrder: marriageCount,
            marriageStatus: 'married',
            remark: member.remark.substring(0, 200),
            sourceMemberId: member._id,
            sourceText: rawText,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
          };
          
          results.sonsInLawList.push(sonInLaw);
          results.sonsInLawExtracted++;
          results.samples.push({
            member: member.name,
            original: rawText,
            name: info.name,
            hometown: info.hometown
          });
        }
        
        // 匹配 "出嫁 + 内容" 格式
        const pattern2 = /(?:^|[，,；;])\s*(?:出嫁|嫁)\s*(.+?)(?:\s|$|[，。,；;])/g;
        while ((match = pattern2.exec(member.remark)) !== null) {
          const rawText = match[1].trim();
          if (!rawText || rawText.length < 2) continue;
          
          marriageCount++;
          const info = extractHusbandInfo('出嫁' + rawText);
          
          if (!info.name) {
            marriageCount--;
            continue;
          }
          
          const sonInLaw = {
            name: info.name,
            hometown: info.hometown,
            generation: member.generation,
            wifeId: String(member.originalId),
            wifeName: member.name,
            marriageOrder: marriageCount,
            marriageStatus: 'married',
            remark: member.remark.substring(0, 200),
            sourceMemberId: member._id,
            sourceText: rawText,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
          };
          
          results.sonsInLawList.push(sonInLaw);
          results.sonsInLawExtracted++;
          results.samples.push({
            member: member.name,
            original: rawText,
            name: info.name,
            hometown: info.hometown
          });
        }
        
        if (marriageCount > 0) {
          results.membersWithSpouse++;
        }
      }
      
      skip += batchSize;
      console.log(`已处理 ${skip} 条，提取 ${results.sonsInLawExtracted} 个`);
    }
    
    // 导入
    if (!dryRun && results.sonsInLawList.length > 0) {
      for (let i = 0; i < results.sonsInLawList.length; i += 50) {
        await db.collection('sons_in_law').add({
          data: results.sonsInLawList.slice(i, i + 50)
        });
        results.sonsInLawImported += Math.min(50, results.sonsInLawList.length - i);
      }
    }
    
    return { success: true, message: dryRun ? '统计完成' : '导入完成', data: results };
    
  } catch (err) {
    console.error('失败:', err);
    return { success: false, message: err.message };
  }
};
