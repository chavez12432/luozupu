/**
 * 谱树首页四堂入口（静态快照，进入分堂后再拉最新成员数据）
 * 人数有变动时可改此文件，或重新跑人员导入后更新数字。
 */
const FAMILY_TREE_HALLS = [
  { branch: '中和堂', total: 42, minGen: 1, maxGen: 20 },
  { branch: '明儒堂', total: 596, minGen: 18, maxGen: 37 },
  { branch: '德裕堂', total: 462, minGen: 18, maxGen: 37 },
  { branch: '忠爱堂', total: 309, minGen: 18, maxGen: 34 }
];

module.exports = {
  FAMILY_TREE_HALLS
};
