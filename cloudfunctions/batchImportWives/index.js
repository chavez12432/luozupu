// 批量导入媳妇数据云函数
// 从 members 表的 remark 字段提取婚配信息，导入 wives 表
//
// 提取逻辑：
// - "配坛源村王足兰" → 妻子：王足兰，籍贯：坛源村
// - "配柘溪刘晓琴" → 妻子：刘晓琴，籍贯：柘溪
// - 古代"王氏"等没有具体姓名，籍贯空缺

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

// 常见姓氏列表
const COMMON_SURNAMES = ['王', '李', '张', '刘', '陈', '杨', '黄', '赵', '吴', '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗', '梁', '宋', '郑', '谢', '韩', '唐', '冯', '于', '董', '萧', '程', '曹', '袁', '邓', '许', '傅', '沈', '曾', '彭', '吕', '苏', '卢', '蒋', '蔡', '贾', '丁', '魏', '薛', '叶', '阎', '余', '潘', '杜', '戴', '夏', '钟', '汪', '田', '任', '姜', '范', '方', '石', '姚', '谭', '廖', '邹', '熊', '金', '陆', '郝', '孔', '白', '崔', '康', '毛', '邱', '秦', '江', '史', '顾', '侯', '邵', '孟', '龙', '万', '段', '漕', '钱', '汤', '尹', '黎', '易', '常', '武', '乔', '贺', '赖', '龚', '文'];

// 提取籍贯和姓名
function extractWifeInfo(text) {
  // 如果是 X氏 格式
  if (text.includes('氏') && text.length <= 4) {
    return { name: null, hometown: null, maidenName: text.replace(/氏$/, '') };
  }
  
  // 查找常见姓氏的位置
  let surnameIndex = -1;
  for (const surname of COMMON_SURNAMES) {
    const idx = text.indexOf(surname);
    if (idx > 0 && (surnameIndex === -1 || idx < surnameIndex)) {
      surnameIndex = idx;
    }
  }
  
  // 如果找到姓氏
  if (surnameIndex > 0) {
    const hometown = text.substring(0, surnameIndex).trim();
    const namePart = text.substring(surnameIndex);
    
    // 清理籍贯末尾
    let cleanHometown = hometown.replace(/[的与和]$/, '');
    
    // 姓名可能是 "姓+名" 或 "姓+名+氏"
    let name = namePart.replace(/氏$/, '');
    const maidenName = name;
    
    // 如果籍贯只有一个字或看起来不像地名，不作为籍贯处理
    if (cleanHometown.length < 2 || /^[赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨]$/.test(cleanHometown)) {
      return { name: maidenName, hometown: null, maidenName };
    }
    
    return { name, hometown: cleanHometown, maidenName };
  }
  
  // 没有找到姓氏，整体作为姓名
  const name = text.trim().replace(/氏$/, '');
  return { name, hometown: null, maidenName: name };
}

// 提取婚配类型
function extractSpouseType(remark, matchStart) {
  const before = remark.substring(Math.max(0, matchStart - 5), matchStart);
  
  if (before.includes('元配')) return '元配';
  if (before.includes('继配') || before.includes('次配')) return '继配';
  if (before.includes('续配') || before.includes('复配')) return '续配';
  return '配';
}

// 提取葬地
function extractBurialPlace(remark) {
  const burialPatterns = [
    /(?:葬|痙)\s*([^，。,；;]+?)(?:，|。|$)/,
  ];
  
  for (const pattern of burialPatterns) {
    const match = remark.match(pattern);
    if (match) {
      const place = match[1].trim();
      if (place && !place.includes('子') && place.length < 30) {
        return place;
      }
    }
  }
  return '';
}

exports.main = async (event, context) => {
  const { dryRun = false, clearFirst = false } = event;
  
  try {
    console.log('开始提取媳妇信息...');
    console.log('dryRun:', dryRun, 'clearFirst:', clearFirst);
    
    const results = {
      totalMembers: 0,
      membersWithSpouse: 0,
      wivesExtracted: 0,
      wivesImported: 0,
      errors: [],
      wivesList: [],
      samples: []
    };
    
    // 清空wives表
    if (!dryRun && clearFirst) {
      const count = await db.collection('wives').count();
      if (count.total > 0) {
        let deleted = 0;
        while (deleted < count.total) {
          const { data } = await db.collection('wives')
            .limit(100)
            .field({ _id: true })
            .get();
          if (data.length === 0) break;
          
          for (const item of data) {
            await db.collection('wives').doc(item._id).remove();
            deleted++;
          }
        }
        console.log(`已清空 ${deleted} 条 wives 记录`);
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
        
        // 匹配所有婚配信息
        let marriageCount = 0;
        const patterns = [
          /(?:配|元配|继配|次配|续配|复配)\s*(.+?)(?:\s|$|[，。,；;])/g,
        ];
        
        for (const pattern of patterns) {
          let match;
          while ((match = pattern.exec(member.remark)) !== null) {
            const rawText = match[1].trim();
            if (!rawText || rawText.length < 2) continue;
            
            // 跳过子女相关
            if (rawText.includes('子') && rawText.match(/子[女]?[一二三四五六七八九十百千万\d]+/)) continue;
            
            marriageCount++;
            
            const info = extractWifeInfo(rawText);
            const spouseType = extractSpouseType(member.remark, match.index);
            
            const wife = {
              name: info.name,
              maidenName: info.maidenName,
              hometown: info.hometown,
              generation: member.generation,
              
              husbandId: String(member.originalId),
              husbandName: member.name,
              
              marriageType: spouseType,
              marriageOrder: marriageCount,
              marriageStatus: 'married',
              
              burialPlace: extractBurialPlace(member.remark),
              remark: member.remark.substring(0, 200),
              
              sourceMemberId: member._id,
              sourceText: rawText,
              
              createdAt: db.serverDate(),
              updatedAt: db.serverDate()
            };
            
            results.wivesList.push(wife);
            results.wivesExtracted++;
            
            // 保存样本用于验证
            if (results.samples.length < 15) {
              results.samples.push({
                member: member.name,
                original: rawText,
                name: info.name,
                hometown: info.hometown
              });
            }
          }
        }
        
        if (marriageCount > 0) {
          results.membersWithSpouse++;
        }
      }
      
      skip += batchSize;
      console.log(`已处理 ${skip} 条记录，提取 ${results.wivesExtracted} 个婚配信息`);
    }
    
    // 导入数据
    if (!dryRun && results.wivesList.length > 0) {
      console.log(`开始导入 ${results.wivesList.length} 条数据...`);
      
      const importBatchSize = 50;
      for (let i = 0; i < results.wivesList.length; i += importBatchSize) {
        const batch = results.wivesList.slice(i, i + importBatchSize);
        
        try {
          await db.collection('wives').add({ data: batch });
          results.wivesImported += batch.length;
        } catch (err) {
          console.error('导入失败:', err);
          results.errors.push({ batch: i / importBatchSize, error: err.message });
        }
      }
    }
    
    console.log('处理完成');
    
    return {
      success: true,
      message: dryRun ? '统计完成' : '导入完成',
      data: results
    };
    
  } catch (err) {
    console.error('处理失败:', err);
    return {
      success: false,
      message: err.message
    };
  }
};
