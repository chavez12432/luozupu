/**
 * 高洲罗氏家谱 · 品牌视觉主题
 * 源文件：logo.jpg（朱砂印 · 古铜金边 · 宣纸底）
 */
const theme = {
  brandName: '江西安福高洲罗氏家谱',
  brandShort: '高洲罗氏',
  slogan: '数字家谱 · 血脉传承',
  motto: '一脉相承 · 千年家风',
  logoPath: '/images/logo.jpg',

  // 色彩：自 Logo 提取
  colors: {
    cinnabar: '#C41E1E',      // 宗族朱砂红（主色）
    cinnabarDeep: '#9B1515',  // 深红（按下/强调）
    bronze: '#C19A4B',        // 古铜金（辅助）
    bronzeSoft: '#D4B56A',    // 浅金
    paper: '#F7E8D0',         // 宣纸米白（页面底）
    paperCard: '#FFF9F0',     // 卡片底
    paperDeep: '#E8D4B5',     // 宣纸深
    ink: '#2C2416',           // 墨黑（正文）
    inkSoft: '#5C4E3A',       // 次级文字
    inkMute: '#8A7A64',       // 弱化文字
    sealWhite: '#FFFFFF',
    border: 'rgba(193, 154, 75, 0.45)',
    shadow: 'rgba(44, 36, 22, 0.12)'
  },

  radius: {
    sm: '8rpx',
    md: '16rpx',
    lg: '24rpx',
    pill: '999rpx'
  }
};

module.exports = theme;
