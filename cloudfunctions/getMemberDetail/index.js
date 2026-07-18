// 云函数入口文件
const cloud = require('wx-server-sdk');
const {
  normalizeSpouseName,
  mergeWivesWithRemark,
  parseSpousesFromRemark,
  buildSpousesFromMember
} = require('./spouseUtils');
const { applyDetailDisplay, formatEducationList } = require('./memberEra');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 隐私设置常量：默认全公开，测试阶段不限制
// TODO: 32代后可以自己选择部分非公开
const PUBLIC_GENERATION_THRESHOLD = 999;

// 格式化职位数组为字符串
function formatPositions(positions) {
  if (!positions || !Array.isArray(positions) || positions.length === 0) {
    return '';
  }
  return positions.map(p => {
    if (typeof p === 'string') return p;
    if (typeof p === 'object') {
      return p.title || p.name || '';
    }
    return '';
  }).filter(Boolean).join('、');
}

async function resolveFatherRecord(fatherMemberId) {
  if (!fatherMemberId) return null;
  const { data: fathers } = await db.collection('members')
    .where({ originalId: Number(fatherMemberId) || fatherMemberId })
    .limit(1)
    .get();
  return fathers && fathers[0] ? fathers[0] : null;
}

async function resolveMotherDisplay(member, fatherMemberId, motherMemberId) {
  // motherId 误写成 fatherId 时忽略
  const badMotherId = motherMemberId && fatherMemberId
    && String(motherMemberId) === String(fatherMemberId);

  if (motherMemberId && !badMotherId) {
    try {
      const { data: mothers } = await db.collection('members')
        .where({ originalId: Number(motherMemberId) || motherMemberId })
        .limit(1)
        .get();
      if (mothers && mothers[0] && mothers[0].name !== member.fatherName) {
        return {
          _id: mothers[0]._id,
          name: mothers[0].name,
          wifeId: ''
        };
      }
    } catch (e) {
      console.log('查询母亲成员失败', e);
    }
  }

  let motherName = '';
  let motherWifeId = '';
  const father = await resolveFatherRecord(fatherMemberId);
  if (father) {
    const fatherSpouses = parseSpousesFromRemark(father.remark || '');
    if (fatherSpouses.length) {
      motherName = fatherSpouses[0].name;
    } else if (father.spouseName) {
      motherName = normalizeSpouseName(father.spouseName);
    } else if (father.spouseInfo && father.spouseInfo[0]) {
      const first = father.spouseInfo[0];
      motherName = normalizeSpouseName(typeof first === 'string' ? first : first.name);
    }

    // 尝试关联父亲 wives 记录，便于跳转媳妇详情
    if (motherName && father.originalId != null) {
      try {
        const { data: wives } = await db.collection('wives')
          .where({ husbandId: String(father.originalId) })
          .get();
        const hit = (wives || []).find(w => normalizeSpouseName(w.name) === motherName);
        if (hit) motherWifeId = hit._id;
      } catch (e) {
        console.log('查询母亲 wives 失败', e);
      }
    }
  }

  if (!motherName) {
    motherName = normalizeSpouseName(member.motherName || '');
    if (motherName && father && motherName === father.name) motherName = '';
  }

  return { _id: '', name: motherName, wifeId: motherWifeId };
}

// 检查世代是否公开
function isGenerationPublic(generation) {
  return generation && generation <= PUBLIC_GENERATION_THRESHOLD;
}

// 云函数入口函数
exports.main = async (event, context) => {
  const { id } = event;
  
  try {
    // 查询成员详情
    const { data: member } = await db.collection('members')
      .doc(id)
      .get();
    
    if (!member) {
      return {
        success: false,
        message: '成员不存在'
      };
    }
    
    // 判断是否公开所有信息
    const isPublic = isGenerationPublic(member.generation) || member.isPublic;
    
    // 保存原始的 fatherId（是 memberId）
    const fatherMemberId = member.fatherId;
    const motherMemberId = member.motherId;
    const spouseMemberId = member.spouseId;
    
    // 初始化亲属数据
    let fatherInfo = { _id: '', name: '' };
    let motherInfo = { _id: '', name: '' };
    let spouseInfo = { _id: '', name: '' };
    
    // 查询父亲信息（使用 originalId 查询）
    if (isPublic && fatherMemberId) {
      try {
        const { data: father } = await db.collection('members')
          .where({
            originalId: Number(fatherMemberId) || fatherMemberId
          })
          .get();
        if (father && father.length > 0) {
          fatherInfo = { _id: father[0]._id, name: father[0].name };
        } else {
          // 如果找不到，用 fatherName
          fatherInfo = { _id: '', name: member.fatherName || '' };
        }
      } catch (e) {
        console.log('查询父亲失败', e);
        fatherInfo = { _id: '', name: member.fatherName || '' };
      }
    }
    
    // 查询母亲信息（修正 motherId=fatherId；优先按父亲备注解析首任配偶）
    if (isPublic) {
      try {
        const motherResolved = await resolveMotherDisplay(member, fatherMemberId, motherMemberId);
        motherInfo = {
          _id: motherResolved._id || '',
          name: motherResolved.name || '',
          wifeId: motherResolved.wifeId || ''
        };
      } catch (e) {
        console.log('查询母亲失败', e);
        motherInfo = { _id: '', name: normalizeSpouseName(member.motherName || ''), wifeId: '' };
      }
    }

    // 查询配偶信息（以备注解析为准，合并 wives 表 _id）
    member.wives = [];
    member.husbands = [];

    if (isPublic) {
      let dbWives = [];
      try {
        const memberOriginalId = member.originalId || (member.memberId ? member.memberId.replace(/^M0+/, '') : '');

        if (memberOriginalId) {
          const { data: wives } = await db.collection('wives')
            .where({ husbandId: String(memberOriginalId) })
            .orderBy('marriageOrder', 'asc')
            .get();

          dbWives = (wives || []).map(wife => ({
            _id: wife._id,
            name: wife.name,
            maidenName: wife.maidenName,
            hometown: wife.hometown || '',
            marriageType: wife.marriageType,
            marriageOrder: wife.marriageOrder,
            burialPlace: wife.burialPlace,
            remark: wife.remark,
            birthDate: wife.birthDate,
            deathDate: wife.deathDate
          }));
        }
      } catch (e) {
        console.log('查询 wives 表失败', e);
      }

      member.wives = mergeWivesWithRemark(dbWives, member);

      // spouseId 指向族内成员（本村配偶，存 originalId）
      if (spouseMemberId && String(spouseMemberId) !== String(fatherMemberId)) {
        try {
          const { data: spouses } = await db.collection('members')
            .where({
              originalId: Number(spouseMemberId) || spouseMemberId
            })
            .limit(1)
            .get();
          if (spouses && spouses[0]) {
            const spouse = spouses[0];
            member.spouseName = spouse.name;
            member.spouseMemberDocId = spouse._id;
            const clanEntry = {
              name: spouse.name,
              memberDocId: spouse._id,
              isClanSpouse: true,
              hometown: '本村',
              marriageType: '配',
              marriageOrder: 1
            };
            if (member.gender === '女' || spouse.gender === '男') {
              const exists = member.husbands.some(h => h.name === spouse.name || h.memberDocId === spouse._id);
              if (!exists) member.husbands.unshift(Object.assign({ _id: spouse._id }, clanEntry));
            } else {
              const idx = member.wives.findIndex(w =>
                w.name === spouse.name ||
                normalizeSpouseName(w.name) === spouse.name ||
                (w.hometown && String(w.hometown).includes('本村'))
              );
              if (idx >= 0) {
                member.wives[idx] = Object.assign({}, member.wives[idx], clanEntry);
              } else {
                member.wives.unshift(clanEntry);
              }
            }
          }
        } catch (e) {
          console.log('查询本村配偶失败', e);
        }
      }

      // 同步展示用 spouseName / spouseInfo
      if (member.wives.length && member.gender !== '女') {
        if (!member.spouseName) member.spouseName = member.wives[0].name;
        member.spouseInfo = member.wives.map(w => ({
          name: w.name,
          type: w.marriageType,
          hometown: w.hometown || '',
          memberOriginalId: w.memberDocId || ''
        }));
      } else if (!member.wives.length && member.gender !== '女') {
        const fallback = buildSpousesFromMember(member);
        member.wives = fallback;
        if (fallback.length && !member.spouseName) {
          member.spouseName = fallback[0].name;
        }
      }
    }
    
    // 查询子女信息（通过 fatherId 或 motherId 匹配 originalId）
    member.children = [];
    if (isPublic) {
      try {
        // 获取当前成员的 originalId（用于匹配 fatherId/motherId）
        const memberOriginalId = member.originalId || (member.memberId ? member.memberId.replace(/^M0+/, '') : '');
        
        // 查找以该成员的 originalId 为 fatherId 的记录
        const { data: childrenAsFather } = await db.collection('members')
          .where({
            fatherId: String(memberOriginalId)
          })
          .get();
        
        // 查找以该成员的 originalId 为 motherId 的记录
        const { data: childrenAsMother } = await db.collection('members')
          .where({
            motherId: String(memberOriginalId)
          })
          .get();
        
        // 合并子女列表
        const allChildren = [...(childrenAsFather || []), ...(childrenAsMother || [])];
        
        // 去重（避免同时是父母的情况）
        const seenIds = new Set();
        member.children = allChildren.filter(child => {
          if (seenIds.has(child._id)) return false;
          seenIds.add(child._id);
          return true;
        }).map(child => {
          // 计算出生年份用于排序
          let birthYear = 9999;
          if (child.birthDate) {
            // 优先使用公历年份
            if (child.birthDate.gregorian && child.birthDate.gregorian.year) {
              birthYear = child.birthDate.gregorian.year;
            } else if (child.birthDate.lunar && child.birthDate.lunar.year) {
              // 农历年份减去1得到大概的公历年份
              birthYear = child.birthDate.lunar.year;
            }
          }
          return {
            _id: child._id,
            name: child.name,
            gender: child.gender,
            generation: child.generation,
            birthYear: birthYear
          };
        });
        
        // 按出生年份排序（年份小的在前 = 年龄大的在前）
        member.children.sort((a, b) => {
          // 无出生年份的排到最后
          if (a.birthYear === 9999 && b.birthYear === 9999) {
            return a.generation - b.generation;
          }
          if (a.birthYear === 9999) return 1;
          if (b.birthYear === 9999) return -1;
          return a.birthYear - b.birthYear;
        });
      } catch (e) {
        console.log('查询子女失败', e);
        member.children = [];
      }
    }
    
    // 更新成员数据（勿清空已解析的 spouseName）
    member.fatherId = fatherInfo._id;
    member.fatherName = fatherInfo._id ? (fatherInfo.name || '') : '';
    member.motherId = motherInfo._id || '';
    member.motherWifeId = motherInfo.wifeId || '';
    member.motherName = (member.motherWifeId || member.motherId)
      ? (motherInfo.name || '')
      : '';
    // 保留库中的 spouseId（族内 originalId）；展示用 spouseMemberDocId
    
    // 配偶/丈夫：仅保留可跳转记录（本村 memberDocId 或 wives 表 _id）
    member.wives = (member.wives || []).filter(w =>
      w && w.name && (w.memberDocId || w._id)
    );
    member.husbands = (member.husbands || []).filter(h =>
      h && h.name && (h.memberDocId || h._id)
    );
    if (!member.wives.length && !member.spouseMemberDocId) {
      member.spouseName = '';
      member.spouseInfo = [];
    }
    member.children = (member.children || []).filter(c => c && c._id);
    
    // 添加分堂代码
    const branchCodeMap = {
      '中和堂': 'zhonghe',
      '明儒堂': 'mingru',
      '德裕堂': 'deyu',
      '忠爱堂': 'zhongshou'
    };
    member.branchCode = branchCodeMap[member.branch] || 'zhonghe';
    
    // 古今差异化展示
    const detail = applyDetailDisplay(member);
    detail.positionsStr = formatPositions(detail.positions);
    detail.educationStr = (detail.educationList || formatEducationList(detail.education) || [])
      .map(e => (typeof e === 'string' ? e : e.display || e.degree))
      .filter(Boolean)
      .join('；');
    detail.honorsStr = (detail.honorsList || []).join('；');
    detail.workplacesStr = (detail.workplaceList || []).join('；');
    
    // 如果不是公开模式，清除敏感信息
    if (!isPublic) {
      delete detail.birthDate;
      delete detail.birthDateEra;
      delete detail.deathDate;
      delete detail.deathDateEra;
      delete detail.birthplace;
      delete detail.residence;
      delete detail.burialPlace;
      delete detail.phone;
      delete detail.education;
      delete detail.educationList;
      delete detail.educationStr;
      delete detail.positions;
      delete detail.positionsStr;
      delete detail.honors;
      delete detail.honorsList;
      delete detail.honorsStr;
      delete detail.workplaces;
      delete detail.workplaceList;
      delete detail.workplacesStr;
      delete detail.avatar;
      delete detail.photo;
      delete detail.photoGallery;
      delete detail.wives;
      delete detail.husbands;
      delete detail.children;
    }
    
    return {
      success: true,
      data: detail
    };
  } catch (err) {
    console.error('查询失败', err);
    return {
      success: false,
      message: err.message
    };
  }
};