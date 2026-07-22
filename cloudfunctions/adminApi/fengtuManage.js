/**
 * 风土志 CRUD（云集合 fengtu）
 */
const SEED = require('./fengtu_seed.json');

function createFengtuManage({ db, cloud, ensureCollection, isCollectionMissingError, safeCollectionCount }) {
  const COL = 'fengtu';

  function pickDoc(data = {}) {
    const layout = ['classic', 'plain', 'poem'].includes(data.layout) ? data.layout : 'plain';
    const scenes = Array.isArray(data.scenes)
      ? data.scenes.map(s => ({
        title: String((s && s.title) || '').trim(),
        poem: String((s && s.poem) || ''),
        image: String((s && s.image) || '').trim()
      })).filter(s => s.title || s.poem || s.image)
      : [];
    const images = Array.isArray(data.images) && data.images.length
      ? data.images.map(String).filter(Boolean)
      : scenes.map(s => s.image).filter(Boolean);
    return {
      layout,
      title: String(data.title || '').trim(),
      authorName: String(data.authorName || '').trim(),
      authorGeneration: String(data.authorGeneration || '').trim(),
      dynasty: String(data.dynasty || '').trim(),
      year: String(data.year || '').trim(),
      summary: String(data.summary || '').trim(),
      original: String(data.original || ''),
      translation: String(data.translation || ''),
      notes: String(data.notes || ''),
      content: String(data.content || ''),
      images,
      scenes,
      sortOrder: Number(data.sortOrder) || 0,
      published: data.published !== false,
      seedId: data.seedId ? String(data.seedId) : ''
    };
  }

  /** 按 seedId 覆盖更新（用于八景配图升级） */
  async function upsertFengtuSeed(seedId) {
    await ensureCollection(COL);
    const seed = (SEED || []).find(x => x.seedId === seedId);
    if (!seed) return { success: false, message: '种子不存在: ' + seedId };
    const doc = pickDoc(seed);
    doc.seedId = seedId;
    doc.updatedAt = db.serverDate();
    const found = await db.collection(COL).where({ seedId }).limit(1).get();
    if (found.data && found.data.length) {
      await db.collection(COL).doc(found.data[0]._id).update({ data: doc });
      return { success: true, message: '已更新', data: { _id: found.data[0]._id } };
    }
    doc.createdAt = db.serverDate();
    const addRes = await db.collection(COL).add({ data: doc });
    return { success: true, message: '已创建', data: { _id: addRes._id || addRes.id } };
  }

  async function seedFengtuIfEmpty() {
    await ensureCollection(COL);
    const total = await safeCollectionCount(COL);
    if (total > 0) return 0;
    let added = 0;
    for (const item of SEED) {
      const doc = pickDoc(item);
      doc.seedId = item.seedId || '';
      doc.sortOrder = item.sortOrder || added + 1;
      doc.createdAt = db.serverDate();
      doc.updatedAt = db.serverDate();
      await db.collection(COL).add({ data: doc });
      added++;
    }
    return added;
  }

  async function listFengtu(params = {}) {
    await ensureCollection(COL);
    let total = await safeCollectionCount(COL);
    if (total === 0) {
      await seedFengtuIfEmpty();
      total = await safeCollectionCount(COL);
    }
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 50));
    const where = {};
    if (params.publishedOnly) where.published = true;

    let query = db.collection(COL).where(where);
    try {
      const countRes = await query.count();
      total = countRes.total;
    } catch (e) {
      if (isCollectionMissingError(e)) {
        await ensureCollection(COL);
        total = 0;
      } else throw e;
    }

    let data = [];
    try {
      const res = await query
        .orderBy('sortOrder', 'asc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get();
      data = res.data || [];
    } catch (e) {
      // 无索引时降级
      const res = await db.collection(COL).skip((page - 1) * pageSize).limit(pageSize).get();
      data = (res.data || []).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }

    return { success: true, data, total, page, pageSize };
  }

  async function getFengtu(data = {}) {
    if (!data._id) return { success: false, message: '缺少文章 ID' };
    try {
      const { data: item } = await db.collection(COL).doc(String(data._id)).get();
      if (!item) return { success: false, message: '未找到该文章' };
      return { success: true, data: item };
    } catch (err) {
      return { success: false, message: err.message || '读取失败' };
    }
  }

  async function createFengtu(data = {}) {
    try {
      await ensureCollection(COL);
      const doc = pickDoc(data);
      if (!doc.title) return { success: false, message: '请填写标题' };
      doc.createdAt = db.serverDate();
      doc.updatedAt = db.serverDate();
      const result = await db.collection(COL).add({ data: doc });
      return { success: true, data: { _id: result._id || result.id } };
    } catch (err) {
      return { success: false, message: err.message || '创建失败' };
    }
  }

  async function updateFengtu(data = {}) {
    if (!data._id) return { success: false, message: '缺少文章 ID' };
    try {
      const doc = pickDoc(data);
      if (!doc.title) return { success: false, message: '请填写标题' };
      doc.updatedAt = db.serverDate();
      await db.collection(COL).doc(String(data._id)).update({ data: doc });
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message || '更新失败' };
    }
  }

  async function deleteFengtu(data = {}) {
    if (!data._id) return { success: false, message: '缺少文章 ID' };
    try {
      await db.collection(COL).doc(String(data._id)).remove();
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message || '删除失败' };
    }
  }

  return {
    listFengtu,
    getFengtu,
    createFengtu,
    updateFengtu,
    deleteFengtu,
    seedFengtuIfEmpty,
    upsertFengtuSeed
  };
}

module.exports = { createFengtuManage };
