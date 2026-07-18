<template>
  <div class="accounts-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>登录账号（小程序已绑定）</span>
          <el-tag type="info">共 {{ total }} 人</el-tag>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="说明：此处为完成身份验证并绑定手机号的账号记录，不是每次打开小程序的流水日志。"
        style="margin-bottom: 16px;"
      />

      <el-form :inline="true" class="search-form" @submit.prevent>
        <el-form-item label="姓名">
          <el-input v-model="keyword" placeholder="按姓名搜索" clearable @keyup.enter="loadData(1)" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData(1)">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" border v-loading="loading" style="width: 100%">
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="phoneMasked" label="手机号" width="130" />
        <el-table-column prop="originalId" label="谱序号" width="90" />
        <el-table-column prop="verifyStatus" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.verifyStatus === 'verified' ? 'success' : 'warning'" size="small">
              {{ row.verifyStatus || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="wechatId" label="微信号" width="140" show-overflow-tooltip />
        <el-table-column prop="createTime" label="绑定时间" min-width="180" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.personId"
              type="primary"
              link
              @click="goMember(row.personId)"
            >查看族人</el-button>
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { opsApi, initCloud } from '../../api/cloudApi.js'

const router = useRouter()
const loading = ref(false)
const tableData = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const keyword = ref('')

async function loadData(p = 1) {
  page.value = p
  loading.value = true
  try {
    await initCloud()
    const res = await opsApi.listAccounts({
      page: page.value,
      pageSize,
      keyword: keyword.value
    })
    if (!res.success) {
      ElMessage.error(res.message || '加载失败')
      tableData.value = []
      total.value = 0
      return
    }
    tableData.value = res.data || []
    total.value = res.total || 0
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function resetSearch() {
  keyword.value = ''
  loadData(1)
}

function goMember(personId) {
  router.push(`/members/edit/${personId}`)
}

onMounted(() => loadData(1))
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.search-form {
  margin-bottom: 12px;
}
.pager {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
