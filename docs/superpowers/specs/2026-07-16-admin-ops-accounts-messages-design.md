# 设计：Web 后台运营管理（方案 A）

日期：2026-07-16  
状态：已确认实施

## 目标

在 **admin-vite** 为管理员（罗阳先）提供：

1. 查看小程序登录/绑定账号记录  
2. 查看开发者留言数量与内容  
3. 修改所有人资料（沿用现有「族人管理」）

## 范围

| 功能 | 实现 |
|------|------|
| 登录记录 | 云库 `user_accounts` 列表（已绑定账号，非每次冷启动流水） |
| 留言 | 云库 `dev_messages` 列表 + 总数；可标记已读 |
| 改资料 | 无新开发，使用 `/members` 编辑 |

## API（adminApi 云函数）

- `listAccounts`：分页，返回脱敏手机号、姓名、personId、绑定时间  
- `listDevMessages`：分页，支持按 status 筛选  
- `markDevMessageRead`：将 status 置为 `read`  
- `getOpsStats`：账号总数、留言总数、未读数（可选，供侧栏/概览）

## 前端

- 侧栏「运营管理」：登录账号 `/accounts`、开发者留言 `/messages`  
- 族人管理入口旁提示：可编辑任意族人资料  

## 部署

需重新部署云函数 `adminApi` 并保持 HTTP 触发器。

## 非目标（本期不做）

- 小程序内超管 UI  
- `login_logs` 每次打开流水  
- 本地 Storage 模式的后台同步  
