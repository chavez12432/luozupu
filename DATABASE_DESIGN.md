# 高洲罗氏族谱数据库设计方案

> 人员三表（members / wives / sons_in_law）以 `D:\家谱\database` 四张 Excel 为权威源重建。  
> ID 形态：族人 `M####` / `C####`；外姓妻 `…W##`；外姓婿 `…S##`；本村配偶直接使用对方族人 ID。  
> `memberId` 与 `originalId` 同为上述字符串 ID。序文、年号、荣誉、认证集合不在此重建范围内。

## 一、数据表结构

### 1. members（罗氏族人主表）

```javascript
{
  _id: String,                    // 与 memberId 相同（本地）；云端导入后可为自动 _id
  memberId: String,               // 业务 ID，如 M0001 / C0251
  originalId: String,             // 同 memberId（兼容按 originalId 查询）
  name: String,
  gender: String,                 // 男/女/未知
  generation: Number,
  branch: String,                 // 中和堂/明儒堂/德裕堂/忠爱堂
  eraCategory: String,            // ancient | modern（按源表文件归属）

  fatherId: String,               // 父 memberId
  fatherName: String,
  motherId: String,               // 多指向 wives.wifeId；本村母可为族人 ID
  motherName: String,
  childrenIds: [String],          // 由 fatherId 反向生成

  spouseId: String,               // 首个配偶 ID（妻表 ID 或本村族人 ID）
  spouseIds: [String],
  wifeIds: [String],              // 兼容旧字段，同 spouseIds
  spouseName: String,             // 展示名（以妻表为准）
  spouseInfo: [{                  // 由妻子表生成
    name, type, hometown, wifeId,
    isSameVillage: Boolean,
    linkedMemberId: String
  }],
  clanSpouseId: String,           // 本村配偶族人 ID（若有）
  sonInLawIds: [String],
  sonInLawNames: [String],

  residence: String,
  burialPlace: String,
  lifespan: String,
  birthDate: { lunar, gregorian, dynasty, ganzhi, zodiac, constellation, raw, converted },
  deathDate: { /* 同上 */ },
  isAlive: Boolean,

  phone: String,                  // 现代
  wechat: String,
  education: [{ degree, school, year, isDefault }],
  positions: [{ title, organization, isDefault, isCurrent }],
  honors: [{ title, type }],
  gongming: String,               // 古代功名原文
  guanzhi: String,                // 古代官职原文
  avatar: String,
  photoGallery: [String],
  remark: String,                 // 个人详情

  hasBrokenLineage: Boolean,
  isPublic: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### 2. wives（妻子表 — 男性族人配偶；含本村女）

```javascript
{
  _id: String,
  wifeId: String,                 // 如 M0001W01；本村人则为族人 ID
  name: String,
  maidenName: String,
  hometown: String,
  generation: Number,             // 外姓妻与夫同代；本村女可保留自身世代
  husbandId: String,              // 丈夫 memberId
  husbandName: String,
  birthText: String,              // 源表原文日期串
  deathText: String,
  burialPlace: String,
  marriageType: String,           // 配/继配/续配…
  marriageOrder: Number,
  marriageStatus: String,         // married 等
  isSameVillage: Boolean,
  linkedMemberId: String,         // 本村时 = 女方 memberId
  remark: String,
  sourceMemberId: String,
  createdAt: Date,
  updatedAt: Date
}
```

**婚配类型：** 配 / 元配 / 继配 / 次配 / 续配 等，见源表「婚配类型」「婚配序号」。

### 3. sons_in_law（女婿表 — 女性族人配偶；含本村男）

```javascript
{
  _id: String,
  sonInLawId: String,             // 如 M0490S01；本村人则为族人 ID
  name: String,
  hometown: String,
  generation: Number,
  wifeId: String,                 // 罗氏女 memberId
  wifeName: String,
  marriageOrder: Number,
  marriageStatus: String,
  isSameVillage: Boolean,
  linkedMemberId: String,         // 本村时 = 男方 memberId
  remark: String,
  sourceMemberId: String,
  createdAt: Date,
  updatedAt: Date
}
```

### 4. dynasty_eras（朝代年号对照表）

```javascript
{
  dynasty: String,                // 朝代：宋/元/明/清/民国/中华人民共和国
  emperor: String,                // 皇帝/统治者姓名
  eraName: String,                // 年号：绍兴/永乐/康熙 等
  startYear: Number,              // 开始年份（公历）
  endYear: Number,                // 结束年份（公历）
  startGanzhi: String             // 开始年份干支
}
```

示例数据：
```javascript
{ dynasty: "宋", emperor: "赵构", eraName: "绍兴", startYear: 1131, endYear: 1162, startGanzhi: "辛亥" }
{ dynasty: "明", emperor: "朱棣", eraName: "永乐", startYear: 1403, endYear: 1424, startGanzhi: "癸未" }
{ dynasty: "清", emperor: "玄烨", eraName: "康熙", startYear: 1662, endYear: 1722, startGanzhi: "壬寅" }
```

### 5. patriarchs（族长表）

```javascript
{
  _id: String,
  name: String,              // 姓名（如"公瑾"）
  title: String,            // 称号（如"一世基祖"）
  generation: Number,        // 世代（如1）
  branch: String,           // 分堂：中和堂/明儒堂/德裕堂/忠爱堂
  branchTitle: String,      // 分堂称号（如"高洲基祖"）
  originRegion: String,      // 来源地
  achievements: String,     // 主要成就
  memberId: String,         // 关联的 members originalId
  sortOrder: Number,         // 排序
  createdAt: Date,
  updatedAt: Date
}
```

示例数据：
```javascript
{ name: "公瑾", title: "一世基祖", generation: 1, branch: "中和堂", branchTitle: "初代基祖", sortOrder: 1 }
{ name: "筮元", title: "十六世", generation: 16, branch: "德裕堂", branchTitle: "高洲基祖", sortOrder: 4 }
{ name: "英", title: "十八世", generation: 18, branch: "明儒堂", branchTitle: "明儒堂基祖", sortOrder: 5 }
```

### 6. sages（乡贤表）

```javascript
{
  _id: String,
  name: String,              // 姓名
  generation: Number,        // 世代
  birthYear: Number,        // 出生年（公历）
  deathYear: Number,         // 去世年
  dynasty: String,           // 朝代：宋/元/明/清
  eraName: String,           // 年号
  achievements: String,      // 主要成就
  memberId: String,         // 关联的 members originalId
  createdAt: Date,
  updatedAt: Date
}
```

### 7. elite（群英表 / 当今族人撷英）

建国后群英榜展示《当今族人撷英》固定七人小传，不再从族人职位字段自动同步。

```javascript
{
  _id: String,
  heroId: String,            // 小传标识：xiangwen/chuanfang/...
  name: String,              // 姓名
  branch: String,            // 堂份
  generation: Number,        // 世代
  memberId: String,          // 关联的 members originalId（可空）
  
  achievementType: String,  // 成就类型：政务/军事/教育/企业/科研/其他
  position: String,         // 职位名称
  organization: String,      // 单位
  level: String,            // 级别
  summary: String,          // 列表简介
  biography: String,        // 小传正文
  
  birthYear: Number,        // 出生年
  isAlive: Boolean,         // 是否在世
  sortOrder: Number,        // 展示排序
  
  createdAt: Date,
  updatedAt: Date
}
```

### 8. graduates（学历表）

```javascript
{
  _id: String,
  name: String,              // 姓名
  generation: Number,        // 世代
  memberId: String,         // 关联的 members originalId
  
  degree: String,           // 学历：本科/硕士/博士/博士后
  school: String,           // 学校
  major: String,            // 专业
  graduationYear: Number,   // 毕业年份
  
  createdAt: Date,
  updatedAt: Date
}
```

---

## 二、农历/公历/干支转换算法

### 1. 农历转公历
使用 lunar-javascript 库或自建算法

### 2. 公历年份转干支
```javascript
function getGanzhi(year) {
  const tiangan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const dizhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const zodiac = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
  
  const ganIndex = (year - 4) % 10;
  const zhiIndex = (year - 4) % 12;
  
  return {
    ganzhi: tiangan[ganIndex] + dizhi[zhiIndex] + '年',
    zodiac: dizhi[zhiIndex] + '年（' + zodiac[zhiIndex] + '年）'
  };
}
```

### 3. 查询年号
```javascript
function getEraName(year) {
  if (year >= 1949) return { dynasty: '中华人民共和国', eraName: null };
  if (year >= 1912) return { dynasty: '民国', eraName: null };
  
  // 查询数据库
  const era = db.dynasty_eras.findOne({
    startYear: { $lte: year },
    endYear: { $gte: year }
  });
  
  return era ? {
    dynasty: era.dynasty,
    emperor: era.emperor,
    eraName: era.eraName,
    eraYear: year - era.startYear + 1
  } : null;
}
```

---

## 三、前端显示格式

### 生卒日期显示示例

**输入：** 农历1156年7月7日

**显示：**
```
农历：1156年七月 初七
公历：1156年9月23日
年号纪年：宋高宗 赵构 绍兴二十六年
干支纪年：丙子年（鼠年）
```

**清朝后现代人显示：**
```
农历：1985年八月 十五
公历：1985年9月29日
年号纪年：-
干支纪年：乙丑年（牛年）
```

---

## 四、Web后台管理系统

### 技术栈建议
- 前端：Vue 3 + Element Plus / React + Ant Design
- 后端：Node.js + Express / 云开发 HTTP 触发器
- 数据库：微信云开发数据库

### 功能模块
1. **登录认证** - 管理员登录
2. **数据导入** - Excel批量导入
3. **人员管理** - CRUD操作
4. **关系管理** - 父子、夫妻、母子关系绑定
5. **照片管理** - 上传、删除照片
6. **数据统计** - 各代人数、分堂统计等

---

## 五、小程序端修改

### 成员详情页显示
- 生卒日期按新格式显示
- 显示学历列表（默认学历高亮）
- 显示职位列表（默认职位高亮）
- 显示荣誉列表
- 照片画廊展示

### 新增页面
- 媳妇详情页
- 女婿详情页

---

## 六、用户认证集合（首期）

### user_accounts（用户账号，唯一绑定）

```javascript
{
  _id: String,
  personId: String,        // members._id，唯一
  originalId: Number|String,
  name: String,
  phone: String,           // 唯一
  phoneVerified: Boolean,
  openid: String,          // 唯一
  unionid: String,         // 可空
  verifyStatus: 'verified',
  createTime: Date
}
```

约束（云函数强制）：openid / phone / personId 均不可重复绑定。

### verify_tickets（身份验证临时票据）

```javascript
{
  _id: String,             // 即 ticketId
  openid: String,
  candidatePersonIds: [String],
  step: 'name'|'birthday'|'father'|'ready',
  expireAt: Number,        // Date.now() + 30min
  createTime: Date,
  updateTime: Date
}
```

### appeals（人工申诉，首期仅写入）

```javascript
{
  _id: String,
  name: String,
  phone: String,
  wechat: String,
  birthHint: String,
  fatherHint: String,
  reason: String,
  status: 'pending',
  createTime: Date,
  openid: String
}
```
