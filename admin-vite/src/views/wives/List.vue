<template>
  <div class="wives-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>媳妇管理</span>
          <el-button type="primary" @click="goToAdd">
            <el-icon><Plus /></el-icon>
            添加媳妇
          </el-button>
        </div>
      </template>
      
      <!-- 搜索栏 -->
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="丈夫ID">
          <el-input v-model="searchForm.husbandId" placeholder="丈夫ID" clearable />
        </el-form-item>
        <el-form-item label="世代">
          <el-input-number v-model="searchForm.generation" :min="1" :max="50" placeholder="世代" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
      
      <!-- 数据表格 -->
      <div class="table-toolbar">
        <el-button type="danger" @click="batchDelete" :disabled="selectedRows.length === 0">
          批量删除 ({{ selectedRows.length }})
        </el-button>
      </div>
      
      <el-table :data="tableData" border style="width: 100%" v-loading="loading" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" />
        <el-table-column prop="wifeId" label="媳妇ID" width="120">
          <template #default="scope">
            <el-tag type="info">{{ scope.row.wifeId || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="maidenName" label="娘家姓氏" width="100" />
        <el-table-column prop="generation" label="世代" width="80">
          <template #default="scope">
            <el-tag size="small">{{ scope.row.generation }}代</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="marriageType" label="婚配类型" width="100">
          <template #default="scope">
            <el-tag :type="getMarriageTypeTag(scope.row.marriageType)" size="small">
              {{ scope.row.marriageType || '配' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="marriageStatus" label="婚姻状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusTag(scope.row.marriageStatus)" size="small">
              {{ getStatusText(scope.row.marriageStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="husbandName" label="丈夫" width="120" />
        <el-table-column prop="burialPlace" label="葬地" min-width="150" show-overflow-tooltip />
        <el-table-column prop="remark" label="备注" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="scope">
            <el-button type="primary" size="small" @click="handleEdit(scope.row)">编辑</el-button>
            <el-button type="danger" size="small" @click="handleDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <!-- 分页 -->
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadData"
        @current-change="loadData"
        style="margin-top: 20px; justify-content: center;"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { wivesApi, initCloud } from '../../api/cloudApi.js'

const tableData = ref([])
const selectedRows = ref([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const loading = ref(false)

const searchForm = reactive({
  husbandId: '',
  generation: null
})

const marriageTypeMap = {
  '元配': 'success',
  '继配': 'warning',
  '续配': 'warning',
  '配': 'info'
}

const marriageStatusMap = {
  'married': { type: 'success', text: '在婚' },
  'widowed': { type: 'warning', text: '丧偶' },
  'divorced': { type: 'danger', text: '离异' }
}

const getMarriageTypeTag = (type) => marriageTypeMap[type] || 'info'
const getStatusTag = (status) => marriageStatusMap[status]?.type || 'info'
const getStatusText = (status) => marriageStatusMap[status]?.text || status || '在婚'

async function init() {
  try {
    const success = await initCloud()
    if (success) {
      loadData()
    }
  } catch (error) {
    console.error('初始化失败:', error)
  }
}

// 页面加载时获取数据
onMounted(() => {
  init()
})

const loadData = async () => {
  loading.value = true
  
  try {
    const res = await wivesApi.getList({
      husbandId: searchForm.husbandId || null,
      generation: searchForm.generation || null,
      page: page.value,
      pageSize: pageSize.value
    })
    
    if (res && res.success) {
      tableData.value = res.data || []
      total.value = res.total || 0
    } else {
      ElMessage.error(res?.message || '加载失败')
    }
  } catch (err) {
    console.error('加载失败', err)
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
  searchForm.husbandId = ''
  searchForm.generation = null
  page.value = 1
  loadData()
}

import { useRouter } from 'vue-router'
const router = useRouter()

const goToAdd = () => {
  router.push('/wives/form')
}

const handleEdit = (row) => {
  router.push('/wives/form?id=' + row._id)
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定删除 "${row.name}" 吗？`, '确认删除', {
      type: 'warning'
    })
    
    const res = await wivesApi.delete(row._id)
    
    if (res && res.success) {
      ElMessage.success('删除成功')
      loadData()
    } else {
      ElMessage.error('删除失败')
    }
  } catch (err) {
    if (err !== 'cancel') {
      console.error('删除失败', err)
      ElMessage.error('删除失败')
    }
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
          const result = await wivesApi.delete(row._id)
          if (result.success) {
            successCount++
          } else {
            failCount++
          }
        }
      } catch (err) {
        failCount++
      }
    }
    
    ElMessage.success(`删除完成：成功 ${successCount} 条，失败 ${failCount} 条`)
    selectedRows.value = []
    loadData()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('批量删除失败')
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.wives-list {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-form {
  margin-bottom: 20px;
}

.table-toolbar {
  margin-bottom: 10px;
}
</style>
