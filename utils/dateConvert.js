/**
 * 公历 / 农历互转（lunar 在分包，仅编辑页等按需加载）
 */
const ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

let Solar = null;
let Lunar = null;
let loadingPromise = null;

function getGanzhiZodiac(year) {
  const y = Number(year);
  if (!y) return { ganzhi: '', zodiac: '' };
  const ganIndex = ((y - 4) % 10 + 10) % 10;
  const zhiIndex = ((y - 4) % 12 + 12) % 12;
  return {
    ganzhi: TIAN_GAN[ganIndex] + DI_ZHI[zhiIndex],
    zodiac: ZODIAC[zhiIndex]
  };
}

function applyLib(lib) {
  if (!lib) return false;
  Solar = lib.Solar || (lib.default && lib.default.Solar) || null;
  Lunar = lib.Lunar || (lib.default && lib.default.Lunar) || null;
  return !!(Solar && Lunar);
}

/** 按需加载分包农历库；失败时静默降级，不影响族人列表 */
function preloadLunarLib() {
  if (Solar && Lunar) return Promise.resolve(true);
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve) => {
    const done = (ok) => resolve(!!ok);

    const loadModule = () => {
      if (typeof require.async !== 'function') {
        done(false);
        return;
      }
      require.async('../pkg-local/vendor/lunar.js')
        .then((lib) => done(applyLib(lib)))
        .catch((err) => {
          // 常见：{ mod, errMsg } / errcode -2（取消或分包未就绪）
          console.warn('[dateConvert] lunar 异步加载失败（可忽略，仅影响历法互转）', err);
          loadingPromise = null; // 允许重试
          done(false);
        });
    };

    if (!wx.loadSubpackage) {
      loadModule();
      return;
    }

    wx.loadSubpackage({
      name: 'pkg-local',
      success: loadModule,
      fail: (err) => {
        console.warn('[dateConvert] pkg-local 加载失败（可忽略）', err);
        loadingPromise = null;
        done(false);
      }
    });
  });

  return loadingPromise;
}

function isLunarReady() {
  return !!(Solar && Lunar);
}

function fromGregorian(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || !m || !d) return null;
  if (!isLunarReady()) return null;
  try {
    const solar = Solar.fromYmd(y, m, d);
    const lunar = solar.getLunar();
    const gz = getGanzhiZodiac(lunar.getYear());
    return {
      lunar: {
        year: lunar.getYear(),
        month: Math.abs(lunar.getMonth()),
        day: lunar.getDay(),
        isLeap: lunar.getMonth() < 0,
        formatted: lunar.toString()
      },
      gregorian: {
        year: y,
        month: m,
        day: d,
        formatted: `${y}年${m}月${d}日`
      },
      ganzhi: gz.ganzhi ? `${gz.ganzhi}年` : '',
      zodiac: gz.zodiac,
      converted: true
    };
  } catch (e) {
    console.warn('[dateConvert] fromGregorian failed', e);
    return null;
  }
}

function fromLunar(year, month, day, isLeap) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || !m || !d) return null;
  if (!isLunarReady()) return null;
  try {
    const lunarMonth = isLeap ? -m : m;
    const lunar = Lunar.fromYmd(y, lunarMonth, d);
    const solar = lunar.getSolar();
    const gz = getGanzhiZodiac(lunar.getYear());
    return {
      lunar: {
        year: lunar.getYear(),
        month: Math.abs(lunar.getMonth()),
        day: lunar.getDay(),
        isLeap: lunar.getMonth() < 0,
        formatted: lunar.toString()
      },
      gregorian: {
        year: solar.getYear(),
        month: solar.getMonth(),
        day: solar.getDay(),
        formatted: `${solar.getYear()}年${solar.getMonth()}月${solar.getDay()}日`
      },
      ganzhi: gz.ganzhi ? `${gz.ganzhi}年` : '',
      zodiac: gz.zodiac,
      converted: true
    };
  } catch (e) {
    console.warn('[dateConvert] fromLunar failed', e);
    return null;
  }
}

function enrichBirthDate(dateObj) {
  if (!dateObj || typeof dateObj !== 'object') return dateObj;
  if (!isLunarReady()) return dateObj;
  const lunar = dateObj.lunar || {};
  const g = dateObj.gregorian || {};
  if (lunar.year && lunar.month && lunar.day) {
    const full = fromLunar(lunar.year, lunar.month, lunar.day, lunar.isLeap);
    if (full) return Object.assign({}, dateObj, full);
  }
  if (g.year && g.month && g.day) {
    const full = fromGregorian(g.year, g.month, g.day);
    if (full) return Object.assign({}, dateObj, full);
  }
  return dateObj;
}

module.exports = {
  fromGregorian,
  fromLunar,
  enrichBirthDate,
  getGanzhiZodiac,
  preloadLunarLib,
  isLunarReady,
  get Solar() { return Solar; },
  get Lunar() { return Lunar; }
};
