# 高洲罗氏族谱数据库设计方案

## 一、数据表结构

### 1. members（罗氏族人主表）

```javascript
{
  _id: String,                    // 唯一ID
  name: String,                   // 姓名（必填）
  generation: Number,             // 世代（必填）
  branch: String,                 // 所属分堂：中和堂/明儒堂/德裕堂/忠爱堂
  gender: String,                 // 性别：男/女
  
  // 生卒信息（农历，默认）
  birthDate: {
    lunar: {                      // 农历日期
      year: Number,               // 年（如1156）
      month: Number,              // 月（1-12）
      day: Number,                // 日（1-30）
      isLeap: Boolean             // 是否闰月
    },
    gregorian: {                  // 公历日期（自动计算）
      year: Number,
      month: Number,
      day: Number
    },
    dynasty: String,              // 朝代（自动计算）
    eraName: String,              // 年号（自动计算）
    eraYear: Number,              // 年号年份（自动计算）
    ganzhi: String,               // 干支（自动计算）
    zodiac: String                // 生肖（自动计算）
  },
  
  deathDate: {                    // 逝世日期（结构同birthDate）
    lunar: { year, month, day, isLeap },
    gregorian: { year, month, day },
    dynasty: String,
    eraName: String,
    eraYear: Number,
    ganzhi: String,
    zodiac: String
  },
  
  isAlive: Boolean,               // 是否在世
  
  // 亲属关系
  fatherId: String,               // 父亲ID
  motherId: String,               // 母亲ID（关联wives表）
  spouseId: String,               // 配偶ID（关联wives表）
  childrenIds: [String],          // 子女ID列表
  
  // 个人信息
  birthplace: String,             // 出生地
  residence: String,              // 现居地
  phone: String,                  // 联系电话
  
  // 学历（多学历）
  education: [{
    degree: String,               // 学历：本科/硕士/博士/博士后/博学鸿儒/进士/举人 等
    school: String,               // 学校
    major: String,                // 专业
    year: Number,                 // 毕业年份
    isDefault: Boolean            // 是否默认显示
  }],
  
  // 职位（多职位）
  positions: [{
    title: String,                // 职位名称
    organization: String,         // 单位/机构
    level: String,                // 级别：正国级/副国级/正部级/副部级/正厅级/副厅级/正处级/副处级/正科级/副科级/其他
    startYear: Number,            // 开始年份
    endYear: Number,              // 结束年份
    isDefault: Boolean,           // 是否默认显示
    isCurrent: Boolean            // 是否现任
  }],
  
  // 荣誉
  honors: [{
    type: String,                 // 类型：军人/烈士/荣誉称号/表彰/勋章/学位/科举 等
    title: String,                // 荣誉名称
    level: String,                // 级别：国家级/省级/市级/县级/其他
    year: Number,                 // 获得年份
    description: String           // 描述
  }],
  
  // 照片
  avatar: String,                 // 资料照片（单张）
  photoGallery: [String],         // 照片库（多张）
  
  // 系统字段
  createdAt: Date,
  updatedAt: Date,
  createdBy: String,              // 创建者ID
  updatedBy: String               // 更新者ID
}
```

### 2. wives（媳妇表 - 外姓女性嫁入罗家）

```javascript
{
  _id: String,                    // 唯一ID
  name: String,                   // 姓名（如"王氏"）
  maidenName: String,              // 娘家姓氏（王）
  generation: Number,              // 世代（与丈夫同代）
  
  // 生卒日期
  birthDate: {
    lunar: { year, month, day, isLeap },
    gregorian: { year, month, day },
    ganzhi: String,
    formatted: String
  },
  deathDate: {
    lunar: { year, month, day, isLeap },
    gregorian: { year, month, day },
    ganzhi: String,
    formatted: String
  },
  
  // 婚姻关系
  husbandId: String,              // 丈夫ID（关联members的originalId）
  husbandName: String,           // 丈夫姓名
  marriageType: String,           // 婚配类型：元配/继配/次配/续配/配
  marriageOrder: Number,          // 第几次婚姻（1=第一次婚姻）
  
  // 婚姻状态
  marriageStatus: String,         // 婚姻状态：married（在婚）/ widowed（丧偶）/ divorced（离异）
  divorceDate: {                 // 离婚日期
    lunar: { year, month, day, isLeap },
    gregorian: { year, month, day }
  },
  
  // 子女（只记录该妻子所生的子女）
  childrenIds: [String],         // 子女ID列表
  
  // 附加信息
  burialPlace: String,           // 葬地
  remark: String,                // 备注（如"以子贵，勅赠孺人"）
  
  // 来源追溯
  sourceMemberId: String,        // 来源记录ID（原文所属的罗氏族人）
  
  createdAt: Date,
  updatedAt: Date
}
```

**婚配类型说明：**
| 类型 | 含义 | marriageOrder |
|------|------|---------------|
| 元配 | 原配，第一任妻子 | 1 |
| 继配/次配 | 续弦，第二任妻子 | 2 |
| 续配/复配 | 再婚 | 3+ |
| 配 | 默认婚配 | 1 |

**婚姻状态说明：**
| 状态 | 含义 |
|------|------|
| married | 在婚 |
| widowed | 丧偶 |
| divorced | 离异 |

### 3. sons_in_law（女婿表 - 罗氏女儿外嫁的丈夫）

```javascript
{
  _id: String,
  name: String,                   // 姓名
  generation: Number,              // 世代
  
  // 生卒日期
  birthDate: {
    lunar: { year, month, day, isLeap },
    gregorian: { year, month, day },
    ganzhi: String,
    formatted: String
  },
  deathDate: {
    lunar: { year, month, day, isLeap },
    gregorian: { year, month, day },
    ganzhi: String,
    formatted: String
  },
  
  // 婚姻关系
  wifeId: String,                 // 妻子ID（关联members的originalId）
  wifeName: String,              // 妻子姓名
  marriageOrder: Number,          // 第几次婚姻
  
  // 婚姻状态
  marriageStatus: String,         // 婚姻状态
  divorceDate: { /* 同上 */ },
  
  // 个人信息
  hometown: String,               // 籍贯/入赘地
  
  // 学历、职位、荣誉
  education: [{ degree, school, major, year }],
  positions: [{ title, organization, level, startYear, endYear }],
  honors: [{ type, title, level, year, description }],
  
  // 来源
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
