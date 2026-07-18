/**
 * 簪缨引 → 家族乡贤榜 / 学历榜
 * 来源：原始资料/簪缨引.md
 *
 * - 乡贤：官职、职衔、公职事迹
 * - 学历：科举功名与近现代学历（与乡贤分置，避免同一事迹重复）
 */

const INTRO =
  '溯我罗氏，派演临清。自汉迄今，代有簪缨。兹修支谱，止详所亲。各派世系，名不尽登。惟兹衣冠，概宜崇钦。首列于图，百世流馨。';

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   generation: number,
 *   dynasty: string,
 *   achievements: string,
 *   memberDocId: string|null
 * }} SageEntry
 */

/** @type {SageEntry[]} */
const ZANYINGYIN_SAGES = [
  // —— 近世以前：衣冠官职 ——
  {
    id: 'zyy-gongjin',
    name: '公瑾',
    generation: 1,
    dynasty: '宋',
    achievements: '宋太宗兴国元年擒宋德明等，以功为江南兵钤驻剳吉州。',
    memberDocId: '9eb3651569d76d7c0849eb8473b7c55b'
  },
  {
    id: 'zyy-jilong',
    name: '继隆',
    generation: 2,
    dynasty: '宋',
    achievements: '江东都统，拜陕西泾源节度使。',
    memberDocId: '9eb3651569d76d7c0849eb850760e8f7'
  },
  {
    id: 'zyy-zhongcheng',
    name: '中成',
    generation: 6,
    dynasty: '宋',
    achievements: '任江州德化县知县。',
    memberDocId: '9eb3651569d76d7c0849eb8d6ff0de33'
  },
  {
    id: 'zyy-huidi',
    name: '惠迪',
    generation: 7,
    dynasty: '宋',
    achievements: '庆典迪功郎。',
    memberDocId: '9eb3651569d76d7c0849eb8f158d2ec5'
  },
  {
    id: 'zyy-shiju',
    name: '世举',
    generation: 8,
    dynasty: '宋',
    achievements: '敕赐楚州文学。',
    memberDocId: null
  },
  {
    id: 'zyy-shibeng',
    name: '世伻',
    generation: 8,
    dynasty: '宋',
    achievements: '奏授将仕郎、永州佥判。',
    memberDocId: null
  },
  {
    id: 'zyy-jingfu',
    name: '敬夫',
    generation: 9,
    dynasty: '宋',
    achievements: '授文林郎，判建康都税院，兼淮西江东总领军马钱粮事。',
    memberDocId: null
  },
  {
    id: 'zyy-renfu',
    name: '仁夫',
    generation: 9,
    dynasty: '宋',
    achievements: '授迪功郎，寻州桂平簿尉。',
    memberDocId: null
  },
  {
    id: 'zyy-jin',
    name: '晋',
    generation: 10,
    dynasty: '宋',
    achievements: '授登仕郎。',
    memberDocId: null
  },
  {
    id: 'zyy-xun',
    name: '巽',
    generation: 10,
    dynasty: '宋',
    achievements: '授迪功郎。',
    memberDocId: null
  },
  {
    id: 'zyy-maojv',
    name: '懋举',
    generation: 13,
    dynasty: '元',
    achievements: '任黄州学正。',
    memberDocId: null
  },
  {
    id: 'zyy-zhongxian',
    name: '仲显',
    generation: 15,
    dynasty: '明',
    achievements: '任湖口县训导。',
    memberDocId: null
  },
  {
    id: 'zyy-wuren',
    name: '吾仁',
    generation: 15,
    dynasty: '明',
    achievements: '授知县，未赴任卒。',
    memberDocId: null
  },
  {
    id: 'zyy-ming',
    name: '明',
    generation: 16,
    dynasty: '明',
    achievements: '赠南京山东道监察御史。',
    memberDocId: '9eb3651569d76d7c0849eba32bfe67d3'
  },
  {
    id: 'zyy-shan',
    name: '善',
    generation: 17,
    dynasty: '明',
    achievements: '勅南京山东道监察御史，陞福建按察佥事、云南副使。',
    memberDocId: '9eb3651569d76d7c0849eba705d570c8'
  },
  {
    id: 'zyy-jianshan',
    name: '兼善',
    generation: 17,
    dynasty: '明',
    achievements: '任河南解、汝、化三州学正。',
    memberDocId: null
  },
  {
    id: 'zyy-jun',
    name: '俊',
    generation: 17,
    dynasty: '明',
    achievements: '任河南府永宁县，改任泉州府永春县司训。',
    memberDocId: null
  },
  {
    id: 'zyy-ren17',
    name: '仁',
    generation: 17,
    dynasty: '明',
    achievements: '任广西桂林府通判。',
    memberDocId: null
  },
  {
    id: 'zyy-riqian',
    name: '日谦',
    generation: 18,
    dynasty: '明',
    achievements: '任浙江桐乡县主簿。',
    memberDocId: '9eb3651569d76d7c0849eba97b3a2a57'
  },
  {
    id: 'zyy-rirang',
    name: '日让',
    generation: 18,
    dynasty: '明',
    achievements: '任福建水师营守备。',
    memberDocId: '9eb3651569d76d7c0849ebaa109598f6'
  },
  {
    id: 'zyy-guang',
    name: '光',
    generation: 19,
    dynasty: '明',
    achievements: '任四川成都府新繁县主簿。',
    memberDocId: null
  },
  {
    id: 'zyy-xin',
    name: '新',
    generation: 26,
    dynasty: '清',
    achievements: '赠儒林郎。',
    memberDocId: null
  },
  {
    id: 'zyy-chaogan',
    name: '朝干',
    generation: 27,
    dynasty: '清',
    achievements: '勅授儒林郎，即选州同知。',
    memberDocId: '9eb3651569d76d7d0849ee2d51842422'
  },
  {
    id: 'zyy-shanren',
    name: '善任',
    generation: 27,
    dynasty: '清',
    achievements: '登仕郎。',
    memberDocId: '9eb3651569d76d7d0849f03a03a51506'
  },
  {
    id: 'zyy-yongjian',
    name: '永鉴',
    generation: 28,
    dynasty: '清',
    achievements: '饮宾，徵仕郎。',
    memberDocId: '9eb3651569d76d7d0849ee470241e05d'
  },
  {
    id: 'zyy-dazhong',
    name: '大忠',
    generation: 29,
    dynasty: '清',
    achievements: '登仕郎。',
    memberDocId: null
  },
  {
    id: 'zyy-dahong',
    name: '大鸿',
    generation: 29,
    dynasty: '清',
    achievements: '登仕郎。',
    memberDocId: null
  },
  {
    id: 'zyy-hongwei',
    name: '宏位',
    generation: 29,
    dynasty: '清',
    achievements: '钦赐徵仕郎。',
    memberDocId: '9eb3651569d76d7c0849eca36f584b5f'
  },
  {
    id: 'zyy-zhi',
    name: '智',
    generation: 30,
    dynasty: '清',
    achievements: '登仕郎。',
    memberDocId: null
  },

  // —— 近现代：公职事迹（学历已分至学历榜）——
  {
    id: 'zyy-guocai',
    name: '国才',
    generation: 34,
    dynasty: '近现代',
    achievements: '师政治部主任；江西省轻工业厅直属技工学校党委书记、校长。',
    memberDocId: '9eb3651569d76d7d0849ef137436f26f'
  },
  {
    id: 'zyy-decai',
    name: '德才',
    generation: 34,
    dynasty: '近现代',
    achievements: '洲湖镇党委书记、人大主席。',
    memberDocId: '9eb3651569d76d7d0849ef0a3c6a0897'
  },
  {
    id: 'zyy-jianming',
    name: '建明',
    generation: 34,
    dynasty: '近现代',
    achievements: '广州大学留校任教。',
    memberDocId: '9eb3651569d76d7d0849f1005c3d575f'
  },
  {
    id: 'zyy-qingliang',
    name: '庆良',
    generation: 35,
    dynasty: '近现代',
    achievements: '中共峡江县县委常委、组织部部长。',
    memberDocId: '9eb3651569d76d7d0849ef4d2de3fd2a'
  },
  {
    id: 'zyy-xiangwen',
    name: '相文',
    generation: 35,
    dynasty: '近现代',
    achievements: '江西省委宣传部办公室副调研员。',
    memberDocId: '9eb3651569d76d7d0849ed7001a6109c'
  },
  {
    id: 'zyy-jinghua',
    name: '京华',
    generation: 35,
    dynasty: '近现代',
    achievements: '中级技师，营级干部。',
    memberDocId: '9eb3651569d76d7d0849ef8f72b2bbf9'
  },
  {
    id: 'zyy-jingli',
    name: '京丽',
    generation: 35,
    dynasty: '近现代',
    achievements: '中级讲师。',
    memberDocId: '9eb3651569d76d7d0849ef90659ff0f7'
  },
  {
    id: 'zyy-zhijian',
    name: '志坚',
    generation: 36,
    dynasty: '近现代',
    achievements: '中国联通赣州分公司，高级工程师。',
    memberDocId: '9eb3651569d76d7d0849efb44b236805'
  },
  {
    id: 'zyy-zhibing',
    name: '志兵',
    generation: 36,
    dynasty: '近现代',
    achievements: '吉安市委秘书科科长，市委办公室副调研员。',
    memberDocId: '9eb3651569d76d7d0849efb550341440'
  },
  {
    id: 'zyy-zhifang',
    name: '志芳',
    generation: 36,
    dynasty: '近现代',
    achievements: '会计师。',
    memberDocId: '9eb3651569d76d7d0849efc618e0fd3f'
  }
];

/**
 * 簪缨引中偏学历、需并入学历榜的补充项（与现有学历榜按 _id/姓名+称号去重）
 * bucket: imperial | republican | modern
 */
const ZANYINGYIN_EDUCATION = [
  // 仅功名，不入乡贤
  {
    name: '敬夫',
    generation: 9,
    bucket: 'imperial',
    titles: ['进士'],
    titleDetail: '嘉定辛未进士',
    memberDocId: null,
    dynastyEra: '宋'
  },
  {
    name: '懋举',
    generation: 13,
    bucket: 'imperial',
    titles: ['进士'],
    titleDetail: '进士',
    memberDocId: null,
    dynastyEra: '元'
  },
  {
    name: '兼善',
    generation: 17,
    bucket: 'imperial',
    titles: ['举人'],
    titleDetail: '宣德壬子科举人',
    memberDocId: null,
    dynastyEra: '明'
  },
  {
    name: '俊',
    generation: 17,
    bucket: 'imperial',
    titles: ['贡生'],
    titleDetail: '贡举',
    memberDocId: null,
    dynastyEra: '明'
  },
  {
    name: '仁',
    generation: 17,
    bucket: 'imperial',
    titles: ['贡生'],
    titleDetail: '贡举',
    memberDocId: null,
    dynastyEra: '明'
  },
  {
    name: '日谦',
    generation: 18,
    bucket: 'imperial',
    titles: ['贡生'],
    titleDetail: '岁贡',
    memberDocId: '9eb3651569d76d7c0849eba97b3a2a57',
    dynastyEra: '明'
  },
  {
    name: '补衮',
    generation: 26,
    bucket: 'imperial',
    titles: ['廪生'],
    titleDetail: '程廪生',
    memberDocId: '9eb3651569d76d7c0849ebfe1872c8c8',
    dynastyEra: '清'
  },
  {
    name: '永昌',
    generation: 28,
    bucket: 'imperial',
    titles: ['贡生'],
    titleDetail: '贡生',
    memberDocId: '9eb3651569d76d7d0849ee37517bbec3',
    dynastyEra: '清'
  },
  {
    name: '永景',
    generation: 28,
    bucket: 'imperial',
    titles: ['廪生'],
    titleDetail: '程廪生',
    memberDocId: '9eb3651569d76d7d0849ee3a73909af2',
    dynastyEra: '清'
  },
  // 近现代：仅列学历、无公职或公职已在乡贤分置者，补入学历榜缺口
  {
    name: '锋良',
    generation: 35,
    bucket: 'modern',
    educations: [{ degree: '大学', school: '北京地质学院', year: null }],
    memberDocId: '9eb3651569d76d7d0849ef436009333a',
    birthText: '1988年2月2日',
    dynastyEra: '1988年'
  }
];

function listZanyingyinSages(dynasty) {
  let list = ZANYINGYIN_SAGES.slice();
  if (dynasty && dynasty !== '全部') {
    list = list.filter(item => item.dynasty === dynasty);
  }
  return list.map(item => ({
    _id: item.id,
    name: item.name,
    generation: item.generation,
    dynasty: item.dynasty,
    achievements: item.achievements,
    memberDocId: item.memberDocId || '',
    hasLink: !!item.memberDocId
  }));
}

/**
 * 将簪缨引学历并入已有三类列表（按 memberDocId 或 姓名+称号 去重）
 */
function mergeZanyingyinEducation(lists) {
  const imperial = (lists && lists.imperial) ? lists.imperial.slice() : [];
  const republican = (lists && lists.republican) ? lists.republican.slice() : [];
  const modern = (lists && lists.modern) ? lists.modern.slice() : [];

  for (const item of ZANYINGYIN_EDUCATION) {
    if (item.bucket === 'imperial') {
      const titles = item.titles || [];
      const existing = imperial.find(row =>
        (item.memberDocId && row._id === item.memberDocId) ||
        (!item.memberDocId && row.name === item.name && (row.titleText || '').includes(titles[0]))
      );
      if (existing) {
        const merged = Array.isArray(existing.titles) ? existing.titles.slice() : [];
        titles.forEach(t => {
          if (t && !merged.includes(t)) merged.push(t);
        });
        existing.titles = merged;
        existing.titleText = merged.join('、');
      } else {
        // 同名已有任意科举记录则跳过，避免假人「俊」等与无关条目纠缠；无 memberDocId 时仍追加（簪缨引专条）
        const sameName = imperial.find(row => row.name === item.name && item.memberDocId && row._id === item.memberDocId);
        if (sameName) continue;
        if (item.memberDocId && imperial.some(row => row._id === item.memberDocId)) {
          const row = imperial.find(r => r._id === item.memberDocId);
          const merged = Array.isArray(row.titles) ? row.titles.slice() : [];
          titles.forEach(t => {
            if (t && !merged.includes(t)) merged.push(t);
          });
          row.titles = merged;
          row.titleText = merged.join('、');
          continue;
        }
        imperial.push({
          _id: item.memberDocId || '',
          name: item.name,
          birthText: '—',
          dynastyEra: item.dynastyEra || '—',
          titles: titles.slice(),
          titleText: (item.titleDetail || titles.join('、'))
        });
      }
    } else if (item.bucket === 'republican' || item.bucket === 'modern') {
      const target = item.bucket === 'republican' ? republican : modern;
      const edus = item.educations || [];
      const existing = target.find(row =>
        (item.memberDocId && row._id === item.memberDocId) ||
        (row.name === item.name && !item.memberDocId)
      );
      if (existing) {
        const have = existing.educations || [];
        edus.forEach(edu => {
          const key = `${edu.degree}|${edu.school || ''}`;
          if (!have.some(e => `${e.degree}|${e.school || ''}` === key)) {
            have.push({
              school: edu.school || '—',
              degree: edu.degree,
              year: edu.year
            });
          }
        });
        existing.educations = have;
      } else {
        target.push({
          _id: item.memberDocId || '',
          name: item.name,
          birthText: item.birthText || '—',
          dynastyEra: item.dynastyEra || '—',
          educations: edus.map(edu => ({
            school: edu.school || '—',
            degree: edu.degree,
            year: edu.year
          }))
        });
      }
    }
  }

  return { imperial, republican, modern };
}

module.exports = {
  INTRO,
  ZANYINGYIN_SAGES,
  ZANYINGYIN_EDUCATION,
  listZanyingyinSages,
  mergeZanyingyinEducation
};
