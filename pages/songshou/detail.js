const { contents } = require('./data');

Page({
  data: {
    id: null,
    title: '',
    authorName: '',
    authorGeneration: '',
    dynasty: '',
    year: '',
    date: '',
    activeTab: 'original',
    content: null
  },

  onLoad(options) {
    const id = Number(options.id);
    const content = contents[String(id)];
    if (!content) {
      wx.showToast({ title: '内容暂未录入', icon: 'none' });
      return;
    }
    this.setData({
      id,
      title: content.title,
      authorName: content.authorName || '',
      authorGeneration: content.authorGeneration || '',
      dynasty: content.dynasty || '',
      year: content.year || '',
      date: content.date || content.year || '',
      content: {
        ...content,
        notesHtml: this.formatNotesToHtml(content.notes)
      }
    });
    wx.setNavigationBarTitle({ title: content.title });
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab });
  },

  formatNotesToHtml(notes) {
    if (!notes) return '<span style="color:#999;">暂无考评注释</span>';
    let html = notes
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    html = html.replace(/【([^】]+)】/g, '<strong style="color:#8B4513;font-size:28rpx;display:block;margin-bottom:16rpx;">【$1】</strong>');
    html = html.replace(/(\d+\.\s+[^：:]+[：:])/g, '<strong style="color:#333;display:block;margin-top:16rpx;margin-bottom:8rpx;">$1</strong>');
    html = html.replace(/\n/g, '<br/>');
    html = html.replace(/\s{2,}/g, '&nbsp;&nbsp;');
    return html;
  }
});
