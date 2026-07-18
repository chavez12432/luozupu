/**
 * 数据转换工具 - 将旧表数据转换为新表格式
 * 源表：persons (所有表0409.json)
 * 目标表：members (新格式)
 * 
 * 更新：加入ID管理和世代验证
 */

// 源表字段索引 (根据JSON中的columns顺序)
// id=0, family_id=1, name=2, gender=3, birth_date=4, death_date=5, birthplace=6, residence=7,
// occupation=8, education=9, biography=10, achievements=11, photo_url=12, branch_name=13,
// generation_number=14, created_by=15, created_at=16, updated_at=17, lifespan=18,
// father_id=19, mother_id=20, old=21, phone=22, is_bloodline=23

// 性别转换
function convertGender(gender) {
  if (!gender) return '男';
  const map = {
    'male': '男',
    'female': '女',
    '男': '男',
    '女': '女'
  };
  return map[gender.toLowerCase()] || '男';
}

// 分堂名称转换
function convertBranch(branchName) {
  if (!branchName) return '中和堂';
  const map = {
    '中和堂': '中和堂',
    '明儒堂': '明儒堂',
    '德裕堂': '德裕堂',
    '忠爱堂': '忠爱堂',
    '忠爱堂': '忠爱堂'  // 处理可能的错别字
  };
  return map[branchName] || branchName;
}

// 解析日期字符串
function parseDate(dateStr) {
  if (!dateStr || dateStr === 'null') return null;
  
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  
  let year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);
  
  return { year, month, day };
}

// 计算干支和生肖
function calculateGanzhi(year) {
  const tiangan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const dizhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const zodiacAnimals = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
  
  const ganIndex = (year - 4) % 10;
  const zhiIndex = (year - 4) % 12;
  
  return {
    ganzhi: tiangan[ganIndex] + dizhi[zhiIndex] + '年',
    zodiac: zodiacAnimals[zhiIndex]
  };
}

// 获取朝代信息
function getDynastyInfo(year) {
  if (year >= 1949) return { dynasty: '中华人民共和国', eraName: null, eraYear: year - 1949 + 1 };
  if (year >= 1912) return { dynasty: '民国', eraName: null, eraYear: year - 1912 + 1 };
  if (year >= 1644) return { dynasty: '清', eraName: null, eraYear: null };
  if (year >= 1368) return { dynasty: '明', eraName: null, eraYear: null };
  if (year >= 1271) return { dynasty: '元', eraName: null, eraYear: null };
  if (year >= 960) return { dynasty: '宋', eraName: null, eraYear: null };
  return { dynasty: '未知', eraName: null, eraYear: null };
}

// 简化的农历转公历
function lunarToGregorian(lunar) {
  return { ...lunar };
}

// 构建日期对象
function buildDateObject(dateStr, isLunar = true) {
  if (!dateStr) return null;
  
  const parsed = parseDate(dateStr);
  if (!parsed) return null;
  
  const { year, month, day } = parsed;
  const ganzhiInfo = calculateGanzhi(year);
  const dynastyInfo = getDynastyInfo(year);
  const gregorian = lunarToGregorian({ year, month, day });
  
  return {
    lunar: {
      year,
      month,
      day,
      isLeap: false,
      formatted: `${year}年${month}月${day}日`
    },
    gregorian: {
      ...gregorian,
      formatted: `${gregorian.year}年${gregorian.month}月${gregorian.day}日`
    },
    ganzhi: ganzhiInfo.ganzhi,
    zodiac: ganzhiInfo.zodiac,
    dynasty: dynastyInfo.dynasty,
    eraName: dynastyInfo.eraName,
    eraYear: dynastyInfo.eraYear,
    converted: true
  };
}

// 解析学历字符串
function parseEducation(eduStr) {
  if (!eduStr) return [];
  
  const education = [];
  const degreeKeywords = ['博士', '硕士', '本科', '大专', '中专', '高中', '初中', '小学', '进士', '举人', '秀才'];
  
  for (const degree of degreeKeywords) {
    if (eduStr.includes(degree)) {
      education.push({
        degree: degree,
        school: '',
        major: '',
        year: null,
        isDefault: education.length === 0
      });
    }
  }
  
  return education;
}

// 解析职位字符串
function parseOccupation(occStr) {
  if (!occStr) return [];
  
  const positions = [];
  const parts = occStr.split(/[;；\n]/);
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed) {
      positions.push({
        title: trimmed,
        organization: '',
        level: '',
        isCurrent: false,
        isDefault: positions.length === 0
      });
    }
  }
  
  return positions;
}

// 解析成就/荣誉字符串
function parseAchievements(achStr) {
  if (!achStr) return [];
  
  const honors = [];
  const honorKeywords = ['荣誉称号', '勋章', '军人', '烈士', '表彰'];
  
  for (const keyword of honorKeywords) {
    if (achStr.includes(keyword)) {
      honors.push({
        type: keyword,
        title: achStr.substring(0, 50),
        level: '',
        year: null,
        description: achStr
      });
      break;
    }
  }
  
  return honors;
}

/**
 * 验证并清理亲属关系
 * 规则：
 * 1. 父亲/母亲的世代必须是子女世代-1
 * 2. 如果世代不符，标记为错误
 */
function validateRelationship(personId, personGen, relativeId, relativeGen, relativeType, idToInfo) {
  if (!relativeId || !idToInfo[relativeId]) {
    return { valid: false, error: `${relativeType}ID不存在`, code: 'NOT_FOUND' };
  }
  
  const expectedGen = personGen - 1;
  if (relativeGen !== expectedGen) {
    return { 
      valid: false, 
      error: `${relativeType}世代错误：应为${expectedGen}代，实际是${relativeGen}代`,
      code: 'GENERATION_MISMATCH',
      expectedGen,
      actualGen: relativeGen
    };
  }
  
  return { valid: true };
}

/**
 * 主转换函数 - 增强版
 * @param {Array} personRow - 原始数据行
 * @param {Object} idToInfo - ID到信息的映射表
 * @param {Object} options - 转换选项
 */
export function convertPersonToMember(personRow, idToInfo = {}, options = {}) {
  if (!personRow || !Array.isArray(personRow)) {
    return { success: false, error: '无效的数据行', member: null };
  }
  
  // 直接通过索引获取字段值
  const getValue = (fieldName) => {
    const indexMap = {
      'id': 0,
      'family_id': 1,
      'name': 2,
      'gender': 3,
      'birth_date': 4,
      'death_date': 5,
      'birthplace': 6,
      'residence': 7,
      'occupation': 8,
      'education': 9,
      'biography': 10,
      'achievements': 11,
      'photo_url': 12,
      'branch_name': 13,
      'generation_number': 14,
      'created_by': 15,
      'created_at': 16,
      'updated_at': 17,
      'lifespan': 18,
      'father_id': 19,
      'mother_id': 20,
      'old': 21,
      'phone': 22,
      'is_bloodline': 23
    };
    return personRow[indexMap[fieldName]];
  };
  
  // 基本信息
  const originalId = getValue('id');
  const name = getValue('name');
  if (!name) return { success: false, error: '姓名为空', member: null };
  
  const generation = getValue('generation_number');
  const birthDateStr = getValue('birth_date');
  const deathDateStr = getValue('death_date');
  
  // 计算寿命
  let lifespan = null;
  if (birthDateStr && deathDateStr && deathDateStr !== 'null') {
    const birthYear = parseDate(birthDateStr)?.year;
    const deathYear = parseDate(deathDateStr)?.year;
    if (birthYear && deathYear) {
      lifespan = deathYear - birthYear;
    }
  }
  
  // 亲属关系验证
  const fatherId = getValue('father_id');
  const motherId = getValue('mother_id');
  const relationshipErrors = [];
  
  let validatedFatherId = '';
  let validatedFatherName = '';
  let validatedMotherId = '';
  let validatedMotherName = '';
  
  // 验证父亲关系
  if (fatherId && idToInfo[fatherId]) {
    const fatherInfo = idToInfo[fatherId];
    const validation = validateRelationship(
      originalId, generation, fatherId, fatherInfo.generation, '父亲', idToInfo
    );
    
    if (validation.valid) {
      validatedFatherId = String(fatherId);
      validatedFatherName = fatherInfo.name;
    } else {
      relationshipErrors.push({
        type: 'father',
        id: fatherId,
        name: fatherInfo.name,
        error: validation.error,
        code: validation.code
      });
    }
  }
  
  // 验证母亲关系
  if (motherId && idToInfo[motherId]) {
    const motherInfo = idToInfo[motherId];
    const validation = validateRelationship(
      originalId, generation, motherId, motherInfo.generation, '母亲', idToInfo
    );
    
    if (validation.valid) {
      validatedMotherId = String(motherId);
      validatedMotherName = motherInfo.name;
    } else {
      relationshipErrors.push({
        type: 'mother',
        id: motherId,
        name: motherInfo.name,
        error: validation.error,
        code: validation.code
      });
    }
  }
  
  // 构建转换后的对象
  const member = {
    // 使用原ID作为memberId
    memberId: `M${String(originalId).padStart(6, '0')}`,
    originalId: originalId,
    
    // 基本信息
    name: name,
    generation: generation || 1,
    branch: convertBranch(getValue('branch_name')),
    gender: convertGender(getValue('gender')),
    hasBrokenLineage: false,
    brokenLineageNote: relationshipErrors.length > 0 
      ? '亲属关系异常：' + relationshipErrors.map(e => `${e.type}(${e.error})`).join('; ')
      : '',
    
    // 出生日期
    birthDate: buildDateObject(birthDateStr) || {
      lunar: { year: null, month: null, day: null, isLeap: false },
      gregorian: { year: null, month: null, day: null, formatted: '' },
      dynasty: '',
      eraName: '',
      eraYear: null,
      ganzhi: '',
      zodiac: '',
      converted: false
    },
    
    // 寿命
    lifespan: lifespan,
    
    // 逝世日期
    deathDate: buildDateObject(deathDateStr) || {
      lunar: { year: null, month: null, day: null, isLeap: false },
      gregorian: { year: null, month: null, day: null, formatted: '' },
      dynasty: '',
      eraName: '',
      eraYear: null,
      ganzhi: '',
      zodiac: '',
      converted: false
    },
    
    // 亲属关系（使用ID）
    fatherId: validatedFatherId,
    fatherName: validatedFatherName,
    motherId: validatedMotherId,
    motherName: validatedMotherName,
    spouseId: '',
    spouseName: '',
    childrenIds: [],
    
    // 个人信息
    birthplace: getValue('birthplace') || '',
    residence: getValue('residence') || '',
    phone: getValue('phone') || '',
    
    // 学历
    education: parseEducation(getValue('education')),
    
    // 职位
    positions: parseOccupation(getValue('occupation')),
    
    // 荣誉
    honors: parseAchievements(getValue('achievements')),
    
    // 照片
    avatar: getValue('photo_url') || '',
    photoGallery: getValue('photo_url') ? [getValue('photo_url')] : [],
    
    // 备注（接收biography字段）
    remark: getValue('biography') || '',
    
    // 系统字段
    createdAt: new Date(),
    updatedAt: new Date(),
    
    // 关系错误记录
    _relationshipErrors: relationshipErrors
  };
  
  return {
    success: true,
    member: member,
    warnings: relationshipErrors.length > 0 ? relationshipErrors : null
  };
}

/**
 * 批量转换 - 增强版
 * @param {Object} personsData - 原始数据对象
 * @param {Object} options - 转换选项
 */
export function convertAllPersons(personsData, options = {}) {
  if (!personsData || !personsData.rows) {
    return { total: 0, success: 0, failed: 0, data: [], errors: [], warnings: [] };
  }
  
  // 建立ID到信息的映射表
  const idToInfo = {};
  for (let i = 0; i < personsData.rows.length; i++) {
    const row = personsData.rows[i];
    const rowId = row[0];
    idToInfo[rowId] = {
      generation: row[14],
      name: row[2],
      gender: row[3]
    };
  }
  
  const results = [];
  const errors = [];
  const warnings = [];
  
  for (let i = 0; i < personsData.rows.length; i++) {
    try {
      const result = convertPersonToMember(personsData.rows[i], idToInfo, options);
      
      if (result.success && result.member) {
        results.push(result.member);
        
        // 收集警告
        if (result.warnings && result.warnings.length > 0) {
          warnings.push({
            row: i,
            memberId: result.member.memberId,
            name: result.member.name,
            warnings: result.warnings
          });
        }
      } else {
        errors.push({
          row: i,
          error: result.error,
          data: personsData.rows[i]
        });
      }
    } catch (error) {
      errors.push({
        row: i,
        error: error.message,
        data: personsData.rows[i]
      });
    }
  }
  
  // 第二遍：建立子女关系列表
  const memberMap = {};
  for (const member of results) {
    memberMap[member.originalId] = member;
  }
  
  for (const member of results) {
    // 查找子女（反向关联）
    for (const other of results) {
      if (other.fatherId === String(member.originalId) || other.motherId === String(member.originalId)) {
        if (!member.childrenIds.includes(other.memberId)) {
          member.childrenIds.push(other.memberId);
        }
      }
    }
  }
  
  return {
    total: personsData.rows.length,
    success: results.length,
    failed: errors.length,
    warningCount: warnings.length,
    data: results,
    errors: errors,
    warnings: warnings,
    idToInfo: idToInfo
  };
}

/**
 * 生成字段映射对照表
 */
export function generateFieldMapping() {
  return [
    { source: 'id', target: 'memberId (原ID保留)', required: true, description: '唯一标识符' },
    { source: 'name', target: 'name', required: true, description: '姓名' },
    { source: 'generation_number', target: 'generation', required: true, description: '世代' },
    { source: 'branch_name', target: 'branch', required: false, description: '分堂' },
    { source: 'gender', target: 'gender', required: false, description: '性别' },
    { source: 'birth_date', target: 'birthDate', required: false, description: '出生日期（自动计算干支/生肖/朝代）' },
    { source: 'death_date', target: 'deathDate + isAlive', required: false, description: '逝世日期/是否在世' },
    { source: 'father_id', target: 'fatherId (验证世代)', required: false, description: '父亲ID（必须为世代-1）' },
    { source: 'mother_id', target: 'motherId (验证世代)', required: false, description: '母亲ID（必须为世代-1）' },
    { source: 'birthplace', target: 'birthplace', required: false, description: '出生地' },
    { source: 'residence', target: 'residence', required: false, description: '现居地' },
    { source: 'phone', target: 'phone', required: false, description: '联系电话' },
    { source: 'education', target: 'education', required: false, description: '学历' },
    { source: 'occupation', target: 'positions', required: false, description: '职位' },
    { source: 'achievements', target: 'honors', required: false, description: '荣誉' },
    { source: 'photo_url', target: 'avatar + photoGallery', required: false, description: '照片' },
    { source: 'biography', target: 'remark', required: false, description: '备注（原biography字段）' }
  ];
}

/**
 * 生成验证报告
 */
export function generateValidationReport(result) {
  const report = {
    summary: {
      total: result.total,
      success: result.success,
      failed: result.failed,
      warnings: result.warningCount
    },
    relationshipErrors: [],
    generationStats: {}
  };
  
  // 统计世代分布
  for (const member of result.data) {
    const gen = member.generation;
    if (!report.generationStats[gen]) {
      report.generationStats[gen] = { count: 0, withFather: 0, withMother: 0, errors: 0 };
    }
    report.generationStats[gen].count++;
    if (member.fatherId) report.generationStats[gen].withFather++;
    if (member.motherId) report.generationStats[gen].withMother++;
    if (member._relationshipErrors && member._relationshipErrors.length > 0) {
      report.generationStats[gen].errors++;
    }
  }
  
  // 收集关系错误
  for (const warning of result.warnings || []) {
    for (const w of warning.warnings) {
      report.relationshipErrors.push({
        person: warning.name,
        memberId: warning.memberId,
        type: w.type,
        relativeId: w.id,
        relativeName: w.name,
        error: w.error
      });
    }
  }
  
  return report;
}

export default {
  convertPersonToMember,
  convertAllPersons,
  generateFieldMapping,
  generateValidationReport
};
