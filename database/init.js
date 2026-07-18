// 数据库初始化数据
// 用于测试的示例数据

const testMembers = [
  // 中和堂（1-18代）- 示例数据
  {
    name: "罗始祖",
    generation: 1,
    branch: "中和堂",
    gender: "男",
    isAlive: false,
    fatherId: null,
    hasBrokenLineage: false,
    biography: "高洲罗氏始祖",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: "罗某某",
    generation: 18,
    branch: "中和堂",
    gender: "男",
    isAlive: false,
    fatherId: null, // 实际应该指向17代
    hasBrokenLineage: false,
    biography: "18代三兄弟之一，明儒堂始祖",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  
  // 明儒堂（19-40代）- 示例数据
  {
    name: "罗明儒",
    generation: 19,
    branch: "明儒堂",
    gender: "男",
    isAlive: false,
    fatherId: null, // 指向18代
    hasBrokenLineage: false,
    biography: "明儒堂始祖",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: "罗测试A",
    generation: 25,
    branch: "明儒堂",
    gender: "男",
    isAlive: true,
    fatherId: null,
    hasBrokenLineage: true,
    brokenLineageNote: "历史原因，父辈记录缺失，疑似24代某支",
    estimatedFatherName: "罗某（待考）",
    estimatedFatherGeneration: 24,
    birthplace: "广东梅州",
    residence: "深圳",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: "罗测试B",
    generation: 26,
    branch: "明儒堂",
    gender: "男",
    isAlive: true,
    fatherId: null, // 实际应该指向测试A
    hasBrokenLineage: false,
    birthplace: "深圳",
    residence: "深圳",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  
  // 德裕堂（19-40代）- 示例数据
  {
    name: "罗德裕",
    generation: 19,
    branch: "德裕堂",
    gender: "男",
    isAlive: false,
    hasBrokenLineage: false,
    biography: "德裕堂始祖",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: "罗测试C",
    generation: 28,
    branch: "德裕堂",
    gender: "男",
    isAlive: true,
    hasBrokenLineage: false,
    birthplace: "广东梅州",
    residence: "广州",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  
  // 忠爱堂（19-40代）- 示例数据
  {
    name: "罗忠受",
    generation: 19,
    branch: "忠爱堂",
    gender: "男",
    isAlive: false,
    hasBrokenLineage: false,
    biography: "忠爱堂始祖",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: "罗测试D",
    generation: 30,
    branch: "忠爱堂",
    gender: "女",
    isAlive: true,
    hasBrokenLineage: true,
    brokenLineageNote: "外迁失联多年后回归，父辈信息待考证",
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// 导出数据
module.exports = testMembers;

/*
使用说明：
1. 打开微信开发者工具的云开发控制台
2. 进入"数据库" → 创建集合 members
3. 点击"添加记录" → "导入JSON"
4. 将上面的数据复制进去（去掉注释）

或者使用云函数初始化：
*/

// 初始化云函数（可选）
const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

async function initDatabase() {
  for (const member of testMembers) {
    await db.collection('members').add({
      data: member
    });
  }
  console.log('初始化完成');
}