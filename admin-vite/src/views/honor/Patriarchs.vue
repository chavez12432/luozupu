<template>
  <div class="patriarchs-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>族长表管理</span>
          <el-button type="primary" @click="goToAdd">
            <el-icon><Plus /></el-icon>
            添加族长
          </el-button>
        </div>
      </template>
      
      <div class="table-toolbar">
        <el-button type="danger" @click="batchDelete" :disabled="selectedRows.length === 0">
          批量删除 ({{ selectedRows.length }})
        </el-button>
      </div>
      
      <el-table :data="tableData" border v-loading="loading" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" />
        <el-table-column prop="sortOrder" label="排序" width="80" />
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="title" label="称号" width="100" />
        <el-table-column prop="generation" label="世代" width="80" />
        <el-table-column prop="branch" label="分堂" width="120">
          <template #default="scope">
            <el-tag>{{ scope.row.branch }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="branchTitle" label="分堂称号" width="120" />
        <el-table-column prop="originRegion" label="来源地" />
        <el-table-column prop="achievements" label="成就" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button type="primary" size="small" @click="handleEdit(scope.row)">编辑</el-button>
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
import { patriarchsApi, initCloud } from '../../api/cloudApi.js'

const router = useRouter()
const tableData = ref([])
const selectedRows = ref([])
const loading = ref(false)

onMounted(async () => {
  await initCloud()
  loadData()
})

const loadData = async () => {
  loading.value = true
  try {
    const res = await patriarchsApi.getList()
    if (res && res.success) {
      tableData.value = res.data || []
    }
  } catch (err) {
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

const goToAdd = () => {
  router.push('/honor/patriarchs/form')
}

const handleEdit = (row) => {
  router.push('/honor/patriarchs/form?id=' + row._id)
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定删除 "${row.name}" 吗？`, '确认删除', { type: 'warning' })
    const res = await patriarchsApi.delete(row._id)
    if (res && res.success) {
      ElMessage.success('删除成功')
      loadData()
    }
  } catch (err) {
    if (err !== 'cancel') ElMessage.error('删除失败')
  }
}

const handleSelectionChange = (rows) => {
  selectedRows.value = rows
}

const batchDelete = async () => {
  if (selectedRows.value.length === 0) {
    ElMessage.warning('请先选择要删除的记录')
    return
  }
  
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedRows.value.length} 条记录吗？此操作不可恢复！`,
      '确认批量删除',
      { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning' }
    )
    
    loading.value = true
    let successCount = 0
    let failCount = 0
    
    for (const row of selectedRows.value) {
      try {
        if (row._id) {
          const result = await patriarchsApi.delete(row._id)
          if (result.success) successCount++
          else failCount++
        }
      } catch (err) {
        failCount++
      }
    }
    
    ElMessage.success(`删除完成：成功 ${successCount} 条，失败 ${failCount} 条`)
    selectedRows.value = []
    loadData()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('批量删除失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.patriarchs-list { padding: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.table-toolbar { margin-bottom: 10px; }
</style>
