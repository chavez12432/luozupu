/**
 * 四堂世系图布局
 * - 无排行标注
 * - fatherId→originalId；父辈 branch 为脏数据（纯数字）仍衔接
 * - 无父可考：断代支，同世代放置，上方画虚线缺口 +「断」
 */

const GEN_CN = [
  '', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '二十一', '二十二', '二十三', '二十四', '二十五', '二十六', '二十七', '二十八', '二十九', '三十',
  '三十一', '三十二', '三十三', '三十四', '三十五', '三十六', '三十七', '三十八', '三十九', '四十'
];

function genLabel(n) {
  const g = Number(n) || 0;
  return GEN_CN[g] ? `${GEN_CN[g]}世` : `${g}世`;
}

function spouseText(_m) {
  // 世系图仅展示族人姓名，不显示妻子
  return '';
}

function compareMemberKey(a, b) {
  const ao = String((a && (a.originalId || a.memberId)) || '');
  const bo = String((b && (b.originalId || b.memberId)) || '');
  return ao.localeCompare(bo, undefined, { numeric: true });
}

function isDirtyBranch(branch) {
  return branch != null && branch !== '' && /^\d+$/.test(String(branch));
}

function buildPedigreeLayout(members, branch, options = {}) {
  const ROW_H = options.rowH || 118;
  const PAD_L = options.padL || 64;
  const PAD_T = options.padT || 24;
  const PAD_R = options.padR || 20;
  const PAD_B = options.padB || 36;
  const GAP_FOREST = options.gapForest != null ? options.gapForest : 1.2;
  const MAX_CANVAS_W = options.maxCanvasW || 3600;

  const allByOrig = Object.create(null);
  const allByMemberId = Object.create(null);
  (members || []).forEach(m => {
    if (m.originalId != null) allByOrig[String(m.originalId)] = m;
    if (m.memberId) allByMemberId[m.memberId] = m;
  });

  const hallMembers = (members || []).filter(m => m.branch === branch);
  const nodeMap = Object.create(null);

  function ensureNode(m) {
    if (!m || !m._id) return null;
    if (nodeMap[m._id]) return nodeMap[m._id];
    const dirty = isDirtyBranch(m.branch);
    const node = {
      id: m._id,
      originalId: m.originalId,
      memberId: m.memberId || '',
      name: m.name || '',
      generation: Number(m.generation) || 0,
      branch: m.branch || '',
      spouse: spouseText(m),
      gender: m.gender || '',
      isAux: m.branch !== branch,
      dirtyBranch: dirty,
      broken: false,
      fatherId: null,
      children: [],
      x: 0,
      subtreeLeft: 0,
      subtreeRight: 0
    };
    nodeMap[m._id] = node;
    return node;
  }

  hallMembers.forEach(m => ensureNode(m));

  hallMembers.forEach(m => {
    const node = nodeMap[m._id];
    if (m.fatherId === '' || m.fatherId == null) return;
    const key = String(m.fatherId);
    let father = allByOrig[key]
      || allByMemberId[key]
      || allByMemberId[`M${String(key).padStart(6, '0')}`];
    if (!father) return;

    const fatherDirty = isDirtyBranch(father.branch);
    if (father.branch && father.branch !== branch && !fatherDirty) {
      node.crossFatherName = father.name;
      return;
    }
    const fNode = ensureNode(father);
    node.fatherId = fNode.id;
    if (!fNode.children.includes(node.id)) fNode.children.push(node.id);
  });

  Object.keys(nodeMap).forEach(id => {
    const n = nodeMap[id];
    n.children.sort((a, b) => compareMemberKey(nodeMap[a], nodeMap[b]));
  });

  const roots = [];
  Object.keys(nodeMap).forEach(id => {
    const n = nodeMap[id];
    if (n.isAux && !n.dirtyBranch) return;
    if (!n.fatherId || !nodeMap[n.fatherId]) {
      n.broken = n.generation > 1 || !!n.crossFatherName;
      // 仅本堂成员可作展示根；脏数据辅助父不单独作根展示（被子女挂上即可）
      if (!n.isAux || n.dirtyBranch) {
        if (!n.isAux) roots.push(n);
      }
    }
  });

  // 若脏数据父亲自己成根且无上级，也挂入，避免漏节点
  Object.keys(nodeMap).forEach(id => {
    const n = nodeMap[id];
    if (!n.dirtyBranch) return;
    if ((!n.fatherId || !nodeMap[n.fatherId]) && !roots.find(r => r.id === n.id)) {
      n.broken = true;
      roots.push(n);
    }
  });

  let minGen = Infinity;
  let maxGen = 0;
  Object.keys(nodeMap).forEach(id => {
    const g = nodeMap[id].generation;
    if (!g) return;
    if (g < minGen) minGen = g;
    if (g > maxGen) maxGen = g;
  });
  if (!Number.isFinite(minGen)) minGen = 1;

  const primaryRoots = roots
    .filter(r => !r.broken || r.generation === minGen)
    .sort((a, b) => a.generation - b.generation || compareMemberKey(a, b));
  const brokenRoots = roots
    .filter(r => r.broken && r.generation !== minGen)
    .sort((a, b) => a.generation - b.generation || compareMemberKey(a, b));
  const orderedRoots = primaryRoots.concat(brokenRoots);

  function leafCount(node, memo) {
    if (memo[node.id] != null) return memo[node.id];
    const kids = node.children.map(cid => nodeMap[cid]).filter(Boolean);
    if (!kids.length) {
      memo[node.id] = 1;
      return 1;
    }
    let sum = 0;
    kids.forEach(k => { sum += leafCount(k, memo); });
    memo[node.id] = Math.max(1, sum);
    return memo[node.id];
  }

  function place(node, leftSlot, memo) {
    const kids = node.children.map(cid => nodeMap[cid]).filter(Boolean);
    if (!kids.length) {
      node.x = leftSlot + 0.5;
      node.subtreeLeft = leftSlot;
      node.subtreeRight = leftSlot + 1;
      return leftSlot + 1;
    }
    let cursor = leftSlot;
    kids.forEach(k => {
      cursor = place(k, cursor, memo);
    });
    node.subtreeLeft = leftSlot;
    node.subtreeRight = cursor;
    node.x = (kids[0].x + kids[kids.length - 1].x) / 2;
    return cursor;
  }

  let slot = 0;
  const forests = [];
  orderedRoots.forEach((root, i) => {
    if (i > 0) slot += GAP_FOREST;
    const start = slot;
    const memo = Object.create(null);
    slot = place(root, slot, memo);
    forests.push({
      rootId: root.id,
      broken: !!root.broken,
      generation: root.generation,
      left: start,
      right: slot
    });
  });

  const COL_W = Math.max(10, Math.min(36, Math.floor((MAX_CANVAS_W - PAD_L - PAD_R) / Math.max(slot, 1))));

  const nodes = [];
  Object.keys(nodeMap).forEach(id => {
    const n = nodeMap[id];
    if (n.isAux && !n.dirtyBranch) return;
    n.px = PAD_L + n.x * COL_W;
    n.py = PAD_T + (n.generation - minGen) * ROW_H;
    nodes.push(n);
  });

  const edges = [];
  const nodeIdSet = Object.create(null);
  nodes.forEach(n => { nodeIdSet[n.id] = true; });
  nodes.forEach(n => {
    if (!n.fatherId || !nodeIdSet[n.fatherId]) return;
    edges.push({ from: n.fatherId, to: n.id });
  });

  const width = Math.ceil(PAD_L + Math.max(slot, 1) * COL_W + PAD_R);
  const height = Math.ceil(PAD_T + (maxGen - minGen + 1) * ROW_H + PAD_B);

  const genLabels = [];
  for (let g = minGen; g <= maxGen; g++) {
    genLabels.push({
      generation: g,
      label: genLabel(g),
      y: PAD_T + (g - minGen) * ROW_H
    });
  }

  // 世系图仅展示，不提供点击跳转热区
  const hitAreas = [];

  return {
    nodes,
    edges,
    forests,
    genLabels,
    minGen,
    maxGen,
    width,
    height,
    colW: COL_W,
    rowH: ROW_H,
    padL: PAD_L,
    padT: PAD_T,
    stats: {
      total: hallMembers.length,
      brokenRoots: brokenRoots.length,
      minGen,
      maxGen
    },
    hitAreas
  };
}

/** Canvas 绘制世系图 */
function drawPedigree(ctx, layout, options = {}) {
  const {
    nodes, edges, forests, genLabels, width, height, colW, rowH, padL
  } = layout;
  const lineColor = options.lineColor || '#c62828';
  const nameColor = options.nameColor || '#222';
  const brokenColor = options.brokenColor || '#b0a090';
  const labelColor = options.labelColor || '#8d6e63';
  const fontSize = Math.max(10, Math.min(15, Math.floor(colW * 0.42)));

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#fffef9';
  ctx.fillRect(0, 0, width, height);

  // 世代横虚线（浅）
  ctx.strokeStyle = '#f0ebe3';
  ctx.lineWidth = 1;
  genLabels.forEach(g => {
    ctx.beginPath();
    ctx.moveTo(padL - 8, g.y + fontSize);
    ctx.lineTo(width - 8, g.y + fontSize);
    ctx.stroke();
  });

  // 左侧世代标签
  ctx.fillStyle = labelColor;
  ctx.font = `bold ${Math.max(11, fontSize)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  genLabels.forEach(g => {
    ctx.fillText(g.label, 8, g.y);
  });

  const byId = Object.create(null);
  nodes.forEach(n => { byId[n.id] = n; });

  // 连线：父→子 括号式
  edges.forEach(e => {
    const f = byId[e.from];
    const c = byId[e.to];
    if (!f || !c) return;
    const fx = f.px;
    const fy = f.py + fontSize * Math.min(f.name.length, 6) + 6;
    const cx = c.px;
    const cy = c.py - 2;
    const midY = (fy + cy) / 2;

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx, midY);
    ctx.lineTo(cx, midY);
    ctx.lineTo(cx, cy);
    ctx.stroke();
  });

  // 断代根：上方小虚线 +「断」
  forests.filter(f => f.broken).forEach(forest => {
    const root = byId[forest.rootId];
    if (!root) return;
    const x = root.px;
    const y = root.py - 4;
    ctx.strokeStyle = brokenColor;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y - 16);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = brokenColor;
    ctx.font = `${Math.max(9, fontSize - 2)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('断', x, y - 28);
  });

  // 人名竖排（仅族人，不绘制妻子）
  nodes.forEach(n => {
    const chars = String(n.name || '').split('');
    ctx.fillStyle = n.broken ? '#5d4037' : nameColor;
    ctx.font = `bold ${fontSize}px "Songti SC", "SimSun", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    chars.forEach((ch, i) => {
      ctx.fillText(ch, n.px, n.py + i * (fontSize + 1));
    });
  });

  // 底部图例
  ctx.fillStyle = '#8d6e63';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('虚线「断」：未与上一世续上，作为该世新支并列', 8, height - 18);
}

module.exports = {
  genLabel,
  buildPedigreeLayout,
  drawPedigree,
  GEN_CN
};
