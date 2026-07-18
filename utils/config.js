// 数据模式：'local' 本地调试 | 'cloud' 云开发
// 体验版 / 真机请用 'cloud'，并先部署云函数、导入数据库
const DATA_MODE = 'cloud';

/**
 * 云环境 ID（重要）
 * 在微信开发者工具 → 云开发 → 设置 / 概览 里复制完整环境 ID
 * 形如：cloud1-xxxxx ，不是显示名「cloud1」
 * 留空则尝试使用工具当前选中的默认环境（真机上容易失败）
 */
const CLOUD_ENV_ID = 'cloud1-d9ga9xh5p4ed2faf0';

module.exports = {
  DATA_MODE,
  CLOUD_ENV_ID,
  isLocalMode: () => DATA_MODE === 'local'
};
