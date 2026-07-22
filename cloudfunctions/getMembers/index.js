// 云函数入口文件
const cloud = require('wx-server-sdk');
const { buildBeiweiIndex, displayNameChar } = require('./nameInitial');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

const BRANCH_CODE_MAP = {
  '中和堂': 'zhonghe',
  '明儒堂': 'mingru',
  '德裕堂': 'deyu',
  '忠爱堂': 'zhongshou'
};

const DEFAULT_PAGE_SIZE = 30;

/** 辈分字索引缓存（冷启动内复用） */
let cachedBeiweiIndex = null;
let cachedBeiweiAt = 0;
const BEIWEI_TTL_MS = 10 * 60 * 1000;

async function loadBeiweiIndex() {
  const now = Date.now();
  if (cachedBeiweiIndex && now - cachedBeiweiAt < BEIWEI_TTL_MS) {
    return cachedBeiweiIndex;
  }
  // 仅拉姓名+世系+堂份，用于表决辈字位置
  const names = [];
  const pageSize = 100;
  let skip = 0;
  for (;;) {
    const { data } = await db.collection('members')
      .field({ name: true, generation: true, branch: true })
      .skip(skip)
      .limit(pageSize)
      .get();
    if (!data.length) break;
    names.push(...data);
    if (data.length < pageSize || names.length >= 5000) break;
    skip += pageSize;
  }
  cachedBeiweiIndex = buildBeiweiIndex(names);
  cachedBeiweiAt = now;
  return cachedBeiweiIndex;
}

async function fetchAllMembers(whereCondition) {
  const MAX_LIMIT = 100;
  const countResult = await db.collection('members').where(whereCondition).count();
  const total = countResult.total;
  const batchTimes = Math.ceil(total / MAX_LIMIT);
  const tasks = [];

  for (let i = 0; i < batchTimes; i++) {
    tasks.push(
      db.collection('members')
        .where(whereCondition)
        .orderBy('generation', 'asc')
        .orderBy('createdAt', 'asc')
        .skip(i * MAX_LIMIT)
        .limit(MAX_LIMIT)
        .get()
    );
  }

  const results = await Promise.all(tasks);
  return results.reduce((acc, cur) => acc.concat(cur.data), []);
}

function buildFatherMap(members, fatherRecords) {
  const map = Object.create(null);
  fatherRecords.forEach(item => {
    if (item.originalId != null) map[String(item.originalId)] = item.name;
    if (item.memberId) map[item.memberId] = item.name;
  });
  return map;
}

function toListItem(member, fatherMap, beiweiIndex) {
  const item = {
    _id: member._id,
    name: member.name,
    generation: member.generation,
    branch: member.branch,
    branchCode: BRANCH_CODE_MAP[member.branch] || 'zhonghe',
    gender: member.gender,
    hasBrokenLineage: !!member.hasBrokenLineage,
    fatherName: member.fatherName || ''
  };

  if (!item.fatherName && member.fatherId) {
    item.fatherName = fatherMap[String(member.fatherId)] || '';
  }

  if (member.birthDate && member.birthDate.lunar && member.birthDate.lunar.year) {
    item.birthYear = member.birthDate.lunar.year;
  }

  item.displayInitial = displayNameChar(member.name, {
    generation: member.generation,
    branch: member.branch,
    index: beiweiIndex
  });

  return item;
}

exports.main = async (event) => {
  const { branch, generation, page = 1, pageSize = DEFAULT_PAGE_SIZE, getAll = false } = event;

  try {
    const whereCondition = {};
    if (generation) whereCondition.generation = generation;
    if (branch) whereCondition.branch = branch;

    let allData;
    if (getAll) {
      allData = await fetchAllMembers(whereCondition);
    } else {
      const { data } = await db.collection('members')
        .where(whereCondition)
        .orderBy('generation', 'asc')
        .orderBy('createdAt', 'asc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get();
      allData = data;
    }

    const countResult = await db.collection('members').where(whereCondition).count();
    const total = countResult.total;

    const fatherIds = [...new Set(allData.map(m => m.fatherId).filter(Boolean))];
    let fatherMap = Object.create(null);

    if (fatherIds.length) {
      const numericIds = fatherIds.map(id => Number(id)).filter(id => !Number.isNaN(id));
      const { data: fathersByOriginal } = numericIds.length
        ? await db.collection('members').where({ originalId: _.in(numericIds) }).field({ originalId: true, memberId: true, name: true }).get()
        : { data: [] };
      const { data: fathersByMemberId } = await db.collection('members').where({ memberId: _.in(fatherIds) }).field({ originalId: true, memberId: true, name: true }).get();
      fatherMap = buildFatherMap(allData, fathersByOriginal.concat(fathersByMemberId));
    }

    const beiweiIndex = await loadBeiweiIndex().catch(() => null);
    const enrichedData = allData.map(member => toListItem(member, fatherMap, beiweiIndex));

    if (getAll) {
      return { success: true, data: enrichedData, total };
    }

    return {
      success: true,
      data: enrichedData,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total
    };
  } catch (err) {
    console.error('查询失败', err);
    return {
      success: false,
      message: err.message
    };
  }
};
