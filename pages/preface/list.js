Page({
  data: {
    prefaces: [
      {
        id: 1,
        title: '高洲罗氏首修族谱序',
        authorName: '罗世举',
        authorGeneration: '第八代',
        dynasty: '南宋',
        year: '1174年',
        summary: '追溯罗姓出自颛顼，详述历代先祖官职，记载将军公瑾徙镇吉州，为东西塘罗氏之始。'
      },
      {
        id: 2,
        title: '高洲罗氏二次增修族谱序',
        authorName: '解缙',
        authorGeneration: '外族人',
        dynasty: '明朝',
        year: '1409年',
        summary: '引述杨万里《万卷书楼记》，梳理从东晋罗含到明初罗贯之的世系传承。'
      },
      {
        id: 3,
        title: '双池府君三次增修族谱序',
        authorName: '罗迪哲',
        authorGeneration: '第十六代',
        dynasty: '明朝',
        year: '1423年',
        summary: '改变族谱体例，杜绝贪冒之弊，详述怀远将军公瑾事迹及家族规制。'
      },
      {
        id: 4,
        title: '高洲罗氏四续修族谱序',
        authorName: '罗仁',
        authorGeneration: '第十七代',
        dynasty: '明朝',
        year: '1524年',
        summary: '距前次增修101年，改为五世一提之体例，补录安福县前一支，订正世系传承。'
      },
      {
        id: 5,
        title: '高洲罗氏五续修族谱序',
        authorName: '罗啟梅',
        authorGeneration: '第二十五代',
        dynasty: '清朝',
        year: '1702年',
        summary: '距四次续修178年，由堂叔罗孔义倡议，罗啟梅编辑草谱，强调重本笃亲。'
      },
      {
        id: 6,
        title: '高洲罗氏六续修族谱序',
        authorName: '罗允鉴等',
        authorGeneration: '第二十八/二十九代',
        dynasty: '清朝',
        year: '1811年',
        summary: '按高洲罗氏三房世系纂辑，历经46年曲折（因集资不齐、旱灾拖延），最终完成。'
      },
      {
        id: 7,
        title: '高洲罗氏七续修族谱序——新序',
        authorName: '罗庆良',
        authorGeneration: '第三十五代',
        dynasty: '公元',
        year: '2008年',
        summary: '本次续修族谱距六续修时隔198年，记录了罗姓来源、宗族迁徙历程及当代家族盛况。'
      },
      {
        id: 8,
        title: '高洲罗氏六续修族谱序（黄周万撰）',
        authorName: '黄周万',
        authorGeneration: '外族人',
        dynasty: '清朝',
        year: '1765年',
        summary: '翰林院编修黄周万为罗氏作序，详考从罗公瑾到罗永升790年世系，记载罗善等先祖事迹。'
      },
      {
        id: 9,
        title: '东西塘罗氏庆源传',
        authorName: '罗一襄',
        authorGeneration: '第三代',
        dynasty: '北宋',
        year: '1066年',
        summary: '北宋治平三年罗一襄撰，记载罗氏从唐末罗让到北宋罗继隆七代世系，上接正史，下启谱牒。'
      },
      {
        id: 10,
        title: '临清派源流序',
        authorName: '罗永鉴',
        authorGeneration: '第二十八代',
        dynasty: '清朝',
        year: '1766年',
        summary: '详述临清派源流，从远古重黎到清代，记载罗宏信开基临清，至罗筮元徙居高洲的完整世系。'
      },
      {
        id: 11,
        title: '高洲罗氏电子版家谱修谱说明',
        authorName: '罗阳先',
        authorGeneration: '第三十五代 · 明儒堂',
        dynasty: '公元',
        year: '2026年',
        summary: '说明电子版家谱的缘起、使用须知，以及数字化家谱持续完善的方向。'
      }
    ]
  },

  onLoad() {
    // 页面加载时执行
  },

  // 点击族谱序进入详情
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/preface/detail?id=${id}`
    });
  }
});
