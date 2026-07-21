# 云库人员三表重建步骤

本地 JSON 已由 `python scripts/importFromExcelFamilyDb.py --sync-pkg-local` 生成。

云端仅清空并重导 **members / wives / sons_in_law**，勿动 dynasty_eras、荣誉、认证、序文。

## 1. 部署云函数

上传/部署：

- `cloudfunctions/clearAllMembers`（已改为分页清空三集合）
- `cloudfunctions/adminApi`（`clearAll` 同步增强）
- `cloudfunctions/getMemberDetail`（本村配偶 ID 适配）

## 2. 清空

调用云函数 `clearAllMembers`，或 adminApi `action: 'clearAll'`。

确认返回 `details` 含 members / wives / sons_in_law 删除数。

## 3. 导入

使用云开发控制台 JSONL 导入，或管理端批导：

| 文件 | 集合 |
|---|---|
| `database/members_cloud_import.json` | members |
| `database/wives_cloud_import.json` | wives |
| `database/sons_in_law_cloud_import.json` | sons_in_law |

导入后条数应约为：**1409 / 715 / 165**。

## 4. 注意

- 已绑定 `user_accounts.personId` 的用户需重新身份认证。
- 荣誉集合若存旧数字 ID，可能需日后手工核对（本流程未改荣誉数据）。
