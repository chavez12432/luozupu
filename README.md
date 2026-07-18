# 高洲罗氏族谱小程序 - MVP 快速启动

## 项目结构

```
luozupu-miniprogram/
├── cloudfunctions/          # 云函数
│   ├── getMembers/         # 获取成员列表
│   ├── getMemberDetail/    # 获取成员详情
│   └── importMembers/      # 批量导入成员
├── miniprogram/            # 小程序前端
│   ├── pages/              # 页面
│   │   ├── index/          # 首页-族谱树
│   │   ├── member/         # 成员详情
│   │   └── profile/        # 个人中心
│   ├── components/         # 组件
│   │   └── memberNode/     # 成员节点组件
│   ├── utils/              # 工具函数
│   │   └── db.js           # 数据库操作封装
│   └── app.js              # 小程序入口
├── database/               # 数据库设计
│   └── init.js             # 初始化数据
└── project.config.json     # 项目配置
```

## 快速开始

### 1. 创建项目
1. 打开微信开发者工具
2. 点击"+"创建新项目
3. 选择项目目录（本文件夹）
4. AppID：填写你注册的小程序 AppID
5. 后端服务：选择"微信云开发"
6. 点击"创建"

### 2. 初始化云开发
1. 点击开发者工具上方的"云开发"按钮
2. 记录环境ID（如：luozupu-xxx）
3. 在 `miniprogram/app.js` 中修改环境ID

### 3. 部署云函数
1. 右键 `cloudfunctions/getMembers` → "创建并部署：云端安装依赖"
2. 右键 `cloudfunctions/getMemberDetail` → "创建并部署：云端安装依赖"
3. 右键 `cloudfunctions/importMembers` → "创建并部署：云端安装依赖"

### 4. 初始化数据库
1. 打开"云开发"控制台
2. 进入"数据库" → 创建集合 `members`
3. 导入 `database/init.js` 中的测试数据

### 5. 开始开发
点击开发者工具的"编译"按钮，即可预览效果。

## 功能清单（MVP）

- [x] 族谱树展示（三代一屏）
- [x] 成员详情查看
- [x] 分堂切换（中和堂/明儒堂/德裕堂/忠爱堂）
- [x] 断层标记显示
- [x] 批量导入功能
- [ ] 用户登录（下一版本）
- [ ] 审核流程（下一版本）
