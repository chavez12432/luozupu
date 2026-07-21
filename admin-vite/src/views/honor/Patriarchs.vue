<template>
  <div class="patriarchs-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>族长表管理</span>
          <div>
            <el-button @click="migrateLinks" :loading="migrating">迁移关联</el-button>
            <el-button type="primary" @click="goToAdd">
              <el-icon><Plus /></el-icon>
              添加族长
            </el-button>
          </div>
        </div>
        <el-alert type="info" :closable="false" show-icon style="margin-top: 12px">
          <template #title>
            基础资料从关联族人联动；本表只存称号/排序等。点「打开族人」可改族人库。
          </template>
        </el-alert>
      </template>

      <el-table :data="tableData" border v-loading="loading" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" />
        <el-table-column prop="sortOrder" label="排序" width="70" />
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="originalId" label="族谱ID" width="100" show-overflow-tooltip />
        <el-table-column prop="title" label="称号" width="100" />
        <el-table-column prop="generation" label="世代" width="70" />
        <el-table-column prop="branch" label="分堂" width="100" />
        <el-table-column prop="branchTitle" label="分堂称号" width="110" />
        <el-table-column prop="achievements" label="成就" min-width="140" show-overflow-tooltip />
        <el-table-column label="关联" width="90">
          <template #default="scope">
            <el-tag :type="scope.row.hasLink || scope.row.memberDocId ? 'success' : 'warning'" size="small">
              {{ scope.row.hasLink || scope.row.memberDocId ? '已关联' : '未关联' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="scope">
            <el-button type="primary" size="small" @click="handleEdit(scope.row)">编辑</el-button>
            <el-button size="small" :disabled="!scope.row.memberDocId" @click="openMember(scope.row)">打开族人</el-button>
            <el-button type="danger" size="small" @click="handleDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { patriarchsApi, eliteApi, initCloud } from '../../api/cloudApi.js'

const router = useRouter()
const tableData = ref([])
const selectedRows = ref([])
const loading = ref(false)
const migrating = ref(false)

onMounted(async () => {
  await initCloud()
  loadData()
})

const loadData = async () => {
  loading.value = true
  try {
    const res = await patriarchsApi.getList({ pageSize: 100 })
    if (res && res.success) tableData.value = res.data || []
    else ElMessage.error(res?.message || '加载失败')
  } catch (err) {
    ElMessage.error(err.message || '加载失败')
  } finally {
    loading.value = false
  }
}

const goToAdd = () => router.push('/honor/patriarchs/form')
const handleEdit = (row) => router.push('/honor/patriarchs/form?id=' + row._id)
const openMember = (row) => {
  if (row.memberDocId) router.push(`/members/edit/${row.memberDocId}`)
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定删除 "${row.name}" 吗？`, '确认删除', { type: 'warning' })
    const res = await patriarchsApi.delete(row._id)
    if (res && res.success) {
      ElMessage.success('删除成功')
      loadData()
    } else ElMessage.error(res?.message || '删除失败')
  } catch (err) {
    if (err !== 'cancel') ElMessage.error('删除失败')
  }
}

const handleSelectionChange = (rows) => { selectedRows.value = rows }

const migrateLinks = async () => {
  migrating.value = true
  try {
    const res = await eliteApi.migrateLinks()
    if (res && res.success) {
      ElMessage.success(res.message || '迁移完成')
      await loadData()
    } else ElMessage.error(res?.message || '迁移失败')
  } catch (e) {
    ElMessage.error(e.message || '迁移失败')
  } finally {
    migrating.value = false
  }
}
</script>

<style scoped>
.patriarchs-list { padding: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
</style>
