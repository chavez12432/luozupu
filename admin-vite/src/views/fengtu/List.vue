<template>
  <div class="fengtu-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>风土志管理</span>
          <el-button type="primary" @click="goToAdd">
            <el-icon><Plus /></el-icon>
            添加文章
          </el-button>
        </div>
      </template>

      <el-table :data="tableData" border v-loading="loading">
        <el-table-column prop="sortOrder" label="排序" width="70" />
        <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
        <el-table-column prop="layout" label="版式" width="100">
          <template #default="scope">
            <el-tag size="small">{{ layoutLabel(scope.row.layout) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="authorName" label="作者" width="120" show-overflow-tooltip />
        <el-table-column prop="year" label="年代" width="100" />
        <el-table-column prop="published" label="上架" width="80">
          <template #default="scope">
            <el-tag :type="scope.row.published !== false ? 'success' : 'info'" size="small">
              {{ scope.row.published !== false ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
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
import { fengtuApi, initCloud } from '../../api/cloudApi.js'

const router = useRouter()
const tableData = ref([])
const loading = ref(false)

const layoutLabel = (layout) => {
  if (layout === 'classic') return '古文三栏'
  if (layout === 'poem') return '诗配图'
  return '普通文章'
}

onMounted(async () => {
  await initCloud()
  loadData()
})

const loadData = async () => {
  loading.value = true
  try {
    const res = await fengtuApi.getList({ page: 1, pageSize: 100 })
    if (res && res.success) tableData.value = res.data || []
  } catch (e) {
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

const goToAdd = () => router.push('/fengtu/form')
const handleEdit = (row) => router.push('/fengtu/form?id=' + row._id)

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定删除「${row.title}」吗？`, '确认删除', { type: 'warning' })
    const res = await fengtuApi.delete(row._id)
    if (res && res.success) {
      ElMessage.success('已删除')
      loadData()
    } else {
      ElMessage.error((res && res.message) || '删除失败')
    }
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}
</script>

<style scoped>
.fengtu-list { padding: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
</style>
