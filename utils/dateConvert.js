/**
 * 公历 / 农历互转
 * lunar.js 放在 utils/vendor，按需同步/异步加载；库未就绪时用年月日兜底结构。
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

function tryRequireSync() {
  try {
    // 分包路径（主包已排除 utils/vendor/lunar.js 以控 2MB）
    // eslint-disable-next-line global-require
    return applyLib(require('../pkg-lib/vendor/lunar.js'));
  } catch (e1) {
    try {
      // eslint-disable-next-line global-require
      return applyLib(require('../pkg-local/vendor/lunar.js'));
    } catch (e2) {
      try {
        // 开发态兜底
        // eslint-disable-next-line global-require
        return applyLib(require('./vendor/lunar.js'));
      } catch (e3) {
        return false;
      }
    }
  }
}

/** 按需加载农历库；失败时静默降级，不影响其它功能 */
function preloadLunarLib() {
  if (Solar && Lunar) return Promise.resolve(true);
  if (tryRequireSync()) return Promise.resolve(true);
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve) => {
    const done = (ok) => resolve(!!ok);

    const loadModule = () => {
      if (typeof require.async !== 'function') {
        done(tryRequireSync());
        return;
      }
      const tryAsync = (path) =>
        require.async(path)
          .then((lib) => applyLib(lib))
          .catch(() => false);

      tryAsync('../pkg-lib/vendor/lunar.js')
        .then((ok) => (ok ? true : tryAsync('../pkg-local/vendor/lunar.js')))
        .then((ok) => (ok ? true : tryAsync('./vendor/lunar.js')))
        .then((ok) => {
          if (!ok) {
            console.warn('[dateConvert] lunar 异步加载失败（仅影响历法互转）');
            loadingPromise = null;
          }
          done(ok);
        });
    };

    if (!wx.loadSubpackage) {
      loadModule();
      return;
    }

    wx.loadSubpackage({
      name: 'pkg-lib',
      success: loadModule,
      fail: () => {
        wx.loadSubpackage({
          name: 'pkg-local',
          success: loadModule,
          fail: loadModule
        });
      }
    });
  });

  return loadingPromise;
}

function isLunarReady() {
  return !!(Solar && Lunar);
}

function fallbackFromLunar(y, m, d, isLeap) {
  const gz = getGanzhiZodiac(y);
  const leap = !!isLeap;
  return {
    lunar: {
      year: y,
      month: m,
      day: d,
      isLeap: leap,
      formatted: `${y}年${leap ? '闰' : ''}${m}月${d}日`
    },
    gregorian: {},
    ganzhi: gz.ganzhi ? `${gz.ganzhi}年` : '',
    zodiac: gz.zodiac,
    converted: false
  };
}

function fallbackFromGregorian(y, m, d) {
  const gz = getGanzhiZodiac(y);
  return {
    lunar: {},
    gregorian: {
      year: y,
      month: m,
      day: d,
      formatted: `${y}年${m}月${d}日`
    },
    ganzhi: gz.ganzhi ? `${gz.ganzhi}年` : '',
    zodiac: gz.zodiac,
    converted: false
  };
}

function fromGregorian(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || !m || !d) return null;
  if (!isLunarReady()) return fallbackFromGregorian(y, m, d);
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
    return fallbackFromGregorian(y, m, d);
  }
}

function fromLunar(year, month, day, isLeap) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || !m || !d) return null;
  if (!isLunarReady()) return fallbackFromLunar(y, m, d, isLeap);
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
    return fallbackFromLunar(y, m, d, isLeap);
  }
}

function enrichBirthDate(dateObj) {
  if (!dateObj || typeof dateObj !== 'object') return dateObj;
  if (!isLunarReady()) return dateObj;
  const lunar = dateObj.lunar || {};
  const g = dateObj.gregorian || {};
  if (lunar.year && lunar.month && lunar.day) {
    const full = fromLunar(lunar.year, lunar.month, lunar.day, lunar.isLeap);
    if (full && full.converted) return Object.assign({}, dateObj, full);
  }
  if (g.year && g.month && g.day) {
    const full = fromGregorian(g.year, g.month, g.day);
    if (full && full.converted) return Object.assign({}, dateObj, full);
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
