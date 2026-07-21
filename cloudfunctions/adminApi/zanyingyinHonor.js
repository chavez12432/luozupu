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
    name: '罗公瑾',
    generation: 1,
    dynasty: '宋',
    achievements: '宋太宗兴国元年擒宋德明等，以功为江南兵钤驻剳吉州。',
    memberDocId: 'M0001'
  },
  {
    id: 'zyy-jilong',
    name: '罗继隆',
    generation: 2,
    dynasty: '宋',
    achievements: '江东都统，拜陕西泾源节度使。',
    memberDocId: 'M0002'
  },
  {
    id: 'zyy-zhongcheng',
    name: '罗中成',
    generation: 6,
    dynasty: '宋',
    achievements: '任江州德化县知县。',
    memberDocId: 'M0010'
  },
  {
    id: 'zyy-huidi',
    name: '罗惠迪',
    generation: 7,
    dynasty: '宋',
    achievements: '庆典迪功郎。',
    memberDocId: 'M0012'
  },
  {
    id: 'zyy-shiju',
    name: '罗世举',
    generation: 8,
    dynasty: '宋',
    achievements: '敕赐楚州文学。',
    memberDocId: null
  },
  {
    id: 'zyy-shibeng',
    name: '罗世伻',
    generation: 8,
    dynasty: '宋',
    achievements: '奏授将仕郎、永州佥判。',
    memberDocId: null
  },
  {
    id: 'zyy-jingfu',
    name: '罗敬夫',
    generation: 9,
    dynasty: '宋',
    achievements: '授文林郎，判建康都税院，兼淮西江东总领军马钱粮事。',
    memberDocId: null
  },
  {
    id: 'zyy-renfu',
    name: '罗仁夫',
    generation: 9,
    dynasty: '宋',
    achievements: '授迪功郎，寻州桂平簿尉。',
    memberDocId: null
  },
  {
    id: 'zyy-jin',
    name: '罗晋',
    generation: 10,
    dynasty: '宋',
    achievements: '授登仕郎。',
    memberDocId: null
  },
  {
    id: 'zyy-xun',
    name: '罗巽',
    generation: 10,
    dynasty: '宋',
    achievements: '授迪功郎。',
    memberDocId: null
  },
  {
    id: 'zyy-maojv',
    name: '罗懋举',
    generation: 13,
    dynasty: '元',
    achievements: '任黄州学正。',
    memberDocId: null
  },
  {
    id: 'zyy-zhongxian',
    name: '罗仲显',
    generation: 15,
    dynasty: '明',
    achievements: '任湖口县训导。',
    memberDocId: null
  },
  {
    id: 'zyy-wuren',
    name: '罗吾仁',
    generation: 15,
    dynasty: '明',
    achievements: '授知县，未赴任卒。',
    memberDocId: null
  },
  {
    id: 'zyy-ming',
    name: '罗明',
    generation: 16,
    dynasty: '明',
    achievements: '赠南京山东道监察御史。',
    memberDocId: 'M0032'
  },
  {
    id: 'zyy-shan',
    name: '罗善',
    generation: 17,
    dynasty: '明',
    achievements: '勅南京山东道监察御史，陞福建按察佥事、云南副使。',
    memberDocId: 'M0036'
  },
  {
    id: 'zyy-jianshan',
    name: '罗兼善',
    generation: 17,
    dynasty: '明',
    achievements: '任河南解、汝、化三州学正。',
    memberDocId: null
  },
  {
    id: 'zyy-jun',
    name: '罗俊',
    generation: 17,
    dynasty: '明',
    achievements: '任河南府永宁县，改任泉州府永春县司训。',
    memberDocId: null
  },
  {
    id: 'zyy-ren17',
    name: '罗仁',
    generation: 17,
    dynasty: '明',
    achievements: '任广西桂林府通判。',
    memberDocId: null
  },
  {
    id: 'zyy-riqian',
    name: '罗日谦',
    generation: 18,
    dynasty: '明',
    achievements: '任浙江桐乡县主簿。',
    memberDocId: 'M0038'
  },
  {
    id: 'zyy-rirang',
    name: '罗日让',
    generation: 18,
    dynasty: '明',
    achievements: '任福建水师营守备。',
    memberDocId: 'M0039'
  },
  {
    id: 'zyy-guang',
    name: '罗光',
    generation: 19,
    dynasty: '明',
    achievements: '任四川成都府新繁县主簿。',
    memberDocId: null
  },
  {
    id: 'zyy-xin',
    name: '罗新',
    generation: 26,
    dynasty: '清',
    achievements: '赠儒林郎。',
    memberDocId: null
  },
  {
    id: 'zyy-chaogan',
    name: '罗朝干',
    generation: 27,
    dynasty: '清',
    achievements: '勅授儒林郎，即选州同知。',
    memberDocId: 'M1036'
  },
  {
    id: 'zyy-shanren',
    name: '罗善任',
    generation: 27,
    dynasty: '清',
    achievements: '登仕郎。',
    memberDocId: 'C0085'
  },
  {
    id: 'zyy-yongjian',
    name: '罗永鉴',
    generation: 28,
    dynasty: '清',
    achievements: '饮宾，徵仕郎。',
    memberDocId: 'M1062'
  },
  {
    id: 'zyy-dazhong',
    name: '罗大忠',
    generation: 29,
    dynasty: '清',
    achievements: '登仕郎。',
    memberDocId: null
  },
  {
    id: 'zyy-dahong',
    name: '罗大鸿',
    generation: 29,
    dynasty: '清',
    achievements: '登仕郎。',
    memberDocId: null
  },
  {
    id: 'zyy-hongwei',
    name: '罗宏位',
    generation: 29,
    dynasty: '清',
    achievements: '钦赐徵仕郎。',
    memberDocId: 'M0282'
  },
  {
    id: 'zyy-zhi',
    name: '罗智',
    generation: 30,
    dynasty: '清',
    achievements: '登仕郎。',
    memberDocId: null
  },

  // —— 近现代：公职事迹（学历已分至学历榜）——
  {
    id: 'zyy-guocai',
    name: '罗国才',
    generation: 34,
    dynasty: '近现代',
    achievements: '师政治部主任；江西省轻工业厅直属技工学校党委书记、校长。',
    memberDocId: 'M1264'
  },
  {
    id: 'zyy-decai',
    name: '罗德才',
    generation: 34,
    dynasty: '近现代',
    achievements: '洲湖镇党委书记、人大主席。',
    memberDocId: 'M1255'
  },
  {
    id: 'zyy-jianming',
    name: '罗建明',
    generation: 34,
    dynasty: '近现代',
    achievements: '广州大学留校任教。',
    memberDocId: 'C0284'
  },
  {
    id: 'zyy-qingliang',
    name: '罗庆良',
    generation: 35,
    dynasty: '近现代',
    achievements: '中共峡江县县委常委、组织部部长。',
    memberDocId: 'M1345'
  },
  {
    id: 'zyy-xiangwen',
    name: '罗相文',
    generation: 35,
    dynasty: '近现代',
    achievements: '江西省委宣传部办公室副调研员。',
    memberDocId: 'M0487'
  },
  {
    id: 'zyy-jinghua',
    name: '罗京华',
    generation: 35,
    dynasty: '近现代',
    achievements: '中级技师，营级干部。',
    memberDocId: 'M1380'
  },
  {
    id: 'zyy-jingli',
    name: '罗京丽',
    generation: 35,
    dynasty: '近现代',
    achievements: '中级讲师。',
    memberDocId: 'M1381'
  },
  {
    id: 'zyy-zhijian',
    name: '罗志坚',
    generation: 36,
    dynasty: '近现代',
    achievements: '中国联通赣州分公司，高级工程师。',
    memberDocId: 'M1415'
  },
  {
    id: 'zyy-zhibing',
    name: '罗志兵',
    generation: 36,
    dynasty: '近现代',
    achievements: '吉安市委秘书科科长，市委办公室副调研员。',
    memberDocId: 'M1416'
  },
  {
    id: 'zyy-zhifang',
    name: '罗志芳',
    generation: 36,
    dynasty: '近现代',
    achievements: '会计师。',
    memberDocId: 'M1433'
  }
];

/**
 * 簪缨引中偏学历、需并入学历榜的补充项（与现有学历榜按 _id/姓名+称号去重）
 * bucket: imperial | republican | modern
 */
const ZANYINGYIN_EDUCATION = [
  // 仅功名，不入乡贤
  {
    name: '罗敬夫',
    generation: 9,
    bucket: 'imperial',
    titles: ['进士'],
    titleDetail: '嘉定辛未进士',
    memberDocId: null,
    dynastyEra: '宋'
  },
  {
    name: '罗懋举',
    generation: 13,
    bucket: 'imperial',
    titles: ['进士'],
    titleDetail: '进士',
    memberDocId: null,
    dynastyEra: '元'
  },
  {
    name: '罗兼善',
    generation: 17,
    bucket: 'imperial',
    titles: ['举人'],
    titleDetail: '宣德壬子科举人',
    memberDocId: null,
    dynastyEra: '明'
  },
  {
    name: '罗俊',
    generation: 17,
    bucket: 'imperial',
    titles: ['贡生'],
    titleDetail: '贡举',
    memberDocId: null,
    dynastyEra: '明'
  },
  {
    name: '罗仁',
    generation: 17,
    bucket: 'imperial',
    titles: ['贡生'],
    titleDetail: '贡举',
    memberDocId: null,
    dynastyEra: '明'
  },
  {
    name: '罗日谦',
    generation: 18,
    bucket: 'imperial',
    titles: ['贡生'],
    titleDetail: '岁贡',
    memberDocId: 'M0038',
    dynastyEra: '明'
  },
  {
    name: '罗补衮',
    generation: 26,
    bucket: 'imperial',
    titles: ['廪生'],
    titleDetail: '程廪生',
    memberDocId: 'M0116',
    dynastyEra: '清'
  },
  {
    name: '罗永昌',
    generation: 28,
    bucket: 'imperial',
    titles: ['贡生'],
    titleDetail: '贡生',
    memberDocId: 'M1046',
    dynastyEra: '清'
  },
  {
    name: '罗永景',
    generation: 28,
    bucket: 'imperial',
    titles: ['廪生'],
    titleDetail: '程廪生',
    memberDocId: 'M1049',
    dynastyEra: '清'
  },
  // 近现代：仅列学历、无公职或公职已在乡贤分置者，补入学历榜缺口
  {
    name: '罗锋良',
    generation: 35,
    bucket: 'modern',
    educations: [{ degree: '大学', school: '北京地质学院', year: null }],
    memberDocId: 'M1336',
    birthText: '1988年2月2日',
    dynastyEra: '1988年'
  }
];

function listZanyingyinSages(dynasty) {
  let list = ZANYINGYIN_SAGES.slice();
  if (dynasty && dynasty !== '全部') {
    list = list.filter(item => item.dynasty === dynasty);
  }
  return list.map(item => {
    let name = String(item.name || '').trim();
    while (name.startsWith('罗') && name.length > 1) name = name.slice(1).trim();
    name = name ? `罗${name}` : '';
    return {
      _id: item.id,
      name,
      generation: item.generation,
      dynasty: item.dynasty,
      achievements: item.achievements,
      memberDocId: item.memberDocId || '',
      hasLink: !!item.memberDocId
    };
  });
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
