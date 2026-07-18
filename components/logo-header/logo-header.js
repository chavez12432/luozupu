Component({
  properties: {
    title: { type: String, value: '江西安福高洲罗氏家谱' },
    subtitle: { type: String, value: '数字家谱 · 血脉传承' },
    showMotto: { type: Boolean, value: false },
    size: { type: String, value: 'md' } // sm | md | lg
  },
  data: {
    logoPath: '/images/logo.jpg'
  }
});
