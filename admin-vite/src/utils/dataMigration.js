/**
 * 数据迁移工具
 * 将旧表数据转换为微信云开发数据库格式
 */

import { convertAllPersons } from './dataConverter.js';

/**
 * 转换数据为云开发格式
 * @param {Object} personsData - 原始persons表数据
 * @returns {Object} 转换后的数据和统计信息
 */
export function convertToCloudFormat(personsData) {
  console.log('开始转换数据为云开发格式...');
  
  // 使用现有的转换函数
  const result = convertAllPersons(personsData);
  
  if (!result.success && result.data.length === 0) {
    return {
      success: false,
      message: '数据转换失败',
      errors: result.errors
    };
  }
  
  // 清理数据，移除云开发不需要的字段
  const cloudData = result.data.map(member => {
    // 移除内部使用的字段
    const { 
      _relationshipErrors, 
      originalId,
      ...cleanMember 
    } = member;
    
    // 添加云开发需要的字段
    return {
      ...cleanMember,
      // 保留originalId作为参考
      originalId: originalId || null,
      // 确保日期格式正确
      birthDate: formatDateForCloud(member.birthDate),
      deathDate: formatDateForCloud(member.deathDate),
      // 云开发会自动添加 _id, _openid, 创建时间等
    };
  });
  
  return {
    success: true,
    total: result.total,
    converted: cloudData.length,
    warnings: result.warnings,
    errors: result.errors,
    data: cloudData,
    // 生成统计报告
    stats: generateMigrationStats(result.data)
  };
}

/**
 * 格式化日期对象为云开发格式
 */
function formatDateForCloud(dateObj) {
  if (!dateObj || !dateObj.converted) {
    return {
      lunar: { year: null, month: null, day: null, isLeap: false },
      gregorian: { year: null, month: null, day: null },
      ganzhi: '',
      zodiac: '',
      dynasty: '',
      eraName: '',
      eraYear: null,
      converted: false
    };
  }
  
  return dateObj;
}

/**
 * 生成迁移统计报告
 */
function generateMigrationStats(members) {
  const stats = {
    total: members.length,
    byGeneration: {},
    byBranch: {},
    byGender: { '男': 0, '女': 0 },
    withFather: 0,
    withMother: 0,
    withSpouse: 0,
    withLifespan: 0,
    withPhoto: 0,
    withBiography: 0,
    relationshipErrors: 0
  };
  
  for (const member of members) {
    // 按世代统计
    const gen = member.generation || '未知';
    stats.byGeneration[gen] = (stats.byGeneration[gen] || 0) + 1;
    
    // 按分堂统计
    const branch = member.branch || '未知';
    stats.byBranch[branch] = (stats.byBranch[branch] || 0) + 1;
    
    // 按性别统计
    if (member.gender) {
      stats.byGender[member.gender] = (stats.byGender[member.gender] || 0) + 1;
    }
    
    // 有父亲的
    if (member.fatherId) stats.withFather++;
    
    // 有母亲的
    if (member.motherId) stats.withMother++;
    
    // 有配偶的
    if (member.spouseId) stats.withSpouse++;
    
    // 有寿命的
    if (member.lifespan) stats.withLifespan++;
    
    // 有照片的
    if (member.avatar || (member.photoGallery && member.photoGallery.length > 0)) {
      stats.withPhoto++;
    }
    
    // 有传记的
    if (member.remark || (member.biography && member.biography.length > 0)) {
      stats.withBiography++;
    }
    
    // 关系错误
    if (member._relationshipErrors && member._relationshipErrors.length > 0) {
      stats.relationshipErrors++;
    }
  }
  
  return stats;
}

/**
 * 导出为云开发数据库导入格式
 * @param {Array} data - 转换后的数据
 * @returns {string} JSON字符串
 */
export function exportForCloudImport(data) {
  // 云开发数据库导入格式
  const cloudImportFormat = {
    collection: 'members',
    data: data.map(item => ({
      ...item,
      // 云开发会自动处理这些字段
      // _id: 自动生成
      // _openid: 根据调用者自动设置
    }))
  };
  
  return JSON.stringify(cloudImportFormat, null, 2);
}

/**
 * 导出为JSON Lines格式（用于云开发控制台导入）
 * @param {Array} data - 转换后的数据
 * @returns {string} JSON Lines格式字符串
 */
export function exportAsJSONLines(data) {
  // 每行一个JSON对象，用于云开发控制台批量导入
  return data.map(item => JSON.stringify(item)).join('\n');
}

/**
 * 分批导出数据（避免单次导入过多）
 * @param {Array} data - 转换后的数据
 * @param {number} batchSize - 每批数量，默认500
 * @returns {Array} 分批后的数据数组
 */
export function exportInBatches(data, batchSize = 500) {
  const batches = [];
  for (let i = 0; i < data.length; i += batchSize) {
    batches.push(data.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * 生成数据验证报告
 */
export function generateValidationReport(result) {
  const report = {
    summary: {
      totalRecords: result.total,
      successConverted: result.converted,
      failed: result.errors?.length || 0,
      warnings: result.warnings?.length || 0
    },
    generationDistribution: result.stats?.byGeneration || {},
    branchDistribution: result.stats?.byBranch || {},
    dataCompleteness: {
      withFather: result.stats?.withFather || 0,
      withMother: result.stats?.withMother || 0,
      withSpouse: result.stats?.withSpouse || 0,
      withLifespan: result.stats?.withLifespan || 0,
      withPhoto: result.stats?.withPhoto || 0,
      withBiography: result.stats?.withBiography || 0
    },
    relationshipIssues: result.warnings || []
  };
  
  return report;
}

/**
 * 下载迁移报告
 */
export function downloadMigrationReport(report, filename = 'migration-report.json') {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 下载云开发导入文件
 */
export function downloadCloudImportFile(data, filename = 'cloud-import-data.json') {
  const jsonLines = exportAsJSONLines(data);
  const blob = new Blob([jsonLines], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default {
  convertToCloudFormat,
  exportForCloudImport,
  exportAsJSONLines,
  exportInBatches,
  generateValidationReport,
  downloadMigrationReport,
  downloadCloudImportFile
};
