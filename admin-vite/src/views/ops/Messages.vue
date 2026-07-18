<template>
  <div class="messages-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>开发者留言</span>
          <div class="header-tags">
            <el-tag type="warning">未读 {{ pendingCount }}</el-tag>
            <el-tag type="info">合计 {{ total }}</el-tag>
          </div>
        </div>
      </template>

      <el-form :inline="true" class="search-form">
        <el-form-item label="状态">
          <el-select v-model="status" clearable placeholder="全部" style="width: 140px" @change="loadData(1)">
            <el-option label="未读" value="pending" />
            <el-option label="已读" value="read" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData(1)">刷新</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" border v-loading="loading" style="width: 100%">
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'pending' ? 'danger' : 'success'" size="small">
              {{ row.status === 'pending' ? '未读' : '已读' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="留言人" width="100" />
        <el-table-column prop="accountName" label="绑定名" width="100" />
        <el-table-column prop="phone" label="电话" width="120" />
        <el-table-column prop="wechat" label="微信" width="120" />
        <el-table-column prop="content" label="内容" min-width="220" show-overflow-tooltip />
        <el-table-column prop="createTime" label="时间" width="180" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="showDetail(row)">详情</el-button>
            <el-button
              v-if="row.status === 'pending'"
              type="success"
              link
              @click="markRead(row)"
            >标已读</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          background
          layout="total, prev, pager, next"
          :total="total"
          :page-size="pageSize"
          :current-page="page"
          @current-change="loadData"
        />
      </div>
    </el-card>

    <el-dialog v-model="detailVisible" title="留言详情" width="520px">
      <el-descriptions :column="1" border v-if="current">
        <el-descriptions-item label="留言人">{{ current.name }}</el-descriptions-item>
        <el-descriptions-item label="绑定名">{{ current.accountName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="电话">{{ current.phone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="微信">{{ current.wechat || '-' }}</el-descriptions-item>
        <el-descriptions-item label="时间">{{ current.createTime }}</el-descriptions-item>
        <el-descriptions-item label="内容">
          <div class="msg-body">{{ current.content }}</div>
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button
          v-if="current && current.status === 'pending'"
          type="primary"
          @click="markRead(current)"
        >标为已读</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { opsApi, initCloud } from '../../api/cloudApi.js'

const loading = ref(false)
const tableData = ref([])
const total = ref(0)
const pendingCount = ref(0)
const page = ref(1)
const pageSize = 20
const status = ref('')
const detailVisible = ref(false)
const current = ref(null)

async function loadStats() {
  const res = await opsApi.getOpsStats()
  if (res.success && res.data) {
    pendingCount.value = res.data.messagePending || 0
  }
}

async function loadData(p = 1) {
  page.value = p
  loading.value = true
  try {
    await initCloud()
    const res = await opsApi.listDevMessages({
      page: page.value,
      pageSize,
      status: status.value
    })
    if (!res.success) {
      ElMessage.error(res.message || '加载失败')
      tableData.value = []
      total.value = 0
      return
    }
    tableData.value = res.data || []
    total.value = res.total || 0
    await loadStats()
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function showDetail(row) {
  current.value = row
  detailVisible.value = true
}

async function markRead(row) {
  const res = await opsApi.markDevMessageRead(row._id)
  if (!res.success) {
    ElMessage.error(res.message || '操作失败')
    return
  }
  ElMessage.success('已标记为已读')
  detailVisible.value = false
  loadData(page.value)
}

onMounted(() => loadData(1))
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.header-tags {
  display: flex;
  gap: 8px;
}
.search-form {
  margin-bottom: 12px;
}
.pager {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.msg-body {
  white-space: pre-wrap;
  line-height: 1.6;
}
</style>
