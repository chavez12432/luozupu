const config = require('./config');
const localDb = require('./localDb');

function createQuery(collectionName, where = {}) {
  const state = {
    collectionName,
    where,
    limitCount: Infinity,
    skipCount: 0,
    orderRules: []
  };

  const api = {
    where(condition) {
      state.where = Object.assign({}, state.where, condition);
      return api;
    },
    orderBy(field, direction) {
      state.orderRules.push({ field, direction: direction || 'asc' });
      return api;
    },
    skip(count) {
      state.skipCount = count;
      return api;
    },
    limit(count) {
      state.limitCount = count;
      return api;
    },
    field() {
      return api;
    },
    async get() {
      let list = localDb.filterCollection(state.collectionName, state.where);
      state.orderRules.forEach(rule => {
        list = list.slice().sort((a, b) => {
          const av = a[rule.field];
          const bv = b[rule.field];
          if (av === bv) return 0;
          const result = av > bv ? 1 : -1;
          return rule.direction === 'desc' ? -result : result;
        });
      });
      list = list.slice(state.skipCount, state.skipCount + state.limitCount);
      return { data: list };
    },
    async count() {
      return { total: localDb.countCollection(state.collectionName, state.where) };
    }
  };

  return api;
}

function createLocalDatabase() {
  return {
    collection(name) {
      const query = () => createQuery(name);
      return {
        where(condition) {
          return createQuery(name, condition);
        },
        orderBy(field, direction) {
          return createQuery(name).orderBy(field, direction);
        },
        limit(count) {
          return createQuery(name).limit(count);
        },
        skip(count) {
          return createQuery(name).skip(count);
        },
        field() {
          return createQuery(name);
        },
        doc(id) {
          return {
            async get() {
              const data = localDb.findById(name, id);
              return { data };
            },
            async update() {
              return { stats: { updated: 0 } };
            },
            async remove() {
              return { stats: { removed: 0 } };
            }
          };
        },
        async get() {
          return query().get();
        },
        async count() {
          return query().count();
        },
        async add() {
          return { _id: `local_${Date.now()}` };
        }
      };
    },
    command: {
      exists: () => true,
      in: () => true
    },
    serverDate() {
      return new Date();
    }
  };
}

function callFunction(options = {}) {
  const { name, data = {} } = options;

  return Promise.resolve().then(async () => {
    let result;

    switch (name) {
      case 'getMembers':
        await localDb.ensureMembersLoaded();
        result = localDb.getMembers(data);
        break;
      case 'getMemberDetail':
        await localDb.ensureMembersLoaded();
        result = localDb.getMemberDetail(data.id);
        break;
      case 'adminApi':
        await localDb.ensureMembersLoaded();
        result = localDb.handleAdminApi(data);
        break;
      case 'memberManageApi':
        result = {
          success: false,
          message: '本地模式请使用 memberManageService，勿直接 callFunction'
        };
        break;
      case 'importMembers':
        result = {
          success: false,
          message: '本地调试模式请使用 database 目录下的导出文件，无需云导入'
        };
        break;
      case 'batchImportMembers':
        result = {
          success: false,
          message: '本地调试模式不支持批量写入云端'
        };
        break;
      default:
        result = {
          success: false,
          message: `本地模式暂未模拟云函数: ${name}`
        };
    }

    return { result, errMsg: 'cloud.callFunction:ok' };
  });
}

function installLocalCloud() {
  if (!wx.cloud) {
    wx.cloud = {};
  }

  wx.cloud.init = function () {
    console.log('[dataService] 本地调试模式，跳过云开发初始化');
  };

  wx.cloud.callFunction = callFunction;
  wx.cloud.database = createLocalDatabase;

  wx.cloud.uploadFile = function () {
    return Promise.reject(new Error('本地调试模式不支持上传文件到云存储'));
  };
}

function bootstrap() {
  if (!config.isLocalMode()) return false;

  installLocalCloud();
  localDb.init();
  localDb.ensureMembersLoaded().then(() => {
    const stats = localDb.getStats();
    if (!stats.members) {
      console.warn('[dataService] 未加载到族人数据，请确认 pkg-local 分包内 members_*_export.json 存在');
    } else {
      console.log('[dataService] 本地族人已加载', stats.members, '人（古代+现代分表）');
    }
  });

  return true;
}

async function bootstrapAsync() {
  if (!config.isLocalMode()) return false;
  await localDb.initAsync();
  installLocalCloud();
  return true;
}

module.exports = {
  bootstrap,
  bootstrapAsync,
  callFunction,
  installLocalCloud
};
