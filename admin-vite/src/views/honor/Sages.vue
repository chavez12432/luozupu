<template>
  <div class="sages-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>乡贤榜管理</span>
          <el-button type="primary" @click="goToAdd">
            <el-icon><Plus /></el-icon>
            添加乡贤
          </el-button>
        </div>
        <el-alert type="info" :closable="false" show-icon style="margin-top: 12px">
          <template #title>
            姓名等从关联族人联动；本榜侧重「主要成就」。点「打开族人」可改族人库功名等字段。
          </template>
        </el-alert>
      </template>
      
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="朝代">
          <el-select v-model="searchForm.dynasty" placeholder="全部" clearable>
            <el-option label="宋" value="宋" />
            <el-option label="元" value="元" />
            <el-option label="明" value="明" />
            <el-option label="清" value="清" />
            <el-option label="近现代" value="近现代" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
      
      <div class="table-toolbar">
        <el-button type="danger" @click="batchDelete" :disabled="selectedRows.length === 0">
          批量删除 ({{ selectedRows.length }})
        </el-button>
      </div>
      
      <el-table :data="tableData" border v-loading="loading" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" />
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="originalId" label="族谱ID" width="100" show-overflow-tooltip />
        <el-table-column prop="generation" label="世代" width="70" />
        <el-table-column prop="dynasty" label="朝代" width="80">
          <template #default="scope">
            <el-tag>{{ scope.row.dynasty }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="gongming" label="功名(族人)" width="110" show-overflow-tooltip />
        <el-table-column prop="achievements" label="主要成就" min-width="160" show-overflow-tooltip />
        <el-table-column label="关联" width="90">
          <template #default="scope">
            <el-tag :type="scope.row.hasLink ? 'success' : 'warning'" size="small">
              {{ scope.row.hasLink ? '已关联' : '未关联' }}
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
      
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, prev, pager, next"
        @current-change="loadData"
        style="margin-top: 20px; justify-content: center;"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { sagesApi, initCloud } from '../../api/cloudApi.js'

const router = useRouter()
const tableData = ref([])
const selectedRows = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const searchForm = reactive({ dynasty: '' })

onMounted(async () => {
  await initCloud()
  loadData()
})

const loadData = async () => {
  loading.value = true
  try {
    const res = await sagesApi.getList({
      dynasty: searchForm.dynasty || null,
      page: page.value,
      pageSize: pageSize.value
    })
    if (res && res.success) {
      tableData.value = res.data || []
      total.value = res.total || 0
    }
  } catch (err) {
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  page.value = 1
  loadData()
}

const resetSearch = () => {
  searchForm.dynasty = ''
  handleSearch()
}

const goToAdd = () => router.push('/honor/sages/form')
const handleEdit = (row) => router.push('/honor/sages/form?id=' + row._id)
const openMember = (row) => {
  if (row.memberDocId) router.push(`/members/edit/${row.memberDocId}`)
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定删除 "${row.name}" 吗？`, '确认删除', { type: 'warning' })
    const res = await sagesApi.delete(row._id)
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
          const result = await sagesApi.delete(row._id)
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
.sages-list { padding: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.search-form { margin-bottom: 20px; }
.table-toolbar { margin-bottom: 10px; }
</style>
