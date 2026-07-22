/**
 * 云开发 API 访问
 * 开发环境默认走 Vite 代理 /api → proxy-server:3000（避免直连 localhost:3000 在局域网调试失败）
 * 成员增删改走 /members/*（写云库并同步本地 members_export.json）
 */

const PROXY_URL =
  import.meta.env.VITE_PROXY_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:3000');

const PROXY_DOWN_MSG =
  '无法连接代理服务器。请在项目目录执行：cd admin-vite/proxy-server && npm start';

function isProxyConnError(error) {
  return (
    error &&
    /Failed to fetch|NetworkError|ECONNREFUSED|Load failed|fetch failed/i.test(
      String(error.message || error)
    )
  );
}

async function loadMembersFromLocalJson() {
  const res = await fetch('/local-db/members.json');
  if (!res.ok) throw new Error('本地族人 JSON 不可用');
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function paginateMembers(all, params = {}) {
  let list = all.slice();
  const { branch, generation, name, page = 1, pageSize = 10 } = params;
  if (branch) list = list.filter((m) => m.branch === branch);
  if (generation) list = list.filter((m) => Number(m.generation) === Number(generation));
  if (name) {
    const q = String(name).trim();
    if (q) list = list.filter((m) => String(m.name || '').includes(q));
  }
  const total = list.length;
  const start = (Math.max(1, page) - 1) * pageSize;
  return {
    success: true,
    data: list.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    source: 'local-json'
  };
}

/**
 * 调用云函数
 */
async function callCloudFunctionHTTP(name, data = {}) {
  const url = `${PROXY_URL}/call/${name}`;
  console.log('请求 URL:', url);
  console.log('请求数据:', JSON.stringify(data).slice(0, 300));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (e) {
      throw new Error(`代理返回非 JSON (${response.status}): ${text.slice(0, 200)}`);
    }

    if (!response.ok) {
      throw new Error((json && json.message) || `HTTP ${response.status}`);
    }

    return json;
  } catch (error) {
    console.error('调用云函数失败:', error);
    const tip = isProxyConnError(error) ? PROXY_DOWN_MSG : error.message || String(error);
    throw new Error(tip);
  }
}

async function callProxy(path, { method = 'GET', body } = {}) {
  const url = `${PROXY_URL}${path}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body != null) opts.body = JSON.stringify(body);

  try {
    const response = await fetch(url, opts);
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (e) {
      throw new Error(`代理返回非 JSON (${response.status}): ${text.slice(0, 200)}`);
    }
    if (!response.ok) {
      throw new Error((json && json.message) || `HTTP ${response.status}`);
    }
    return json;
  } catch (error) {
    const tip = isProxyConnError(error) ? PROXY_DOWN_MSG : error.message || String(error);
    throw new Error(tip);
  }
}

/**
 * 成员 API
 */
export const memberApi = {
  // 获取列表
  async getList(params = {}) {
    try {
      return await callCloudFunctionHTTP('adminApi', {
        action: 'list',
        ...params
      });
    } catch (error) {
      console.error('获取列表失败:', error);
      if (isProxyConnError(error)) {
        try {
          const all = await loadMembersFromLocalJson();
          const local = paginateMembers(all, params);
          console.warn('[memberApi] 代理不可用，已回退本地 JSON', {
            total: local.total,
            page: local.page
          });
          return local;
        } catch (e) {
          console.warn('[memberApi] 本地 JSON 回退失败:', e);
        }
      }
      return { success: false, message: error.message, data: [], total: 0 };
    }
  },

  // 获取单个
  async getById(id) {
    try {
      return await callCloudFunctionHTTP('adminApi', {
        action: 'get',
        data: { _id: id }
      });
    } catch (error) {
      console.error('获取详情失败:', error);
      return { success: false, message: error.message };
    }
  },

  // 创建（云库 + 本地 JSON）
  async create(data) {
    try {
      return await callProxy('/members/create', { method: 'POST', body: data });
    } catch (error) {
      console.error('创建失败:', error);
      return { success: false, message: error.message };
    }
  },

  // 更新（云库 + 本地 JSON）
  async update(id, data) {
    try {
      return await callProxy('/members/update', {
        method: 'POST',
        body: { _id: id, ...data }
      });
    } catch (error) {
      console.error('更新失败:', error);
      return { success: false, message: error.message };
    }
  },

  // 删除（云库 + 本地 JSON）
  async delete(id) {
    try {
      return await callProxy('/members/delete', {
        method: 'POST',
        body: { _id: id }
      });
    } catch (error) {
      console.error('删除失败:', error);
      return { success: false, message: error.message };
    }
  },

  // 导出全部（直连云库，无亲属补全，适合 Excel）
  async exportAll() {
    try {
      return await callProxy('/members/export-all');
    } catch (error) {
      console.error('导出失败:', error);
      if (isProxyConnError(error)) {
        try {
          const data = await loadMembersFromLocalJson();
          return { success: true, data, total: data.length, source: 'local-json' };
        } catch (e) {
          console.warn('[memberApi] 本地 JSON 回退失败:', e);
        }
      }
      return { success: false, message: error.message, data: [], total: 0 };
    }
  },

  // 批量导入
  async batchImport(members) {
    try {
      return await callCloudFunctionHTTP('adminApi', {
        action: 'batchImport',
        members
      });
    } catch (error) {
      console.error('批量导入失败:', error);
      return { success: false, message: error.message };
    }
  },

  // 清空数据
  async clearAll() {
    try {
      return await callCloudFunctionHTTP('adminApi', {
        action: 'clearAll'
      });
    } catch (error) {
      console.error('清空失败:', error);
      return { success: false, message: error.message };
    }
  },

  // 根据姓名更新（用于Excel导入，优先请用 update）
  async updateByName(name, data) {
    try {
      const result = await callCloudFunctionHTTP('adminApi', {
        action: 'updateByName',
        data: { name, ...data }
      });
      // 云函数成功后尽量同步本地：再按姓名取一次
      if (result && result.success) {
        try {
          const got = await callCloudFunctionHTTP('adminApi', {
            action: 'get',
            data: { name }
          });
          if (got && got.success && got.data && got.data._id) {
            await callProxy('/local/members/upsert', {
              method: 'POST',
              body: { ...got.data, ...data, _id: got.data._id }
            });
          }
        } catch (e) {
          console.warn('本地同步跳过:', e.message);
        }
      }
      return result;
    } catch (error) {
      console.error('按姓名更新失败:', error);
      return { success: false, message: error.message };
    }
  }
};

export default {
  memberApi
};

/**
 * 媳妇 API
 */
export const wivesApi = {
  // 获取列表
  async getList(params = {}) {
    try {
      return await callCloudFunctionHTTP('adminApi', {
        action: 'listWives',
        ...params
      });
    } catch (error) {
      console.error('获取媳妇列表失败:', error);
      return { success: false, message: error.message, data: [], total: 0 };
    }
  },

  // 获取单个
  async getById(id) {
    try {
      return await callCloudFunctionHTTP('adminApi', {
        action: 'getWife',
        data: { _id: id, wifeId: id }
      });
    } catch (error) {
      console.error('获取媳妇详情失败:', error);
      return { success: false, message: error.message };
    }
  },

  // 创建
  async create(data) {
    try {
      return await callCloudFunctionHTTP('adminApi', {
        action: 'createWife',
        data
      });
    } catch (error) {
      console.error('创建媳妇失败:', error);
      return { success: false, message: error.message };
    }
  },

  // 更新
  async update(id, data) {
    try {
      return await callCloudFunctionHTTP('adminApi', {
        action: 'updateWife',
        data: { _id: id, ...data }
      });
    } catch (error) {
      console.error('更新媳妇失败:', error);
      return { success: false, message: error.message };
    }
  },

  // 删除
  async delete(id) {
    try {
      return await callCloudFunctionHTTP('adminApi', {
        action: 'deleteWife',
        data: { _id: id }
      });
    } catch (error) {
      console.error('删除媳妇失败:', error);
      return { success: false, message: error.message };
    }
  }
};

/**
 * 女婿 API
 */
export const sonsInLawApi = {
  // 获取列表
  async getList(params = {}) {
    try {
      return await callCloudFunctionHTTP('adminApi', {
        action: 'listSonsInLaw',
        ...params
      });
    } catch (error) {
      console.error('获取女婿列表失败:', error);
      return { success: false, message: error.message, data: [], total: 0 };
    }
  },

  // 获取单个
  async getById(id) {
    try {
      return await callCloudFunctionHTTP('adminApi', {
        action: 'getSonInLaw',
        data: { _id: id }
      });
    } catch (error) {
      console.error('获取女婿详情失败:', error);
      return { success: false, message: error.message };
    }
  },

  // 创建
  async create(data) {
    try {
      return await callCloudFunctionHTTP('adminApi', {
        action: 'createSonInLaw',
        data
      });
    } catch (error) {
      console.error('创建女婿失败:', error);
      return { success: false, message: error.message };
    }
  },

  // 更新
  async update(id, data) {
    try {
      return await callCloudFunctionHTTP('adminApi', {
        action: 'updateSonInLaw',
        data: { _id: id, ...data }
      });
    } catch (error) {
      console.error('更新女婿失败:', error);
      return { success: false, message: error.message };
    }
  },

  // 删除
  async delete(id) {
    try {
      return await callCloudFunctionHTTP('adminApi', {
        action: 'deleteSonInLaw',
        data: { _id: id }
      });
    } catch (error) {
      console.error('删除女婿失败:', error);
      return { success: false, message: error.message };
    }
  }
};

/**
 * 荣誉榜 API：列表/读写走 adminApi（hydrate 族人 + 薄表字段）
 */
export const patriarchsApi = {
  async getList(params = {}) {
    return await callCloudFunctionHTTP('adminApi', { action: 'listPatriarchs', ...params });
  },
  async getById(id) {
    return await callCloudFunctionHTTP('adminApi', { action: 'getPatriarch', data: { _id: id } });
  },
  async create(data) {
    return await callCloudFunctionHTTP('adminApi', { action: 'createPatriarch', data });
  },
  async update(id, data) {
    return await callCloudFunctionHTTP('adminApi', { action: 'updatePatriarch', data: { _id: id, ...data } });
  },
  async delete(id) {
    return await callCloudFunctionHTTP('adminApi', { action: 'deletePatriarch', data: { _id: id } });
  }
};

/**
 * 乡贤 API
 */
export const sagesApi = {
  async getList(params = {}) {
    return await callCloudFunctionHTTP('adminApi', { action: 'listSages', ...params });
  },
  async getById(id) {
    return await callCloudFunctionHTTP('adminApi', { action: 'getSage', data: { _id: id } });
  },
  async create(data) {
    return await callCloudFunctionHTTP('adminApi', { action: 'createSage', data });
  },
  async update(id, data) {
    return await callCloudFunctionHTTP('adminApi', { action: 'updateSage', data: { _id: id, ...data } });
  },
  async delete(id) {
    return await callCloudFunctionHTTP('adminApi', { action: 'deleteSage', data: { _id: id } });
  }
};

/**
 * 风土志 API
 */
export const fengtuApi = {
  async getList(params = {}) {
    return await callCloudFunctionHTTP('adminApi', { action: 'listFengtu', ...params });
  },
  async getById(id) {
    return await callCloudFunctionHTTP('adminApi', { action: 'getFengtu', data: { _id: id } });
  },
  async create(data) {
    return await callCloudFunctionHTTP('adminApi', { action: 'createFengtu', data });
  },
  async update(id, data) {
    return await callCloudFunctionHTTP('adminApi', { action: 'updateFengtu', data: { _id: id, ...data } });
  },
  async delete(id) {
    return await callCloudFunctionHTTP('adminApi', { action: 'deleteFengtu', data: { _id: id } });
  }
};

/**
 * 群英 API
 */
export const spouseRepairApi = {
  async repairFromRemark(params = {}) {
    return await callCloudFunctionHTTP('adminApi', {
      action: 'repairSpouseFromRemark',
      clearWives: params.clearWives !== false
    });
  }
};

export const eliteApi = {
  async getList(params = {}) {
    return await callCloudFunctionHTTP('adminApi', { action: 'listElite', ...params });
  },
  async getById(id) {
    return await callCloudFunctionHTTP('adminApi', { action: 'getElite', data: { _id: id } });
  },
  async create(data) {
    return await callCloudFunctionHTTP('adminApi', { action: 'createElite', data });
  },
  async update(id, data) {
    return await callCloudFunctionHTTP('adminApi', { action: 'updateElite', data: { _id: id, ...data } });
  },
  async delete(id) {
    return await callCloudFunctionHTTP('adminApi', { action: 'deleteElite', data: { _id: id } });
  },
  async resetHeroes() {
    return await callCloudFunctionHTTP('adminApi', { action: 'resetEliteHeroes' });
  },
  async migrateLinks() {
    return await callCloudFunctionHTTP('adminApi', { action: 'migrateHonorMemberLinks' });
  }
};

/**
 * 学历榜 API
 */
export const graduatesApi = {
  async getEducationHonor(params = {}) {
    return await callCloudFunctionHTTP('adminApi', { action: 'listEducationHonor', ...params });
  },
  async getList(params = {}) {
    return await callCloudFunctionHTTP('adminApi', { action: 'listGraduates', ...params });
  },
  async getByYear(params = {}) {
    return await callCloudFunctionHTTP('adminApi', { action: 'getGraduatesByYear', ...params });
  },
  async getById(id) {
    return await callCloudFunctionHTTP('adminApi', { action: 'getGraduate', data: { _id: id } });
  },
  async create(data) {
    return await callCloudFunctionHTTP('adminApi', { action: 'createGraduate', data });
  },
  async update(id, data) {
    return await callCloudFunctionHTTP('adminApi', { action: 'updateGraduate', data: { _id: id, ...data } });
  },
  async delete(id) {
    return await callCloudFunctionHTTP('adminApi', { action: 'deleteGraduate', data: { _id: id } });
  }
};

/**
 * 谱树 API
 */
export const familyTreeApi = {
  async getTree(params = {}) {
    return await callCloudFunctionHTTP('adminApi', { action: 'getFamilyTree', ...params });
  }
};

/**
 * 运营管理：登录账号 / 开发者留言
 */
export const opsApi = {
  async listAccounts(params = {}) {
    try {
      return await callCloudFunctionHTTP('adminApi', { action: 'listAccounts', ...params });
    } catch (error) {
      console.error('获取登录账号失败:', error);
      return { success: false, message: error.message, data: [], total: 0 };
    }
  },
  async forceUnbindAccount(accountId) {
    try {
      return await callCloudFunctionHTTP('adminApi', {
        action: 'forceUnbindAccount',
        data: { _id: accountId }
      });
    } catch (error) {
      console.error('强制解绑失败:', error);
      return { success: false, message: error.message };
    }
  },
  async listDevMessages(params = {}) {
    try {
      return await callCloudFunctionHTTP('adminApi', { action: 'listDevMessages', ...params });
    } catch (error) {
      console.error('获取留言失败:', error);
      return { success: false, message: error.message, data: [], total: 0 };
    }
  },
  async markDevMessageRead(id) {
    try {
      return await callCloudFunctionHTTP('adminApi', {
        action: 'markDevMessageRead',
        data: { _id: id }
      });
    } catch (error) {
      console.error('标记已读失败:', error);
      return { success: false, message: error.message };
    }
  },
  async getOpsStats() {
    try {
      return await callCloudFunctionHTTP('adminApi', { action: 'getOpsStats' });
    } catch (error) {
      console.error('获取运营统计失败:', error);
      return { success: false, message: error.message, data: {} };
    }
  }
};

export async function initCloud() {
  const url = PROXY_URL;
  console.log('使用本地代理访问云函数:', url);
  try {
    const res = await fetch(`${url}/`, { method: 'GET' });
    if (!res.ok) {
      console.warn('[initCloud] 代理健康检查异常 HTTP', res.status);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[initCloud] 代理未连接，列表将尝试本地 JSON 回退。', error.message || error);
    return false;
  }
}
