/**
 * 家庭管理权限：本人 + 直系（父母/配偶/子女）
 * 已认证成员（本人除外）禁止被他人增删改
 */

const RELATION = {
  SELF: 'self',
  PARENT: 'parent',
  SPOUSE: 'spouse',
  CHILD: 'child',
  NONE: 'none'
};

function oid(v) {
  if (v == null || v === '') return '';
  return String(v);
}

function memberKey(m) {
  if (!m) return '';
  if (m.originalId != null && m.originalId !== '') return oid(m.originalId);
  if (m.memberId) return oid(m.memberId);
  return '';
}

/**
 * @param {object} viewer 当前登录对应的 members 记录
 * @param {object} target 目标 members 记录
 * @returns {string} RELATION.*
 */
function resolveRelation(viewer, target) {
  if (!viewer || !target) return RELATION.NONE;
  const vid = viewer._id != null ? String(viewer._id) : '';
  const tid = target._id != null ? String(target._id) : '';
  if (vid && tid && vid === tid) return RELATION.SELF;

  const vKey = memberKey(viewer);
  const tKey = memberKey(target);
  if (vKey && tKey && vKey === tKey) return RELATION.SELF;

  // 子女：目标的父亲是自己
  if (vKey && oid(target.fatherId) === vKey) return RELATION.CHILD;

  // 父母：自己的父亲是目标
  if (tKey && oid(viewer.fatherId) === tKey) return RELATION.PARENT;

  // 配偶：双向 spouseId（本村）
  if (vKey && oid(target.spouseId) === vKey) return RELATION.SPOUSE;
  if (tKey && oid(viewer.spouseId) === tKey) return RELATION.SPOUSE;

  return RELATION.NONE;
}

/**
 * @param {object} opts
 * @param {object} opts.viewerMember
 * @param {object} opts.targetMember
 * @param {boolean} opts.targetVerified 目标是否已绑定账号
 * @returns {{ relation, canEdit, canDelete, canAddChild, canAddSpouse, locked, lockReason }}
 */
function evaluatePermission(opts) {
  const viewer = opts.viewerMember;
  const target = opts.targetMember;
  const targetVerified = !!opts.targetVerified;
  const relation = resolveRelation(viewer, target);

  const empty = {
    relation,
    canEdit: false,
    canDelete: false,
    canAddChild: false,
    canAddSpouse: false,
    locked: false,
    lockReason: ''
  };

  if (!viewer || !target) return empty;

  // 已认证且非本人：完全锁定
  if (targetVerified && relation !== RELATION.SELF) {
    return Object.assign({}, empty, {
      locked: true,
      lockReason: '该成员已经完成身份认证，资料修改需要本人操作。'
    });
  }

  if (relation === RELATION.NONE) {
    return empty;
  }

  if (relation === RELATION.SELF) {
    return {
      relation,
      canEdit: true,
      canDelete: false,
      canAddChild: true,
      canAddSpouse: true,
      locked: false,
      lockReason: ''
    };
  }

  // 直系：父母 / 配偶 / 子女 —— 可改；仅未认证的配偶、子女可删
  const canDelete = (relation === RELATION.SPOUSE || relation === RELATION.CHILD)
    && !targetVerified;

  return {
    relation,
    canEdit: true,
    canDelete,
    canAddChild: false,
    canAddSpouse: false,
    locked: false,
    lockReason: ''
  };
}

/** 允许用户修改的字段白名单 */
const EDITABLE_FIELDS = [
  'name',
  'gender',
  'phone',
  'wechat',
  'residence',
  'burialPlace',
  'remark',
  'photo',
  'avatar',
  'education',
  'honors',
  'positions',
  'workplaces',
  'birthDate',
  'deathDate'
];

const MAX_MULTI = 5;

function normalizeMultiList(list, mapFn) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_MULTI).map(mapFn).filter(Boolean);
}

function pickEditable(patch) {
  const out = {};
  EDITABLE_FIELDS.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      out[key] = patch[key];
    }
  });

  // 完整 birthDate 对象优先
  if (patch.birthDate && typeof patch.birthDate === 'object') {
    out.birthDate = patch.birthDate;
  } else if (patch.calendarType === 'gregorian' && patch.gYear) {
    try {
      const { fromGregorian } = require('./dateConvert');
      const full = fromGregorian(patch.gYear, patch.gMonth, patch.gDay);
      if (full) out.birthDate = full;
    } catch (e) { /* ignore */ }
  } else if (patch.calendarType === 'lunar' && patch.birthLunarYear) {
    try {
      const { fromLunar } = require('./dateConvert');
      const full = fromLunar(
        patch.birthLunarYear,
        patch.birthLunarMonth,
        patch.birthLunarDay,
        patch.birthLunarIsLeap
      );
      if (full) out.birthDate = full;
    } catch (e) {
      out.birthDate = {
        lunar: {
          year: Number(patch.birthLunarYear) || null,
          month: Number(patch.birthLunarMonth) || null,
          day: Number(patch.birthLunarDay) || null,
          isLeap: !!patch.birthLunarIsLeap
        }
      };
    }
  }

  if (Array.isArray(patch.education)) {
    out.education = normalizeMultiList(patch.education, e => {
      if (!e) return null;
      if (typeof e === 'string') {
        const t = e.trim();
        return t ? { degree: t, school: '', isDefault: false } : null;
      }
      const degree = String(e.degree || '').trim();
      const school = String(e.school || '').trim();
      if (!degree && !school) return null;
      let year = null;
      if (e.year != null && e.year !== '') {
        const n = Number(e.year);
        year = Number.isFinite(n) ? n : null;
      }
      return {
        degree,
        school,
        year,
        major: String(e.major || '').trim(),
        isDefault: !!e.isDefault
      };
    });
  }

  if (Array.isArray(patch.honors)) {
    out.honors = normalizeMultiList(patch.honors, h => {
      if (!h) return null;
      if (typeof h === 'string') {
        const t = h.trim();
        return t ? { title: t, type: 'user', description: t } : null;
      }
      const title = String(h.title || h.name || '').trim();
      if (!title) return null;
      return { title, type: h.type || 'user', description: title };
    });
  }

  if (Array.isArray(patch.positions)) {
    out.positions = normalizeMultiList(patch.positions, p => {
      if (!p) return null;
      if (typeof p === 'string') {
        const t = p.trim();
        return t ? { title: t, isCurrent: false, isDefault: false } : null;
      }
      const title = String(p.title || '').trim();
      if (!title) return null;
      return { title, isCurrent: !!p.isCurrent, isDefault: !!p.isDefault };
    });
  }

  if (Array.isArray(patch.workplaces)) {
    out.workplaces = normalizeMultiList(patch.workplaces, w => {
      if (!w) return null;
      if (typeof w === 'string') {
        const t = w.trim();
        return t ? { name: t, isCurrent: false } : null;
      }
      const name = String(w.name || w.organization || '').trim();
      if (!name) return null;
      return {
        name,
        title: String(w.title || '').trim(),
        isCurrent: !!w.isCurrent
      };
    });
  }

  return out;
}

module.exports = {
  RELATION,
  resolveRelation,
  evaluatePermission,
  EDITABLE_FIELDS,
  MAX_MULTI,
  pickEditable,
  memberKey,
  oid
};
