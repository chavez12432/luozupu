/**
 * 从谱文备注解析子女姓名
 * 支持：子一：A、B / 生子： / 生子二： / 女一： / 子女： 等
 */

/** 谱文常见繁↔简（备注繁体与库内简体对齐） */
const VARIANT_CHARS = {
  啟: '启', 應: '应', 開: '开', 關: '关', 遲: '迟', 運: '运',
  迴: '回', 廻: '回', 遠: '远', 達: '达', 遜: '逊', 適: '适',
  長: '长', 國: '国', 華: '华', 東: '东', 來: '来', 時: '时',
  無: '无', 與: '与', 為: '为', 爲: '为', 爾: '尔', 學: '学',
  孫: '孙', 寶: '宝', 寧: '宁', 實: '实', 慶: '庆', 廣: '广',
  莊: '庄', 葉: '叶', 萬: '万', 蘇: '苏', 蘭: '兰', 蕭: '萧',
  藝: '艺', 藥: '药', 蔣: '蒋', 陽: '阳', 陰: '阴', 雙: '双',
  雲: '云', 鳳: '凤', 鳴: '鸣', 龍: '龙', 馬: '马', 風: '风',
  飛: '飞', 麗: '丽', 黃: '黄', 齊: '齐', 對: '对', 層: '层',
  歲: '岁', 歷: '历', 歸: '归', 殘: '残', 發: '发', 當: '当',
  產: '产', 異: '异', 畢: '毕', 盡: '尽', 監: '监', 盤: '盘',
  盧: '卢', 眾: '众', 睜: '睁', 溫: '温', 測: '测', 渾: '浑',
  湧: '涌', 湯: '汤', 準: '准', 溝: '沟', 滄: '沧', 滅: '灭',
  滌: '涤', 滬: '沪', 滯: '滞', 滲: '渗', 滸: '浒', 滾: '滚',
  滿: '满', 漁: '渔', 漢: '汉', 漣: '涟', 漬: '渍', 漲: '涨',
  漸: '渐', 漿: '浆', 潑: '泼', 潔: '洁', 潛: '潜', 潤: '润',
  潯: '浔', 潰: '溃', 澀: '涩', 澆: '浇', 澇: '涝', 澗: '涧',
  澤: '泽', 濁: '浊', 濃: '浓', 濕: '湿', 濘: '泞', 濟: '济',
  濤: '涛', 濫: '滥', 濱: '滨', 濾: '滤', 瀆: '渎', 瀉: '泻',
  瀏: '浏', 瀕: '濒', 瀘: '泸', 瀝: '沥', 瀟: '潇', 瀨: '濑',
  瀰: '弥', 瀾: '澜', 灃: '沣', 灑: '洒', 灘: '滩', 灝: '灏',
  灣: '湾', 灤: '滦', 燈: '灯', 燒: '烧', 燙: '烫', 燦: '灿',
  燭: '烛', 燬: '毁', 爍: '烁', 爐: '炉', 爛: '烂', 牆: '墙',
  獎: '奖', 獨: '独', 獲: '获', 獸: '兽', 獻: '献', 現: '现',
  瑤: '瑶', 瑩: '莹', 瑪: '玛', 璣: '玑', 璽: '玺', 煥: '焕',
  壽: '寿', 夢: '梦', 巖: '岩', 崑: '昆', 鈺: '钰', 鈐: '钤',
  鈔: '钞', 鈕: '钮', 鈞: '钧', 鈴: '铃', 鈽: '钚', 鈿: '钿',
  鉅: '巨', 鉉: '铉', 鉻: '铬', 銀: '银', 銃: '铳', 銅: '铜',
  銑: '铣', 銓: '铨', 銖: '铢', 銘: '铭', 銜: '衔', 銳: '锐',
  銷: '销', 銹: '锈', 鋁: '铝', 鋅: '锌', 鋒: '锋', 鋤: '锄',
  鋪: '铺', 鋸: '锯', 鋼: '钢', 錄: '录', 錘: '锤', 錚: '铮',
  錠: '锭', 錢: '钱', 錦: '锦', 錨: '锚', 錫: '锡', 錮: '锢',
  錯: '错', 録: '录', 錳: '锰', 鍊: '炼', 鍋: '锅', 鍍: '镀',
  鍔: '锷', 鍘: '铡', 鍛: '锻', 鍥: '锲', 鍬: '锹', 鍰: '锾',
  鍵: '键', 鍼: '针', 鍾: '钟', 鎂: '镁', 鎊: '镑', 鎌: '镰',
  鎔: '镕', 鎖: '锁', 鎗: '枪', 鎚: '锤', 鎧: '铠', 鎬: '镐',
  鎭: '镇', 鎮: '镇', 鎰: '镒', 鎳: '镍', 鏃: '镞', 鏈: '链',
  鏌: '镆', 鏗: '铿', 鏘: '锵', 鏜: '镗', 鏝: '镘', 鏞: '镛',
  鏟: '铲', 鏡: '镜', 鏢: '镖', 鏤: '镂', 鏨: '錾', 鏽: '锈',
  鐃: '铙', 鐐: '镣', 鐓: '镦', 鐔: '镡', 鐘: '钟', 鐙: '镫',
  鐠: '镨', 鐡: '铁', 鐦: '锎', 鐧: '锏', 鐫: '镌', 鐮: '镰',
  鐲: '镯', 鐳: '镭', 鐵: '铁', 鐸: '铎', 鐺: '铛', 鐿: '镱',
  鑄: '铸', 鑊: '镬', 鑌: '镔', 鑑: '鉴', 鑒: '鉴', 鑛: '矿',
  鑞: '腊', 鑲: '镶', 鑰: '钥', 鑷: '镊', 鑼: '锣', 鑽: '钻',
  鑾: '銮', 鑿: '凿', 積: '积', 巖: '岩', 崑: '昆', 嶽: '岳'
};

function toSimplified(name) {
  if (!name) return '';
  return String(name).split('').map(ch => VARIANT_CHARS[ch] || ch).join('');
}

function normalizeChildName(name) {
  if (name == null) return '';
  let text = String(name).trim();
  if (!text) return '';
  text = text.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '');
  text = text.replace(/公$/, '');
  text = text.replace(/^[长次三四](?:子|女)?/, '');
  return text.trim();
}

function namesMatch(a, b) {
  const na = toSimplified(normalizeChildName(a));
  const nb = toSimplified(normalizeChildName(b));
  return !!na && na === nb;
}

/**
 * @returns {{ name: string, genderHint: '男'|'女'|'' }[]}
 */
function parseChildrenFromRemark(remark) {
  if (!remark) return [];
  const text = String(remark).replace(/\s+/g, '');
  const results = [];
  const seen = new Set();

  // 子一：/生子：/扶子：/继子：/嗣子：/女一：/子女：
  const re = /(?:生|扶|继|嗣|过?继)?(子[女]?|女)([一二三四五六七八九十\d]*)[：:]([^。；;]*)/g;
  let m;
  while ((m = re.exec(text))) {
    const kind = m[1] || '';
    let chunk = m[3] || '';
    // 标注出继的子女不归本人生息（整段剔除）
    chunk = chunk.replace(/[^、，,及与和]{1,8}[（(][^）)]*出继[^）)]*[）)]/g, '');
    chunk = chunk.split(/出嗣|承继|兼祧|过继|继立|手写注|无出|早殇|仝?葬|妣|配|娶|元配|继配/)[0];

    const nested = chunk.search(/(?:生|扶|继|嗣)?(?:子[女]?|女)[一二三四五六七八九十\d]*[：:]/);
    if (nested > 0) chunk = chunk.slice(0, nested);

    const genderHint = kind === '女' ? '女' : (kind.indexOf('子') === 0 ? '男' : '');
    const parts = chunk.split(/[、，,及与和]/).map(s => s.trim()).filter(Boolean);

    for (let p of parts) {
      // 本条子女若标注出继，不归入本人生息列表（由收养方展示）
      if (/出继/.test(p)) continue;
      p = normalizeChildName(p);
      if (!p) continue;
      if (/^[一二三四五六七八九十\d]+$/.test(p)) continue;
      if (p.length > 6) continue;
      if (/^[配娶继]+/.test(p)) continue;
      if (/氏$/.test(p) && p.length <= 3) continue;
      if (/住|县城|适|嫁|详见|待考|不详|早卒|夭|XX|××|不明/.test(p)) continue;
      if (/继立|承继|出嗣|兼祧|出继|第[一二三四五六七八九十\d]+子|[次三四]子$|^字/.test(p)) continue;
      if (/[：:]/.test(p)) continue;

      const key = toSimplified(p);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ name: p, genderHint });
    }
  }

  return results;
}

function parseChildNamesFromRemark(remark) {
  return parseChildrenFromRemark(remark).map(c => c.name);
}

/**
 * 合并库中子女与备注子女；备注中多出的补上（可跳转优先）
 * findCandidates(name, member) => memberLite[]
 */
function mergeChildrenWithRemark(existing, member, findCandidates) {
  const list = (existing || []).map(c => Object.assign({}, c));
  const have = new Set(list.map(c => toSimplified(c.name)));
  const parsed = parseChildrenFromRemark(member.remark || '');

  parsed.forEach(p => {
    const key = toSimplified(p.name);
    if (have.has(key)) return;

    let hit = null;
    if (typeof findCandidates === 'function') {
      const cands = findCandidates(p.name, member) || [];
      const unlinked = cands.filter(c => !c.fatherId || String(c.fatherId) === '' || String(c.fatherId) === '0');
      if (unlinked.length === 1) hit = unlinked[0];
      else if (cands.length === 1) hit = cands[0];
    }

    if (hit) {
      list.push({
        _id: hit._id || '',
        name: hit.name || p.name,
        gender: hit.gender || p.genderHint || '',
        generation: hit.generation != null ? hit.generation : ((member.generation || 0) + 1),
        fromRemark: !hit._id
      });
    } else {
      list.push({
        _id: '',
        name: p.name,
        gender: p.genderHint || '',
        generation: (member.generation || 0) + 1,
        fromRemark: true
      });
    }
    have.add(key);
  });

  return list;
}

module.exports = {
  toSimplified,
  normalizeChildName,
  namesMatch,
  parseChildrenFromRemark,
  parseChildNamesFromRemark,
  mergeChildrenWithRemark
};
