// 管理员 API 云函数
// 支持 HTTP 触发，用于 Web 后台直接访问

const cloud = require('wx-server-sdk');
const { buildEducationHonorLists } = require('./educationHonor');
const { listZanyingyinSages, INTRO: SAGES_INTRO } = require('./zanyingyinHonor');
const {
  parseSpousesFromRemark,
  spousesToSpouseInfo,
  normalizeSpouseName,
  linkSameVillageSpouses
} = require('./spouseParser');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 主入口函数
exports.main = async (event, context) => {
  // 腾讯云 HTTP 触发的 event 结构
  // {
  //   httpMethod: 'POST',
  //   headers: {...},
  //   body: '{"action":"list",...}',  // JSON 字符串
  //   queryStringParameters: {...}
  // }
  
  console.log('HTTP 方法:', event.httpMethod);
  console.log('Headers:', JSON.stringify(event.headers));
  console.log('Body 原始:', event.body);
  
  let params = {};
  
  // 处理 POST 请求
  if (event.httpMethod === 'POST') {
    try {
      params = JSON.parse(event.body || '{}');
    } catch (e) {
      console.error('解析 body 失败:', e);
      params = {};
    }
  }
  // 处理 GET 请求
  else if (event.httpMethod === 'GET') {
    params = event.queryStringParameters || {};
  }
  // 云函数直接调用
  else {
    params = event;
  }
  
  console.log('解析后的 params:', JSON.stringify(params));
  
  const action = params.action;
  const paramsData = params.data;
  const members = params.members;
  
  try {
    switch (action) {
      case 'list':
        return await listMembers(params);
      case 'get':
        return await getMember(paramsData);
      case 'create':
        return await createMember(paramsData);
      case 'update':
        return await updateMember(paramsData);
      case 'delete':
        return await deleteMember(paramsData);
      case 'batchImport':
        return await batchImportMembers(members);
      case 'clearAll':
        return await clearAllMembers();
      case 'getCount':
        return await getMembersCount();
      case 'batchUpdateDetails':
        return await batchUpdateDetails(params);
      case 'updateByName':
        return await updateMemberByName(paramsData);
      case 'updateSpouseInfo':
        return await updateSpouseInfoAction(params);
      case 'testSpouseInfo':
        return await testSpouseInfoAction(params);
      // 媳妇相关操作
      case 'listWives':
        return await listWives(params);
      case 'getWife':
        return await getWife(paramsData);
      case 'createWife':
        return await createWife(paramsData);
      case 'updateWife':
        return await updateWife(paramsData);
      case 'deleteWife':
        return await deleteWife(paramsData);
      // 女婿相关操作
      case 'listSonsInLaw':
        return await listSonsInLaw(params);
      case 'getSonInLaw':
        return await getSonInLaw(paramsData);
      case 'createSonInLaw':
        return await createSonInLaw(paramsData);
      case 'updateSonInLaw':
        return await updateSonInLaw(paramsData);
      case 'deleteSonInLaw':
        return await deleteSonInLaw(paramsData);
      // 族长相关操作
      case 'listPatriarchs':
        return await listPatriarchs(params);
      case 'getPatriarch':
        return await getPatriarch(paramsData);
      case 'createPatriarch':
        return await createPatriarch(paramsData);
      case 'updatePatriarch':
        return await updatePatriarch(paramsData);
      case 'deletePatriarch':
        return await deletePatriarch(paramsData);
      // 乡贤相关操作
      case 'listSages':
        return await listSages(params);
      case 'getSage':
        return await getSage(paramsData);
      case 'createSage':
        return await createSage(paramsData);
      case 'updateSage':
        return await updateSage(paramsData);
      case 'deleteSage':
        return await deleteSage(paramsData);
      // 群英相关操作
      case 'listElite':
        return await listElite(params);
      case 'getElite':
        return await getElite(paramsData);
      case 'createElite':
        return await createElite(paramsData);
      case 'updateElite':
        return await updateElite(paramsData);
      case 'deleteElite':
        return await deleteElite(paramsData);
      case 'resetEliteHeroes':
        return await resetEliteHeroes();
      // 学历榜相关操作
      case 'listEducationHonor':
        return await listEducationHonor(params);
      case 'listGraduates':
        return await listGraduates(params);
      case 'getGraduate':
        return await getGraduate(paramsData);
      case 'createGraduate':
        return await createGraduate(paramsData);
      case 'updateGraduate':
        return await updateGraduate(paramsData);
      case 'deleteGraduate':
        return await deleteGraduate(paramsData);
      case 'getGraduatesByYear':
        return await getGraduatesByYear(params);
      // 谱树
      case 'getFamilyTree':
        return await getFamilyTree(params);
      // 荣誉榜初始化
      case 'initHonorData':
        return await initHonorData(params);
      // 补充媳妇和女婿ID
      case 'fixSpouseIds':
        return await fixSpouseIds(params);
      case 'fixWives':
        return await fixSpouseIds({ action: 'fixWives' });
      case 'fixSonsInLaw':
        return await fixSpouseIds({ action: 'fixSonsInLaw' });
      case 'repairSpouseFromRemark':
        return await repairSpouseFromRemark(params);
      // 去重
      case 'dedupeWives':
        return await dedupeWives();
      case 'dedupeSonsInLaw':
        return await dedupeSonsInLaw();
      case 'debugWifeFields':
        return await debugWifeFields();
      case 'debugSonFields':
        return await debugSonFields();
      case 'debugWifeDuplicates':
        return await debugWifeDuplicates();
      case 'deleteWifesWithoutId':
        return await deleteWifesWithoutId();
      case 'deleteSonsWithoutId':
        return await deleteSonsWithoutId();
      case 'getRecordsWithoutId':
        return await getRecordsWithoutId();
      case 'cleanAllWithoutId':
        return await cleanAllWithoutId();
      case 'fixMemberIds':
        return await fixMemberIds();
      case 'fixWifesSpouseId':
        return await fixWifesSpouseId();
      case 'fixSonsSpouseId':
        return await fixSonsSpouseId();
      case 'debugMember':
        return await debugMember(params);
      // 运营：登录账号 / 开发者留言
      case 'listAccounts':
        return await listAccounts(params);
      case 'listDevMessages':
        return await listDevMessages(params);
      case 'markDevMessageRead':
        return await markDevMessageRead(paramsData || params);
      case 'getOpsStats':
        return await getOpsStats();
      default:
        return { success: false, message: '未知操作' };
    }
  } catch (err) {
    console.error('操作失败:', err);
    return { success: false, message: err.message };
  }
};

// 获取成员列表
async function listMembers(params) {
  const { branch, generation, page = 1, pageSize = 20 } = params;
  
  let query = db.collection('members');
  
  if (branch) {
    query = query.where({ branch });
  }
  if (generation) {
    query = query.where({ generation });
  }
  
  const countResult = await query.count();
  const total = countResult.total;
  
  const { data } = await query
    .orderBy('generation', 'asc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  
  // 补充亲属姓名（使用 originalId 匹配）
  const enrichedData = await Promise.all(data.map(async (member) => {
    // 补充父亲姓名
    if (member.fatherId) {
      try {
        const fatherId = String(member.fatherId).replace(/^M0+/, ''); // 去掉 M 前缀
        const { data: fathers } = await db.collection('members')
          .where({ originalId: Number(fatherId) || fatherId })
          .limit(1)
          .get();
        if (fathers && fathers.length > 0) {
          member._fatherName = fathers[0].name;
        }
      } catch (e) {
        console.log('查询父亲失败:', e);
      }
    }
    
    // 补充母亲姓名（优先用 motherName，如果没有则从父亲的 spouseName 获取）
    if (!member.motherName && member.fatherId) {
      try {
        const fatherId = String(member.fatherId).replace(/^M0+/, '');
        const { data: fathers } = await db.collection('members')
          .where({ originalId: Number(fatherId) || fatherId })
          .limit(1)
          .get();
        if (fathers && fathers.length > 0) {
          // 从父亲的婚配信息获取母亲姓氏
          if (fathers[0].spouseName) {
            member._motherName = fathers[0].spouseName;
          } else if (fathers[0].spouseInfo && fathers[0].spouseInfo.length > 0) {
            const firstSpouse = fathers[0].spouseInfo[0];
            member._motherName = typeof firstSpouse === 'object' ? firstSpouse.name : firstSpouse;
          }
        }
      } catch (e) {
        console.log('查询母亲失败:', e);
      }
    }
    
    // 补充配偶姓名（W… 查媳妇库；数字/M… 查族人）
    if (member.spouseId) {
      try {
        const sid = String(member.spouseId).trim();
        if (/^W/i.test(sid)) {
          let wife = null;
          try {
            const doc = await db.collection('wives').doc(sid).get();
            wife = doc.data;
          } catch (e) { /* ignore */ }
          if (!wife) {
            const { data: rows } = await db.collection('wives').where({ wifeId: sid }).limit(1).get();
            wife = rows && rows[0];
          }
          if (wife) member._spouseName = wife.name;
        } else {
          const spouseId = sid.replace(/^M0+/, '');
          const { data: spouses } = await db.collection('members')
            .where({ originalId: Number(spouseId) || spouseId })
            .limit(1)
            .get();
          if (spouses && spouses.length > 0) {
            member._spouseName = spouses[0].name;
          }
        }
      } catch (e) {
        console.log('查询配偶失败:', e);
      }
    }
    
    return member;
  }));
  
  return {
    success: true,
    data: enrichedData,
    total
  };
}

// 获取单个成员
async function getMember(data) {
  const { _id, name } = data;
  let member;
  
  if (_id) {
    const result = await db.collection('members').doc(_id).get();
    member = result.data;
  } else if (name) {
    const result = await db.collection('members').where({ name }).get();
    member = result.data && result.data.length > 0 ? result.data[0] : null;
  }
  
  return {
    success: !!member,
    data: member
  };
}

// 创建成员
async function nextOriginalId() {
  const res = await db.collection('members')
    .orderBy('originalId', 'desc')
    .limit(1)
    .get()
    .catch(() => ({ data: [] }));
  const top = res.data[0];
  const n = top && top.originalId != null ? Number(top.originalId) : 0;
  return (isNaN(n) ? 0 : n) + 1;
}

async function createMember(data) {
  const payload = { ...(data || {}) };
  if (payload.memberId != null && String(payload.memberId).trim() === '') delete payload.memberId;
  if (payload.originalId === '') delete payload.originalId;

  if (!payload.memberId || payload.originalId == null) {
    const originalId =
      payload.originalId != null && payload.originalId !== ''
        ? Number(payload.originalId)
        : await nextOriginalId();
    if (!payload.originalId) payload.originalId = originalId;
    if (!payload.memberId) payload.memberId = 'M' + String(originalId).padStart(6, '0');
  }

  const result = await db.collection('members').add({
    data: {
      ...payload,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });
  return {
    success: true,
    data: {
      _id: result._id,
      memberId: payload.memberId,
      originalId: payload.originalId
    }
  };
}

// 更新成员
async function updateMember(data) {
  const { _id, ...updateData } = data;
  await db.collection('members').doc(_id).update({
    data: {
      ...updateData,
      updatedAt: db.serverDate()
    }
  });
  return { success: true };
}

// 根据姓名更新成员
async function updateMemberByName(data) {
  const { name, ...updateFields } = data;
  
  if (!name) {
    return { success: false, message: '请提供姓名' };
  }
  
  // 查找该成员
  const { data: members } = await db.collection('members')
    .where({ name })
    .limit(1)
    .get();
  
  if (members.length === 0) {
    return { success: false, message: `未找到姓名为"${name}"的成员` };
  }
  
  const member = members[0];
  
  // 过滤掉空值
  const updateData = {};
  for (const [key, value] of Object.entries(updateFields)) {
    if (value !== undefined && value !== null && value !== '') {
      updateData[key] = value;
    }
  }
  
  if (Object.keys(updateData).length === 0) {
    return { success: false, message: '没有需要更新的字段' };
  }
  
  await db.collection('members').doc(member._id).update({
    data: {
      ...updateData,
      updatedAt: db.serverDate()
    }
  });
  
  return { success: true, message: '更新成功' };
}

// 删除成员
async function deleteMember(data) {
  const { _id } = data;
  await db.collection('members').doc(_id).remove();
  return { success: true };
}

// 批量导入
async function batchImportMembers(members) {
  if (!members || !Array.isArray(members) || members.length === 0) {
    return { success: false, message: '没有数据' };
  }
  
  const results = [];
  const errors = [];
  let imported = 0;
  
  // 分批处理
  const batchSize = 50;
  for (let i = 0; i < members.length; i += batchSize) {
    const batch = members.slice(i, i + batchSize);
    
    for (const member of batch) {
      try {
        const { _id, createdAt, updatedAt, ...cleanMember } = member;
        
        await db.collection('members').add({
          data: {
            ...cleanMember,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
          }
        });
        
        imported++;
      } catch (err) {
        errors.push({
          name: member.name,
          error: err.message
        });
      }
    }
  }
  
  return {
    success: errors.length === 0,
    imported,
    failed: errors.length,
    errors
  };
}

// 清空所有数据
async function clearAllMembers() {
  const { data } = await db.collection('members').get();
  
  const deletePromises = data.map(doc => {
    return db.collection('members').doc(doc._id).remove();
  });
  
  await Promise.all(deletePromises);
  
  return {
    success: true,
    deletedCount: data.length
  };
}

// 获取数量
async function getMembersCount() {
  const result = await db.collection('members').count();
  return {
    success: true,
    count: result.total
  };
}

// 批量更新族人详细信息
async function batchUpdateDetails(params) {
  const { memberDetails } = params;
  
  if (!memberDetails || typeof memberDetails !== 'object') {
    return { success: false, message: '请提供 memberDetails 数据' };
  }
  
  const results = {
    success: [],
    notFound: [],
    failed: []
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
          degree: typeof e === 'string' ? e : (e.degree || e),
          school: typeof e === 'object' ? (e.school || '') : '',
          major: typeof e === 'object' ? (e.major || '') : ''
        }));
      }
      if (details.positions) {
        updateData.positions = details.positions.map((p, index) => ({
          title: p.title || p,
          organization: p.organization || '',
          level: p.level || '',
          isCurrent: p.isCurrent || false,
          isDefault: index === details.positions.length - 1
        }));
      }
      if (details.residence) updateData.residence = details.residence;
      if (details.honors) {
        updateData.honors = details.honors.map(h => ({
          type: h.type || '',
          title: typeof h === 'string' ? h : (h.title || ''),
          level: h.level || '',
          year: h.year || null,
          description: h.description || ''
        }));
      }
      
      // 更新数据库
      const dbUpdateData = {
        ...updateData,
        updatedAt: db.serverDate()
      };
      await db.collection('members')
        .doc(member._id)
        .update({
          data: dbUpdateData
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

// 婚配信息提取和更新（完整版 - 循环处理全部数据）
async function updateSpouseInfoAction(params) {
  // 婚配正则表达式
  const SPOUSE_PATTERNS = [
    /配([^\s，。,；;（）\(\)第]+氏)/,
    /继配([^\s，。,；;（）\(\)第]+氏)/,
    /元配([^\s，。,；;（）\(\)第]+氏)/,
    /次配([^\s，。,；;（）\(\)第]+氏)/,
    /[一二三四五六七八九十]+配([^\s，。,；;（）\(\)第]+氏)/
  ];
  
  function extractSpouseName(remark) {
    if (!remark) return '';
    for (const pattern of SPOUSE_PATTERNS) {
      const match = remark.match(pattern);
      if (match && match[1]) return match[1];
    }
    return '';
  }
  
  function extractAllSpouses(remark) {
    if (!remark) return [];
    const spouses = [];
    const allPattern = /(?:配|继配|元配|次配|[一二三四五六七八九十]+配)([^\s，。,；;（）\(\)第]+氏)/g;
    let match;
    while ((match = allPattern.exec(remark)) !== null) {
      if (match[1]) spouses.push(match[1]);
    }
    return spouses;
  }
  
  const results = { updated: 0, hasSpouse: 0, noSpouse: 0, failed: [] };
  
  // 循环获取所有成员（云数据库每次最多返回100条）
  const batchSize = 100;
  let skip = 0;
  let totalProcessed = 0;
  
  while (true) {
    const { data: members } = await db.collection('members')
      .field({ _id: true, name: true, remark: true })
      .limit(batchSize)
      .skip(skip)
      .get();
    
    if (members.length === 0) break;
    
    console.log(`获取第 ${skip + 1}-${skip + members.length} 条记录...`);
    
    // 分批处理，每批20个并行
    const processBatchSize = 20;
    for (let i = 0; i < members.length; i += processBatchSize) {
      const batch = members.slice(i, i + processBatchSize);
      
      const promises = batch.map(async (member) => {
        try {
          const spouseName = extractSpouseName(member.remark);
          const allSpouses = extractAllSpouses(member.remark);
          
          if (spouseName || allSpouses.length > 0) {
            await db.collection('members').doc(member._id).update({
              data: {
                spouseName: spouseName,
                spouseInfo: allSpouses
              }
            });
            results.hasSpouse++;
          } else {
            results.noSpouse++;
          }
          results.updated++;
        } catch (err) {
          results.failed.push({ name: member.name, error: err.message });
        }
      });
      
      await Promise.all(promises);
    }
    
    totalProcessed += members.length;
    console.log(`已处理 ${totalProcessed} 条`);
    skip += batchSize;
  }
  
  return {
    success: true,
    message: `更新完成：共处理 ${results.updated} 条，有配偶 ${results.hasSpouse} 条，无配偶 ${results.noSpouse} 条`,
    data: results
  };
}

// 测试婚配信息显示 - 返回几个有婚配信息的样例
async function testSpouseInfoAction(params) {
  const { limit = 5 } = params;
  
  // 查询有 spouseInfo 的成员
  const { data: members } = await db.collection('members')
    .field({ _id: true, name: true, generation: true, spouseName: true, spouseInfo: true, remark: true })
    .where({
      spouseName: db.command.exists(true)
    })
    .limit(limit)
    .get();
  
  // 查询有 remark 但没有 spouseName 的成员（用于对比）
  const { data: noSpouse } = await db.collection('members')
    .field({ _id: true, name: true, generation: true, spouseName: true, spouseInfo: true, remark: true })
    .where({
      spouseName: db.command.exists(false),
      remark: db.command.exists(true)
    })
    .limit(3)
    .get();
  
  return {
    success: true,
    message: '婚配信息测试数据',
    data: {
      withSpouse: members,
      withoutSpouse: noSpouse
    }
  };
}

// ==================== 媳妇（Wives）相关操作 ====================

// 获取媳妇列表
async function listWives(params) {
  const { husbandId, generation, wifeId, page = 1, pageSize = 20 } = params;
  
  let query = db.collection('wives');
  
  if (husbandId) {
    query = query.where({ husbandId: String(husbandId) });
  }
  if (generation) {
    query = query.where({ generation });
  }
  if (wifeId) {
    query = query.where({ wifeId: String(wifeId) });
  }
  
  const countResult = await query.count();
  const total = countResult.total;
  
  const { data } = await query
    .orderBy('generation', 'asc')
    .orderBy('marriageOrder', 'asc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  
  return { success: true, data, total };
}

// 获取单个媳妇（支持 _id 或 wifeId，如 W000409_1）
async function getWife(data) {
  const id = data._id || data.wifeId || data.id;
  if (!id) return { success: false, message: '缺少媳妇ID' };

  try {
    const { data: wife } = await db.collection('wives').doc(String(id)).get();
    if (wife) return { success: true, data: wife };
  } catch (e) {
    // doc 不存在时继续按 wifeId 查
  }

  const { data: rows } = await db.collection('wives')
    .where({ wifeId: String(id) })
    .limit(1)
    .get();
  return { success: rows && rows.length > 0, data: rows && rows[0] };
}

// 创建媳妇
async function createWife(data) {
  // 生成 wifeId
  const countResult = await db.collection('wives').count();
  const nextId = countResult.total + 1;
  const wifeId = 'W' + String(nextId).padStart(6, '0');
  
  const result = await db.collection('wives').add({
    data: {
      ...data,
      wifeId: wifeId,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });
  return { success: true, data: { _id: result.id, wifeId: wifeId } };
}

// 更新媳妇
async function updateWife(data) {
  const { _id, ...updateData } = data;
  await db.collection('wives').doc(_id).update({
    data: {
      ...updateData,
      updatedAt: db.serverDate()
    }
  });
  return { success: true, message: '更新成功' };
}

// 删除媳妇
async function deleteWife(data) {
  const { _id } = data;
  await db.collection('wives').doc(_id).remove();
  return { success: true, message: '删除成功' };
}

// ==================== 女婿（SonsInLaw）相关操作 ====================

// 获取女婿列表
async function listSonsInLaw(params) {
  const { wifeId, generation, page = 1, pageSize = 20 } = params;
  
  let query = db.collection('sons_in_law');
  
  if (wifeId) {
    query = query.where({ wifeId: String(wifeId) });
  }
  if (generation) {
    query = query.where({ generation });
  }
  
  const countResult = await query.count();
  const total = countResult.total;
  
  const { data } = await query
    .orderBy('generation', 'asc')
    .orderBy('marriageOrder', 'asc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  
  return { success: true, data, total };
}

// 获取单个女婿
async function getSonInLaw(data) {
  const { _id } = data;
  const { data: sonInLaw } = await db.collection('sons_in_law').doc(_id).get();
  return { success: !!sonInLaw, data: sonInLaw };
}

// 创建女婿
async function createSonInLaw(data) {
  // 生成 sonId
  const countResult = await db.collection('sons_in_law').count();
  const nextId = countResult.total + 1;
  const sonId = 'S' + String(nextId).padStart(6, '0');
  
  const result = await db.collection('sons_in_law').add({
    data: {
      ...data,
      sonId: sonId,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  });
  return { success: true, data: { _id: result.id, sonId: sonId } };
}

// 更新女婿
async function updateSonInLaw(data) {
  const { _id, ...updateData } = data;
  await db.collection('sons_in_law').doc(_id).update({
    data: {
      ...updateData,
      updatedAt: db.serverDate()
    }
  });
  return { success: true, message: '更新成功' };
}

// 删除女婿
async function deleteSonInLaw(data) {
  const { _id } = data;
  await db.collection('sons_in_law').doc(_id).remove();
  return { success: true, message: '删除成功' };
}

// ============ 荣誉榜相关 API ============

// 族长列表
async function listPatriarchs(params) {
  const { branch, page = 1, pageSize = 100 } = params;
  const where = {};
  if (branch) where.branch = branch;
  
  const countResult = await db.collection('patriarchs').where(where).count();
  const total = countResult.total;
  
  const { data } = await db.collection('patriarchs')
    .where(where)
    .orderBy('sortOrder', 'asc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  
  return { success: true, data, total };
}

async function getPatriarch(data) {
  const { _id } = data;
  const { data: item } = await db.collection('patriarchs').doc(_id).get();
  return { success: true, data: item };
}

async function createPatriarch(data) {
  const result = await db.collection('patriarchs').add({
    data: { ...data, createdAt: db.serverDate(), updatedAt: db.serverDate() }
  });
  return { success: true, data: { _id: result._id } };
}

async function updatePatriarch(data) {
  const { _id, ...updateData } = data;
  await db.collection('patriarchs').doc(_id).update({
    data: { ...updateData, updatedAt: db.serverDate() }
  });
  return { success: true, message: '更新成功' };
}

async function deletePatriarch(data) {
  await db.collection('patriarchs').doc(data._id).remove();
  return { success: true, message: '删除成功' };
}

// 乡贤列表（簪缨引）
async function listSages(params) {
  const { dynasty, page = 1, pageSize = 100 } = params;
  const all = listZanyingyinSages(dynasty || null);
  const list = all.slice((page - 1) * pageSize, page * pageSize);
  return {
    success: true,
    data: list,
    total: all.length,
    intro: SAGES_INTRO
  };
}

async function getSage(data) {
  const { data: item } = await db.collection('sages').doc(data._id).get();
  return { success: true, data: item };
}

async function createSage(data) {
  const result = await db.collection('sages').add({
    data: { ...data, createdAt: db.serverDate(), updatedAt: db.serverDate() }
  });
  return { success: true, data: { _id: result._id } };
}

async function updateSage(data) {
  const { _id, ...updateData } = data;
  await db.collection('sages').doc(_id).update({
    data: { ...updateData, updatedAt: db.serverDate() }
  });
  return { success: true, message: '更新成功' };
}

async function deleteSage(data) {
  await db.collection('sages').doc(data._id).remove();
  return { success: true, message: '删除成功' };
}

// 群英列表
async function listElite(params) {
  const { achievementType, page = 1, pageSize = 100 } = params;
  const where = {};
  if (achievementType) where.achievementType = achievementType;
  
  const countResult = await db.collection('elite').where(where).count();
  const total = countResult.total;
  
  let data = [];
  try {
    const result = await db.collection('elite')
      .where(where)
      .orderBy('sortOrder', 'asc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    data = result.data;
  } catch (e) {
    // 旧数据可能无 sortOrder 索引，回退按世代
    const result = await db.collection('elite')
      .where(where)
      .orderBy('generation', 'asc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    data = result.data;
  }
  
  return { success: true, data, total };
}

async function getElite(data) {
  const { data: item } = await db.collection('elite').doc(data._id).get();
  return { success: true, data: item };
}

async function createElite(data) {
  const result = await db.collection('elite').add({
    data: { ...data, createdAt: db.serverDate(), updatedAt: db.serverDate() }
  });
  return { success: true, data: { _id: result._id } };
}

async function updateElite(data) {
  const { _id, ...updateData } = data;
  await db.collection('elite').doc(_id).update({
    data: { ...updateData, updatedAt: db.serverDate() }
  });
  return { success: true, message: '更新成功' };
}

async function deleteElite(data) {
  await db.collection('elite').doc(data._id).remove();
  return { success: true, message: '删除成功' };
}

/** 当今族人撷英（七人），清空旧职位关联名单后重新写入 */
const ELITE_HEROES_SEED = [
  {
    id: 'xiangwen', name: '相文', branch: '明儒堂', generation: 35, birthYear: 1968,
    summary: '明儒堂三十五世，江西省委宣传部办公室副调研员',
    achievementType: '政务', position: '副调研员', organization: '中共江西省委宣传部办公室',
    biography: '明儒堂三十五世相文，生于1968年5月26日。自幼勤奋好学，在高洲小学、洋门中学分别读完小学、初中后于1985年考入江西省永新师范，参加工作后又先后就读于江西省吉安教育学院、中共江西省委党校理论班。\n\n1988年7月从永新师范毕业后参加工作，在洋门中学任教并兼任团委书记；1992年3月调安福县江南乡政府工作，同年8月调中共安福县委统战部工作；1996年9月调中共吉安地委宣传部任副主任科员，2001年任中共吉安市委宣传部主任科员、办公室主任；2005年11月调中共江西省委宣传部任办公室主任科员、副调研员（副县级）。\n\n相文自参加工作以来，一直积极进取，努力工作，勤于写作，在国家和省、市级报刊上发表文章50多篇，并多次获得“优秀公务员”和“优秀共产党员”称号。\n\n相文支持续修族谱，主动捐款壹仟元。'
  },
  {
    id: 'chuanfang', name: '传芳', branch: '忠爱堂', generation: 33, birthYear: 1943,
    summary: '忠爱堂三十三世，原樟树市农业生产资料公司经理',
    achievementType: '军事', position: '经理、党支部书记', organization: '江西樟树市农业生产资料公司',
    biography: '忠爱堂三十三世传芳，生于1943年7月17日午时，从小读书，1963年12月加入中国共产主义青年团，1964年应征入伍，光荣参加中国人民解放军，1965年评为五好战士，表现突出，1967年3月加入中国共产党，成为一名光荣的共产党员。在部队大熔炉里得到了锻炼和培养，提交了思想觉悟，增强了工作能力，1969年3月任命为福州军区独立师三营十一连二排排长、连党支部委员。71年1月荣升为副连长，同年10月提升为连长、党支部书记，77年12月提升为福州军区独立二师六团营长、营党支部书记。十多年的部队生活，在部队首长的教导下，认真看书学习，业绩明显，多次受到奖励。1981年转业，分配在江西樟树市农业生产资料公司任经理、党支部书记，在新的工作岗位上，勤奋工作，带头维护党的团结和国家利益，带领职工为党和国家作出了较大的贡献。2003年从领导岗位上退下来，保持本色，做一个好党员、好公民。\n\n家乡续修族谱，积极支持，捐款壹仟元。'
  },
  {
    id: 'jianxin', name: '建新', branch: '明儒堂', generation: 35, birthYear: null,
    summary: '明儒堂三十五世，深圳博民科技有限公司负责人',
    achievementType: '企业', position: '负责人', organization: '深圳博民科技有限公司',
    biography: '祖籍修谱，全家欣慰，远离故土，徙居他乡的我们终有个归属记载的地方。六十六年前父亲三香约十岁，我单身祖母，为父亲躲避抓壮丁，带着他东躲西藏，甚至还改名叫海香。从1942年中秋节过后的一个夜晚离开家，到1946年上半年，三年多时间，背井离乡、漂泊生活，曾借宿嘉溪染布店、诸桥洋鸭里、廖家、白塘等地，祖母帮人家舂米洗衣服当佣人，母子艰难度日。父亲说：在那特定的历史时期，因内战需要兵源，当时乡公所还经常到处寻找着他们，无奈之下，在1946年端午节后的某一天，十多岁的父亲跟随白塘村姑表兄朱芹善，从家乡步行，经永新县介化垅、湖南茶陵、桂阳、道县到达广西灌阳县文市镇西街一个叫慎记杂货店当学徒，次后随该店搬迁，到全州县城湘山街改为德兴隆杂货店继续当学徒。\n\n1949年12月人民解放军解放全州，1950年县成立工会，父亲即加入了工会。于1952年7月8日经县工会介绍，进县油脂公司工作。1953年1月5日加入共青团，1955年元月28日加入中国共产党。在参加工作期间，组织上曾分别派他去桂林地委干校，桂林财贸干校学习，曾历任全州县绍水油脂公司营业处副主任、粮管所副所长；两河粮管所营业员、保管组长、政治指导员、党支部书记，1993年1月退休。在单位工作的四十多年间，曾受过各种奖项23次，三次被评为优秀共产党员。在家里是一位慈祥而高尚的父亲，为了我们六个儿女，以至孙儿孙女的成长与母亲一道同艰共苦、任劳任怨、全心全意付出了一生全部心血。我母亲于1987年逝世了，父亲今年已77岁，听说家乡续修族谱，就欣然捐款1000元人民币，以表示赞助。我借此谱碟一页，祝他老人家越老越康，长命百岁！也愿我们做儿女的珍惜长辈们晚年这有限时光，能孝道就要尽力去孝道，时过后悔是回不来的，它将会使你遗憾一生。\n\n居住广西壮族自治区全州县粮油综合厂\n三十五世孙广西财经学院本科生深圳\n博民科技有限公司负责人 建新谨撰\n2008年6月18日 吉旦'
  },
  {
    id: 'guocai', name: '国才', branch: '德裕堂', generation: 34, birthYear: 1942,
    summary: '德裕堂三十四世，原省轻工业厅直属技工学校党委书记、校长',
    achievementType: '教育', position: '党委书记兼校长', organization: '江西省轻工业厅直属技工学校',
    biography: '德裕堂第三十四世国才，生于1942年7月3日。1950年至1962年先后在高洲初小、上城高小、安福初中、永新师范就读毕业。1990年至1993年在职函授大专毕业。1962年8月参加工作，在上城小学任教，热爱教育事业，工作任劳任怨，连续三年评为优秀教师。\n\n1964年12月应征入伍，独子当兵，全家光荣。在部队表现突出，1965年10月入党，任班长，1967年初破格提升为排长，1967年底提升为连队政治指导员，任职期间分别评为先进班、先进排和先进连。1969年底调师部任秘书、军区首长秘书、军直政治工作处处长（正团级），工作积极，先后多次受到师、军、军区嘉奖并评为先进工作者。在这段时间，父母先后重病去世，正好部队担负紧急战备任务，出于服从大局都未回家尽孝，正是忠于党和军队的事业，忠孝难两全。\n\n1985年底，服从全军一盘棋，精简整编，光荣转业，安排在江西省轻工业厅直属技工学校任党委书记兼校长（正县级）。在校任职时团结班子、带领教工、严谨治校、规模扩大，成为国家重点高级技校。善于思想政治工作，注重思想工作研究，曾在全国轻工教育学会任理事、机电教学研究会会长，先后二十多篇论文在年会、报刊上发表，获全国轻工教育论文奖五篇。\n\n他关注家乡，捐款1000元支持七次续修族谱，还捐款修下里桥和高洲村水泥路。'
  },
  {
    id: 'decai', name: '德才', branch: '德裕堂', generation: 34, birthYear: 1971,
    summary: '德裕堂三十四世，洲湖镇党委书记、人大主席',
    achievementType: '政务', position: '镇党委书记、人大主席', organization: '安福县洲湖镇',
    biography: '德裕堂三十四世德才，生于1971年6月4日。在高洲小学、洋门中学读完小学、初中，1986年考入永新师范，三年完成学业参加工作。工作期间坚持自学，参加江西大学中文系自学考试，大专毕业，之后又参加中央党校函授法律系大学毕业。\n\n1989年7月永新师范毕业，分配在洋门乡上街小学教书。1991年调洋门中学、彭坊中学教书，先后任工会主席、政教处主任。1996年8月参加安福县公务员招录考试，录用在中共安福县委组织部工作，先后任科员、副科级组织员、组织部副部长兼农村基层组织建设办公室主任、县直机关工委副书记。2006年7月调洲湖镇任镇党委书记、人大主席。2006年初当选中共安福县委委员，当选中国共产党江西省第十二次代表大会代表，出席2006年12月召开的江西省第十二次党代会。\n\n德才热爱家乡，捐款2000元，想方设法筹资6000元支持下里桥建设，热心赞助1000元支持续修族谱。'
  },
  {
    id: 'qingliang', name: '庆良', branch: '德裕堂', generation: 35, birthYear: 1940,
    summary: '德裕堂三十五世，原峡江县委常委、组织部部长',
    achievementType: '政务', position: '县委常委、组织部部长', organization: '中共峡江县委',
    biography: '德裕堂三十五世庆良，生于1940年10月24日（岁次庚辰九月二十四日）。自小就读于高洲初级小学、上城小学、安福初级中学，1958年保送进吉安师范读书。工作期间自学深圳大学行政管理并结业。\n\n1960年8月吉安师范提前一年毕业，选派到吉安市禾埠小学工作，任教导主任。1962年1月8日加入中国共产党，成为一名中国共产党党员。1968年底筹办禾埠高中，后改名为禾埠共产主义劳动大学，任校革命委员会副主任，之后恢复禾埠中学校名，任校长，1978年4月任禾埠辅导区主任。在教育战线工作22年，多次评为先进个人，1962年评为吉安市先进工作者，1973年评为吉安市教育系统标兵。\n\n1982年9月调中共吉安市委组织部任主办干事、组织员办公室主任、组织部副部长。1991年9月调峡江县任中共峡江县委常委、组织部部长。1997年5月调回吉安市任副县级调研员，直至2000年12月退休。期间从事党建工作16年，在吉安市工作时，总结推广党员活动日制度，编写发展党员工作程序和民主评议党员程序等，中共吉安地委组织部在全区推广；在峡江工作时，配合县委加强农村基层组织建设，加快村级经济发展有成效，中共吉安地委组织部带领各县（市）委组织部部长参观学习，中共吉安地委书记亲自组织各县（市）委书记等近100人，参观峡江村级党建工作。撰写十多篇文章在党报、党刊上发表，连续多年评为《江西党建》优秀通讯员。1985年、1986年、1988年分别评为吉安市优秀党员，1989年至1991年连续三年评为吉安市优秀党务工作者，1995年中共吉安地委授予优秀党务工作者称号。\n\n庆良热爱家乡，率先倡议七修高洲罗氏族谱，组织并参与具体工作，为续修族谱和新修下里桥、修高洲村水泥路都各捐款壹仟元。'
  },
  {
    id: 'zhijian', name: '志坚', branch: '德裕堂', generation: 36, birthYear: 1965,
    summary: '德裕堂三十六世，原中国联通赣州分公司总经理',
    achievementType: '企业', position: '总经理', organization: '中国联通赣州分公司',
    biography: '德裕堂三十六世志坚（现名坚），1965年7月3日生于吉安市，1982年吉安二中高中毕业，考入江西工学院（现南昌大学）无线电专业，1986年大学毕业，获工学学士学位。\n\n服从组织分配，在吉安地区邮电局参与微波站筹建工作，1989年度荣获共青团吉安地委授予“全区优秀共青团员”称号，1991年被评聘为工程师，1997年任吉安地区邮电局运维部副主任（主持工作），1997年被国家邮电部电信总局、中国邮电工会全国委员会联合授予“长途来话接通率竞赛优秀个人”，1998年任峡江县电信局局长，1999年电信分离移动通信，任吉安地区移动通信公司党委委员、市场部主任。\n\n2000年初应聘为中国联通吉安分公司副总经理（主持工作），负责中国联通吉安分公司的筹建工作，因业绩突出2000年底任命为总经理（正县级待遇），同年获得高级工程师职称。2001年—2003年接受澳大利亚堪培拉大学MBA在职教育，获MBA硕士学位。2003年荣获中国联通总部党组织授予“优秀共产党员称号”，并将所学的知识用于指导工作，强化企业管理，向管理要效益，工作期间先后发表了许多论文，其中《青苹果、红苹果》，《薪酬积分制，员工效益增》等论文，分别获中国联通总部“创新成果优秀奖”。2005年被江西省质量协会评为“江西省用户满意活动卓越领导者”，同年被中国联通总部评为“合理化建议先进个人”。\n\n2005年底调中国联通赣州分公司任总经理，深入调研，开拓市场，改善服务，经济效益提高，2007年评为赣州市第十三届“十大杰出青年”，2008年荣获赣州市“五一劳动奖章”。\n\n志坚关心家乡，无论是修下里桥，还是修高洲村水泥路都热心赞助，分别捐款2000元和3200元，对七次续修族谱积极支持，捐款1200元。'
  }
];

async function resetEliteHeroes() {
  // 清空原有关联人员
  const batchSize = 100;
  let removed = 0;
  while (true) {
    const { data } = await db.collection('elite').limit(batchSize).get();
    if (!data.length) break;
    await Promise.all(data.map(item => db.collection('elite').doc(item._id).remove()));
    removed += data.length;
  }

  // 写入当今族人撷英七人
  let added = 0;
  for (let i = 0; i < ELITE_HEROES_SEED.length; i++) {
    const hero = ELITE_HEROES_SEED[i];
    await db.collection('elite').add({
      data: {
        heroId: hero.id,
        name: hero.name,
        branch: hero.branch,
        generation: hero.generation,
        birthYear: hero.birthYear,
        summary: hero.summary,
        achievementType: hero.achievementType,
        position: hero.position,
        organization: hero.organization,
        biography: hero.biography,
        memberId: '',
        level: '',
        isAlive: true,
        sortOrder: i + 1,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
    });
    added++;
  }

  return {
    success: true,
    message: '已清空旧关联并重置为当今族人撷英',
    data: { removed, added }
  };
}

/** 学历榜三类：从 members.education 实时归类 */
async function listEducationHonor() {
  const allMembers = [];
  const pageSize = 500;
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await db.collection('members')
      .field({
        _id: true,
        name: true,
        birthDate: true,
        education: true,
        remark: true
      })
      .skip(skip)
      .limit(pageSize)
      .get();

    allMembers.push(...result.data);
    skip += pageSize;
    hasMore = result.data.length === pageSize;
    if (allMembers.length >= 5000) break;
  }

  // 含教育字段或备注（不少人学历只写在 remark，如强飞、顶飞）
  const candidates = allMembers.filter(m =>
    (Array.isArray(m.education) && m.education.length > 0) ||
    (m.remark && String(m.remark).trim())
  );
  const data = buildEducationHonorLists(candidates);

  return {
    success: true,
    data,
    total: {
      imperial: data.imperial.length,
      republican: data.republican.length,
      modern: data.modern.length
    }
  };
}

// 学历榜列表（旧 graduates 表，保留兼容）
async function listGraduates(params) {
  const { year, degree, page = 1, pageSize = 100 } = params;
  const where = {};
  if (year) where.graduationYear = Number(year);
  if (degree) where.degree = degree;
  
  const countResult = await db.collection('graduates').where(where).count();
  const total = countResult.total;
  
  const { data } = await db.collection('graduates')
    .where(where)
    .orderBy('graduationYear', 'desc')
    .orderBy('name', 'asc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();
  
  return { success: true, data, total };
}

async function getGraduate(data) {
  const { data: item } = await db.collection('graduates').doc(data._id).get();
  return { success: true, data: item };
}

async function createGraduate(data) {
  const result = await db.collection('graduates').add({
    data: { ...data, createdAt: db.serverDate(), updatedAt: db.serverDate() }
  });
  return { success: true, data: { _id: result._id } };
}

async function updateGraduate(data) {
  const { _id, ...updateData } = data;
  await db.collection('graduates').doc(_id).update({
    data: { ...updateData, updatedAt: db.serverDate() }
  });
  return { success: true, message: '更新成功' };
}

async function deleteGraduate(data) {
  await db.collection('graduates').doc(data._id).remove();
  return { success: true, message: '删除成功' };
}

// 获取学历年份统计
async function getGraduatesByYear(params) {
  const { data: graduates } = await db.collection('graduates')
    .field({ graduationYear: true })
    .orderBy('graduationYear', 'desc')
    .get();
  
  // 统计每年人数
  const yearStats = {};
  for (const g of graduates) {
    if (g.graduationYear) {
      yearStats[g.graduationYear] = (yearStats[g.graduationYear] || 0) + 1;
    }
  }
  
  const years = Object.keys(yearStats).map(Number).sort((a, b) => b - a);
  
  return { success: true, data: { years, yearStats } };
}

// 获取谱树数据（四堂入口 / 单堂成员供世系图）
async function getFamilyTree(params) {
  const { branch } = params;
  const HALLS = ['中和堂', '明儒堂', '德裕堂', '忠爱堂'];

  async function fetchAllMembers(where) {
    const all = [];
    const pageSize = 100;
    let skip = 0;
    for (;;) {
      const { data } = await db.collection('members')
        .where(where)
        .field({
          _id: true,
          name: true,
          originalId: true,
          memberId: true,
          generation: true,
          branch: true,
          fatherId: true,
          fatherName: true,
          gender: true,
          spouseName: true,
          spouseInfo: true,
          hasBrokenLineage: true
        })
        .skip(skip)
        .limit(pageSize)
        .get();
      all.push(...data);
      if (data.length < pageSize || all.length >= 5000) break;
      skip += pageSize;
    }
    return all;
  }

  if (!branch) {
    const halls = [];
    for (const name of HALLS) {
      const list = await fetchAllMembers({ branch: name });
      const gens = list.map(m => m.generation || 0);
      halls.push({
        branch: name,
        total: list.length,
        minGen: gens.length ? Math.min(...gens) : 0,
        maxGen: gens.length ? Math.max(...gens) : 0
      });
    }
    return { success: true, data: { mode: 'hub', halls } };
  }

  const members = await fetchAllMembers({ branch });
  return {
    success: true,
    data: { mode: 'chart', branch, members, total: members.length }
  };
}

// 补充媳妇和女婿的ID
async function fixSpouseIds(params) {
  const { action } = params;
  
  if (action === 'fixWives') {
    // 为 wives 表补充 wifeId
    const wives = await db.collection('wives').get();
    let fixed = 0;
    
    for (let i = 0; i < wives.data.length; i++) {
      const wife = wives.data[i];
      if (!wife.wifeId) {
        const wifeId = 'W' + String(i + 1).padStart(6, '0');
        await db.collection('wives').doc(wife._id).update({
          data: { wifeId }
        });
        fixed++;
      }
    }
    
    return { success: true, message: `已为 ${fixed} 条媳妇记录补充ID` };
  }
  
  if (action === 'fixSonsInLaw') {
    // 为 sons_in_law 表补充 sonId
    const sons = await db.collection('sons_in_law').get();
    let fixed = 0;
    
    for (let i = 0; i < sons.data.length; i++) {
      const son = sons.data[i];
      if (!son.sonId) {
        const sonId = 'S' + String(i + 1).padStart(6, '0');
        await db.collection('sons_in_law').doc(son._id).update({
          data: { sonId }
        });
        fixed++;
      }
    }
    
    return { success: true, message: `已为 ${fixed} 条女婿记录补充ID` };
  }
  
  return { success: false, message: '请指定 action: fixWives 或 fixSonsInLaw' };
}

// 调试：查看媳妇表的所有字段名
async function debugWifeFields() {
  const { data } = await db.collection('wives').limit(3).get();
  if (data.length === 0) return { success: false, message: 'wives表为空' };
  return { success: true, fields: Object.keys(data[0]), sample: data[0] };
}

// 调试：查看女婿表的所有字段名
async function debugSonFields() {
  const { data } = await db.collection('sons_in_law').limit(3).get();
  if (data.length === 0) return { success: false, message: 'sons_in_law表为空' };
  return { success: true, fields: Object.keys(data[0]), sample: data[0] };
}

// 删除没有 wifeId 的媳妇记录（批量删除）
async function deleteWifesWithoutId() {
  const { data } = await db.collection('wives').where({ wifeId: db.command.exists(false) }).limit(1000).get();
  if (data.length === 0) return { success: true, message: '没有无ID的媳妇记录' };
  
  const ids = data.map(w => w._id);
  await db.collection('wives').where({ _id: db.command.in(ids) }).remove();
  
  return { success: true, message: `批量删除 ${ids.length} 条无ID的媳妇记录` };
}

// 删除没有 sonId 的女婿记录（批量删除）
async function deleteSonsWithoutId() {
  const { data } = await db.collection('sons_in_law').where({ sonId: db.command.exists(false) }).limit(1000).get();
  if (data.length === 0) return { success: true, message: '没有无ID的女婿记录' };
  
  const ids = data.map(s => s._id);
  await db.collection('sons_in_law').where({ _id: db.command.in(ids) }).remove();
  
  return { success: true, message: `批量删除 ${ids.length} 条无ID的女婿记录` };
}

// 统计无ID记录数量
async function getRecordsWithoutId() {
  const wivesCount = await db.collection('wives').where({ wifeId: db.command.exists(false) }).count();
  const sonsCount = await db.collection('sons_in_law').where({ sonId: db.command.exists(false) }).count();
  const wivesTotal = await db.collection('wives').count();
  const sonsTotal = await db.collection('sons_in_law').count();
  
  return {
    success: true,
    data: {
      wives: { total: wivesTotal.total, withoutId: wivesCount.total, withId: wivesTotal.total - wivesCount.total },
      sons_in_law: { total: sonsTotal.total, withoutId: sonsCount.total, withId: sonsTotal.total - sonsCount.total }
    }
  };
}

// 清理所有无ID记录（循环删除直到删完）
async function cleanAllWithoutId() {
  let wivesDeleted = 0;
  let sonsDeleted = 0;
  
  // 删除无ID的媳妇
  while (true) {
    const { data } = await db.collection('wives').where({ wifeId: db.command.exists(false) }).limit(1000).get();
    if (data.length === 0) break;
    const ids = data.map(w => w._id);
    await db.collection('wives').where({ _id: db.command.in(ids) }).remove();
    wivesDeleted += ids.length;
  }
  
  // 删除无ID的女婿
  while (true) {
    const { data } = await db.collection('sons_in_law').where({ sonId: db.command.exists(false) }).limit(1000).get();
    if (data.length === 0) break;
    const ids = data.map(s => s._id);
    await db.collection('sons_in_law').where({ _id: db.command.in(ids) }).remove();
    sonsDeleted += ids.length;
  }
  
  return { success: true, message: `清理完成：删除 ${wivesDeleted} 条媳妇记录，${sonsDeleted} 条女婿记录` };
}

// 为 members 表生成 memberId（M开头）
async function fixMemberIds() {
  const members = await db.collection('members').get();
  let fixed = 0;
  
  for (let i = 0; i < members.data.length; i++) {
    const member = members.data[i];
    if (!member.memberId) {
      const memberId = 'M' + String(i + 1).padStart(6, '0');
      await db.collection('members').doc(member._id).update({
        data: { memberId }
      });
      fixed++;
    }
  }
  
  return { success: true, message: `已为 ${fixed} 条族人记录生成 memberId` };
}

// 修复 wives 表的 spouseId 关联（基于 husbandId 关联到 members.spouseId）
async function fixWifesSpouseId() {
  const wives = await db.collection('wives').where({ wifeId: db.command.exists(true) }).get();
  let fixed = 0;
  
  for (const wife of wives.data) {
    if (wife.husbandId && !wife.spouseId) {
      // 查找对应的男族人
      const husbands = await db.collection('members')
        .where({ originalId: String(wife.husbandId) })
        .limit(1)
        .get();
      
      if (husbands.data.length > 0) {
        const husband = husbands.data[0];
        // 更新媳妇的 spouseId（关联到丈夫的 memberId 或 originalId）
        const spouseId = husband.memberId || husband.originalId || husband._id;
        await db.collection('wives').doc(wife._id).update({
          data: { spouseId: spouseId }
        });
        
        // 同时更新丈夫的 spouseId
        if (husband.spouseId !== wife.wifeId) {
          await db.collection('members').doc(husband._id).update({
            data: { spouseId: wife.wifeId }
          });
        }
        fixed++;
      }
    }
  }
  
  return { success: true, message: `已修复 ${fixed} 条媳妇记录的配偶关联` };
}

// 修复 sons_in_law 表的 spouseId 关联（基于 wifeId 关联到 members.spouseId）
async function fixSonsSpouseId() {
  const sons = await db.collection('sons_in_law').where({ sonId: db.command.exists(true) }).get();
  let fixed = 0;
  
  for (const son of sons.data) {
    if (son.wifeId && !son.spouseId) {
      // 查找对应的罗氏女儿
      const wives = await db.collection('members')
        .where({ originalId: String(son.wifeId), gender: '女' })
        .limit(1)
        .get();
      
      if (wives.data.length > 0) {
        const wife = wives.data[0];
        // 更新女婿的 spouseId
        const spouseId = wife.memberId || wife.originalId || wife._id;
        await db.collection('sons_in_law').doc(son._id).update({
          data: { spouseId: spouseId }
        });
        
        // 同时更新妻子的 spouseId
        if (wife.spouseId !== son.sonId) {
          await db.collection('members').doc(wife._id).update({
            data: { spouseId: son.sonId }
          });
        }
        fixed++;
      }
    }
  }
  
  return { success: true, message: `已修复 ${fixed} 条女婿记录的配偶关联` };
}

// 调试：统计同 maidenName+husbandId 的记录数
async function debugWifeDuplicates() {
  const wives = await db.collection('wives').get();
  const groups = {};
  for (const wife of wives.data) {
    const key = `${wife.maidenName || ''}|${wife.husbandId || ''}|${wife.generation || ''}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push({ _id: wife._id, name: wife.name, maidenName: wife.maidenName, husbandId: wife.husbandId });
  }
  // 只显示有重复的组
  const duplicates = Object.entries(groups).filter(([k, v]) => v.length > 1);
  return { success: true, totalRecords: wives.data.length, duplicateGroups: duplicates };
}

// 媳妇去重（maidenName + husbandId + generation 都相同才算重复）
async function dedupeWives() {
  const wives = await db.collection('wives').get();
  const seen = new Map();
  const toDelete = [];
  
  for (const wife of wives.data) {
    const key = `${wife.maidenName || ''}|${wife.husbandId || ''}|${wife.generation || ''}`;
    if (seen.has(key)) {
      toDelete.push(wife._id);
    } else {
      seen.set(key, wife._id);
    }
  }
  
  let deleted = 0;
  for (const id of toDelete) {
    await db.collection('wives').doc(id).remove();
    deleted++;
  }
  
  return { success: true, message: `删除 ${deleted} 条重复记录，保留 ${seen.size} 条` };
}

// 女婿去重（name + wifeId 都相同才算重复）
async function dedupeSonsInLaw() {
  const sons = await db.collection('sons_in_law').get();
  const seen = new Map();
  const toDelete = [];
  
  for (const son of sons.data) {
    const key = `${son.name || ''}|${son.wifeId || ''}`;
    if (seen.has(key)) {
      toDelete.push(son._id);
    } else {
      seen.set(key, son._id);
    }
  }
  
  let deleted = 0;
  for (const id of toDelete) {
    await db.collection('sons_in_law').doc(id).remove();
    deleted++;
  }
  
  return { success: true, message: `删除 ${deleted} 条重复记录，保留 ${seen.size} 条` };
}

// 调试查询成员
async function debugMember(params) {
  const { name } = params;
  
  if (!name) {
    return { success: false, message: '请提供 name 参数' };
  }
  
  // 先精确匹配
  let { data } = await db.collection('members')
    .where({ name })
    .limit(5)
    .get();
  
  // 如果没找到，尝试模糊匹配
  if (data.length === 0) {
    const reg = new RegExp(name);
    const { data: allMembers } = await db.collection('members')
      .limit(100)
      .get();
    data = allMembers.filter(m => m.name && m.name.includes(name));
  }
  
  if (data.length === 0) {
    return { success: false, message: `未找到姓名为"${name}"的族人` };
  }
  
  const member = data[0];
  return {
    success: true,
    data: {
      name: member.name,
      originalId: member.originalId,
      generation: member.generation,
      education: member.education,
      positions: member.positions,
      allFields: Object.keys(member),
      matchCount: data.length
    }
  };
}

// 初始化荣誉榜数据
async function initHonorData(params) {
  const { actionType } = params;
  
  // 确保集合存在
  const collections = ['patriarchs', 'sages', 'elite', 'graduates'];
  for (const col of collections) {
    try {
      await db.createCollection(col);
      console.log('创建集合:', col);
    } catch (e) {
      // 集合可能已存在，忽略错误
    }
  }
  
  if (actionType === 'init') {
    // 初始化族长数据
    const patriarchsData = [
      { name: '公瑾', title: '一世基祖', generation: 1, branch: '中和堂', branchTitle: '初代基祖', originRegion: '未知', achievements: '罗氏迁高洲始祖', sortOrder: 1 },
      { name: '浩然', title: '十一世', generation: 11, branch: '中和堂', branchTitle: '安福基祖', originRegion: '安福', achievements: '安福分支始祖', sortOrder: 2 },
      { name: '原', title: '十四世', generation: 14, branch: '忠爱堂', branchTitle: '鹧湖基祖', originRegion: '鹧湖', achievements: '鹧湖分支始祖', sortOrder: 3 },
      { name: '筮元', title: '十六世', generation: 16, branch: '德裕堂', branchTitle: '高洲基祖', originRegion: '高洲', achievements: '高洲分支始祖', sortOrder: 4 },
      { name: '英', title: '十八世', generation: 18, branch: '明儒堂', branchTitle: '明儒堂基祖', originRegion: '高洲', achievements: '明儒堂始祖', sortOrder: 5 },
      { name: '华', title: '十八世', generation: 18, branch: '德裕堂', branchTitle: '德裕堂基祖', originRegion: '高洲', achievements: '德裕堂始祖', sortOrder: 6 },
      { name: '芬', title: '十八世', generation: 18, branch: '忠爱堂', branchTitle: '忠爱堂基祖', originRegion: '高洲', achievements: '忠爱堂始祖', sortOrder: 7 }
    ];
    
    let added = 0;
    for (const patriarch of patriarchsData) {
      const exist = await db.collection('patriarchs').where({ name: patriarch.name, generation: patriarch.generation }).count();
      if (exist.total === 0) {
        await db.collection('patriarchs').add({
          data: { ...patriarch, createdAt: db.serverDate(), updatedAt: db.serverDate() }
        });
        added++;
      }
    }
    
    return { success: true, message: '族长数据初始化完成', data: { added } };
  }
  
  if (actionType === 'syncFromMembers') {
    // 直接查询有 education 或 positions 字段的记录
    const debug = {
      total: 0,
      withEducation: 0,
      withPositions: 0,
      sampleEducation: [],
      samplePositions: []
    };
    
    // 查询所有记录 - 使用分页获取全部数据
    const allMembers = [];
    const pageSize = 500;
    let hasMore = true;
    let skip = 0;
    
    while (hasMore) {
      const result = await db.collection('members')
        .field({ _id: true, name: true, originalId: true, generation: true, birthDate: true, positions: true, education: true, isAlive: true })
        .skip(skip)
        .limit(pageSize)
        .get();
      
      allMembers.push(...result.data);
      skip += pageSize;
      hasMore = result.data.length === pageSize;
      
      if (allMembers.length >= 1500) break; // 限制处理数量
    }
    
    const members = { data: allMembers };
    
    debug.total = members.data.length;
    
    let synced = { elite: 0, graduates: 0, sages: 0 };
    
    // 统计有数据的记录
    for (const member of members.data) {
      if (member.education && member.education.length > 0) {
        debug.withEducation++;
        if (debug.sampleEducation.length < 2) {
          debug.sampleEducation.push({ name: member.name, education: member.education });
        }
      }
      if (member.positions && member.positions.length > 0) {
        debug.withPositions++;
        if (debug.samplePositions.length < 3) {
          debug.samplePositions.push({ name: member.name, positions: member.positions });
        }
      }
      
      // 处理学历 -> graduates
      // education 可能是字符串数组如 ["大学", "永新师范"] 或对象数组 [{degree, school}]
      if (member.education && Array.isArray(member.education) && member.education.length > 0) {
        for (const edu of member.education) {
          // edu 可能是字符串如 "大学" 或对象 { degree, school, ... }
          const degree = typeof edu === 'string' ? edu : (edu.degree || '');
          const school = typeof edu === 'string' ? '' : (edu.school || '');
          
          // 判断是否本科及以上
          const highDegrees = ['本科', '学士', '硕士', '博士', '博士后', '博学鸿儒', '大学'];
          if (highDegrees.some(d => degree.includes(d))) {
            const exist = await db.collection('graduates').where({ memberId: String(member.originalId), name: member.name }).count();
            if (exist.total === 0) {
              await db.collection('graduates').add({
                data: {
                  name: member.name,
                  generation: member.generation,
                  memberId: String(member.originalId),
                  degree: degree,
                  school: school,
                  major: '',
                  graduationYear: null,
                  createdAt: db.serverDate(),
                  updatedAt: db.serverDate()
                }
              });
              synced.graduates++;
            }
          }
        }
      }
      
      // 处理职位 -> sages（历史乡贤）
      // 建国后群英榜已改为「当今族人撷英」固定七人，不再从 positions 同步到 elite
      if (member.positions && Array.isArray(member.positions) && member.positions.length > 0) {
        const birthYear = member.birthDate?.gregorian?.year || null;
        const deathYear = member.deathDate?.gregorian?.year || null;
        const isPost1949 = (birthYear && birthYear >= 1949) ||
                          (deathYear && deathYear >= 1949) ||
                          (member.isAlive === true && birthYear && birthYear >= 1949);
        const isHistorical = member.generation && member.generation <= 25 && (!birthYear || birthYear < 1949);

        // 1949 年后公职人物跳过（群英榜独立维护）
        if (isPost1949 && !isHistorical) {
          continue;
        }

        for (const pos of member.positions) {
          const title = typeof pos === 'string' ? pos : (pos.title || '');
          const organization = typeof pos === 'string' ? '' : (pos.organization || '');

          if (title) {
            const exist = await db.collection('sages').where({ memberId: String(member.originalId), position: title }).count();
            if (exist.total === 0) {
              await db.collection('sages').add({
                data: {
                  name: member.name,
                  generation: member.generation,
                  memberId: String(member.originalId),
                  achievementType: '公职',
                  position: title,
                  organization: organization,
                  level: '',
                  birthYear: birthYear,
                  isAlive: member.isAlive !== false,
                  createdAt: db.serverDate(),
                  updatedAt: db.serverDate()
                }
              });
              synced.sages++;
            }
          }
        }
      }
    }
    
    return { success: true, message: '同步完成', data: { ...synced, debug } };
  }
  
  return { success: false, message: '未知操作' };
}

/**
 * 根据备注重建成员配偶字段，并重建 wives 表
 * params.clearWives=true 时先清空 wives
 */
async function repairSpouseFromRemark(params = {}) {
  const clearWives = params.clearWives !== false;
  const stats = {
    membersScanned: 0,
    spouseUpdated: 0,
    motherFixed: 0,
    villageLinked: 0,
    wivesWritten: 0,
    wivesRemoved: 0
  };

  // 拉取全部成员到内存
  const allMembers = [];
  let skip = 0;
  const pageSize = 100;
  while (true) {
    const { data } = await db.collection('members')
      .field({
        _id: true,
        name: true,
        gender: true,
        originalId: true,
        generation: true,
        remark: true,
        fatherId: true,
        motherId: true,
        motherName: true,
        spouseId: true,
        spouseName: true,
        spouseInfo: true
      })
      .skip(skip)
      .limit(pageSize)
      .get();
    if (!data.length) break;
    allMembers.push(...data);
    skip += pageSize;
    if (data.length < pageSize) break;
  }

  stats.membersScanned = allMembers.length;
  const byOriginalId = new Map();
  allMembers.forEach(m => byOriginalId.set(String(m.originalId), m));

  // 1) 备注解析配偶
  for (const member of allMembers) {
    const spouses = parseSpousesFromRemark(member.remark || '');
    if (spouses.length) {
      member.spouseName = spouses[0].name;
      member.spouseInfo = spousesToSpouseInfo(spouses);
      stats.spouseUpdated++;
    } else if (member.spouseName) {
      member.spouseName = normalizeSpouseName(member.spouseName);
    }
  }

  // 2) 本村双向匹配
  const links = linkSameVillageSpouses(allMembers);
  stats.villageLinked = links.length;

  // 3) 母亲修正
  for (const member of allMembers) {
    const fatherId = member.fatherId != null ? String(member.fatherId) : '';
    const motherId = member.motherId != null ? String(member.motherId) : '';
    if (fatherId && motherId && fatherId === motherId) {
      member.motherId = '';
      stats.motherFixed++;
    }
    if (fatherId) {
      const father = byOriginalId.get(fatherId);
      if (father) {
        const fatherSpouses = parseSpousesFromRemark(father.remark || '');
        const resolved = fatherSpouses.length
          ? fatherSpouses[0].name
          : normalizeSpouseName(father.spouseName || '');
        if (resolved && resolved !== member.motherName) {
          member.motherName = resolved;
          stats.motherFixed++;
        }
      }
    }
  }

  // 4) 写回 members
  for (const member of allMembers) {
    await db.collection('members').doc(member._id).update({
      data: {
        spouseId: member.spouseId || '',
        spouseName: member.spouseName || '',
        spouseInfo: member.spouseInfo || [],
        motherId: member.motherId || '',
        motherName: member.motherName || '',
        updatedAt: db.serverDate()
      }
    });
  }

  // 5) 重建 wives
  if (clearWives) {
    while (true) {
      const { data } = await db.collection('wives').limit(100).field({ _id: true }).get();
      if (!data.length) break;
      await Promise.all(data.map(item => db.collection('wives').doc(item._id).remove()));
      stats.wivesRemoved += data.length;
    }
  }

  for (const member of allMembers) {
    if (member.gender === '女') continue;
    const spouses = parseSpousesFromRemark(member.remark || '');
    const list = spouses.length
      ? spouses
      : (member.spouseName
        ? [{
          name: member.spouseName,
          maidenName: member.spouseName,
          hometown: member.spouseId ? '本村' : '',
          marriageType: '配',
          sourceText: member.spouseName,
          isSameVillage: !!member.spouseId
        }]
        : []);

    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      let name = s.name;
      let linkedMemberId = '';
      if (s.isSameVillage && member.spouseId) {
        name = member.spouseName || name;
        linkedMemberId = String(member.spouseId);
      }
      await db.collection('wives').add({
        data: {
          name,
          maidenName: s.maidenName || name,
          hometown: s.hometown || (linkedMemberId ? '本村' : ''),
          generation: member.generation,
          husbandId: String(member.originalId),
          husbandName: member.name,
          marriageType: s.marriageType || '配',
          marriageOrder: i + 1,
          marriageStatus: 'married',
          linkedMemberId,
          burialPlace: '',
          remark: (member.remark || '').slice(0, 200),
          sourceMemberId: member._id,
          sourceText: s.sourceText || name,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      });
      stats.wivesWritten++;
    }
  }

  return {
    success: true,
    message: '配偶/母亲数据已按备注修正（含本村双向匹配）',
    data: { ...stats, links: links.slice(0, 20) }
  };
}

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

// ==================== 运营：登录账号 / 开发者留言 ====================

function maskPhoneAdmin(phone) {
  const p = String(phone || "");
  if (p.length < 7) return p;
  return p.slice(0, 3) + "****" + p.slice(-4);
}

function formatTime(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (value.$date) return value.$date;
  try {
    return new Date(value).toISOString();
  } catch (e) {
    return String(value);
  }
}

async function listAccounts(params) {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
  const keyword = String(params.keyword || "").trim();

  let query = db.collection("user_accounts");
  if (keyword) {
    // 云开发单字段模糊：优先精确匹配姓名；也可用 phone
    query = query.where({
      name: db.RegExp({ regexp: keyword, options: "i" })
    });
  }

  const countResult = await query.count();
  const total = countResult.total;

  let data = [];
  try {
    const res = await query
      .orderBy("createTime", "desc")
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    data = res.data || [];
  } catch (e) {
    // 无索引时降级
    const res = await query.skip((page - 1) * pageSize).limit(pageSize).get();
    data = res.data || [];
  }

  const list = data.map((row) => ({
    _id: row._id,
    name: row.name || "",
    phoneMasked: maskPhoneAdmin(row.phone),
    personId: row.personId || "",
    originalId: row.originalId != null ? row.originalId : null,
    verifyStatus: row.verifyStatus || "",
    wechatId: row.wechatId || "",
    createTime: formatTime(row.createTime),
    updateTime: formatTime(row.updateTime)
  }));

  return { success: true, data: list, total, page, pageSize };
}

async function listDevMessages(params) {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));
  const status = String(params.status || "").trim();

  let query = db.collection("dev_messages");
  if (status) {
    query = query.where({ status });
  }

  const countResult = await query.count();
  const total = countResult.total;

  let data = [];
  try {
    const res = await query
      .orderBy("createTime", "desc")
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    data = res.data || [];
  } catch (e) {
    const res = await query.skip((page - 1) * pageSize).limit(pageSize).get();
    data = res.data || [];
  }

  const list = (data || []).map((row) => ({
    _id: row._id,
    name: row.name || "",
    phone: row.phone || "",
    wechat: row.wechat || "",
    content: row.content || "",
    personId: row.personId || "",
    accountName: row.accountName || "",
    status: row.status || "pending",
    createTime: formatTime(row.createTime)
  }));

  return { success: true, data: list, total, page, pageSize };
}

async function markDevMessageRead(data) {
  const id = data && data._id;
  if (!id) return { success: false, message: "缺少留言ID" };
  await db.collection("dev_messages").doc(id).update({
    data: {
      status: "read",
      readTime: db.serverDate()
    }
  });
  return { success: true, message: "已标记为已读" };
}

async function getOpsStats() {
  const accounts = await db.collection("user_accounts").count();
  const messages = await db.collection("dev_messages").count();
  let pending = 0;
  try {
    const pendingRes = await db.collection("dev_messages").where({ status: "pending" }).count();
    pending = pendingRes.total;
  } catch (e) {
    pending = 0;
  }
  return {
    success: true,
    data: {
      accountTotal: accounts.total,
      messageTotal: messages.total,
      messagePending: pending
    }
  };
}
