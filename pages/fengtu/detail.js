const config = require('../../utils/config');
const localSeed = require('../../utils/fengtuSeed');

Page({
  data: {
    layout: 'plain',
    title: '',
    authorName: '',
    authorGeneration: '',
    dynasty: '',
    year: '',
    activeTab: 'original',
    content: null,
    body: '',
    images: [],
    scenes: [],
    sceneIndex: 0
  },

  async onLoad(options) {
    const id = decodeURIComponent(options.id || '');
    if (!id) {
      wx.showToast({ title: '缺少文章ID', icon: 'none' });
      return;
    }
    let doc = null;
    try {
      if (config.isLocalMode()) {
        doc = (localSeed.list || []).find(x => x._id === id || x.seedId === id);
      } else {
        const res = await wx.cloud.callFunction({
          name: 'adminApi',
          data: { action: 'getFengtu', data: { _id: id } }
        });
        if (res.result && res.result.success) doc = res.result.data;
      }
    } catch (e) {
      console.error(e);
    }
    if (!doc) {
      doc = (localSeed.list || []).find(x => x._id === id || x.seedId === id);
    }
    // 云库旧数据无 scenes 时，用本地八景种子补齐
    if (doc && doc.layout === 'poem' && !(doc.scenes && doc.scenes.length)) {
      const local = (localSeed.list || []).find(x => x.seedId === 'ft-bajing');
      if (local && local.scenes) {
        doc = Object.assign({}, doc, {
          scenes: local.scenes,
          images: local.images
        });
      }
    }
    if (!doc) {
      wx.showToast({ title: '文章不存在', icon: 'none' });
      return;
    }
    this.applyDoc(doc);
  },

  applyDoc(doc) {
    const layout = doc.layout || 'plain';
    const scenes = Array.isArray(doc.scenes) ? doc.scenes : [];
    const patch = {
      layout,
      title: doc.title || '',
      authorName: doc.authorName || '',
      authorGeneration: doc.authorGeneration || '',
      dynasty: doc.dynasty || '',
      year: doc.year || '',
      images: Array.isArray(doc.images) ? doc.images : scenes.map(s => s.image).filter(Boolean),
      scenes,
      sceneIndex: 0,
      body: doc.content || '',
      content: null
    };
    if (layout === 'classic') {
      patch.content = {
        original: doc.original || '',
        translation: doc.translation || '',
        notes: doc.notes || '',
        notesHtml: this.formatNotesToHtml(doc.notes || '')
      };
    }
    this.setData(patch);
    wx.setNavigationBarTitle({ title: doc.title || '风土志' });
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab });
  },

  onSceneChange(e) {
    this.setData({ sceneIndex: e.detail.current || 0 });
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    const urls = (this.data.scenes || []).map(s => s.image).filter(Boolean);
    if (!url) return;
    wx.previewImage({ current: url, urls: urls.length ? urls : [url] });
  },

  onImgError(e) {
    console.warn('八景配图加载失败', e);
  },

  formatNotesToHtml(notes) {
    if (!notes) return '<span style="color:#999;">暂无考评注释</span>';
    let html = notes
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    html = html.replace(/【([^】]+)】/g, '<strong style="color:#8B4513;font-size:28rpx;display:block;margin-bottom:16rpx;">【$1】</strong>');
    html = html.replace(/\n/g, '<br/>');
    return html;
  }
});
