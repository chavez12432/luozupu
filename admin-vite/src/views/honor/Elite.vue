<template>
  <div class="elite-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <div class="header-row">
            <span>建国后群英榜（当今族人撷英）</span>
            <el-button type="warning" :loading="resetting" @click="resetHeroes">
              清空旧关联并重置为七人小传
            </el-button>
          </div>
          <el-alert type="info" :closable="false" show-icon>
            <template #title>
              展示《当今族人撷英》七人：相文、传芳、建新、国才、德才、庆良、志坚。点击可查看小传。
            </template>
          </el-alert>
        </div>
      </template>
      
      <el-table :data="tableData" border v-loading="loading">
        <el-table-column type="index" label="序号" width="70" />
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="branch" label="堂份" width="100" />
        <el-table-column prop="generation" label="世代" width="80">
          <template #default="scope">
            <el-tag type="success">{{ scope.row.generation }}世</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="summary" label="简介" min-width="260" show-overflow-tooltip />
        <el-table-column prop="achievementType" label="类型" width="90" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="scope">
            <el-button type="primary" size="small" @click="viewBio(scope.row)">
              查看小传
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="bioVisible" :title="`${current?.name || ''}小传`" width="680px">
      <div class="bio-meta" v-if="current">
        <span>{{ current.branch }}</span>
        <span>· 第{{ current.generation }}世</span>
        <span v-if="current.birthYear">· 生于{{ current.birthYear }}年</span>
      </div>
      <div class="bio-text">{{ current?.biography || '暂无小传' }}</div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { eliteApi, initCloud } from '../../api/cloudApi.js'

const tableData = ref([])
const loading = ref(false)
const resetting = ref(false)
const bioVisible = ref(false)
const current = ref(null)

const loadData = async () => {
  loading.value = true
  try {
    const res = await eliteApi.getList({ pageSize: 100 })
    if (res && res.success) {
      tableData.value = res.data || []
    }
  } catch (err) {
    console.error('加载失败:', err)
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

const viewBio = async (row) => {
  current.value = row
  if (!row.biography && row._id) {
    try {
      const res = await eliteApi.getById(row._id)
      if (res && res.success && res.data) {
        current.value = res.data
      }
    } catch (e) {
      console.warn(e)
    }
  }
  bioVisible.value = true
}

const resetHeroes = async () => {
  try {
    await ElMessageBox.confirm(
      '将清空群英榜中现有关联人员，并重置为《当今族人撷英》七人小传。是否继续？',
      '确认重置',
      { type: 'warning' }
    )
  } catch {
    return
  }

  resetting.value = true
  try {
    const res = await eliteApi.resetHeroes()
    if (res && res.success) {
      ElMessage.success(res.message || '重置成功')
      await loadData()
    } else {
      ElMessage.error(res?.message || '重置失败')
    }
  } catch (err) {
    console.error(err)
    ElMessage.error('重置失败')
  } finally {
    resetting.value = false
  }
}

onMounted(async () => {
  await initCloud()
  loadData()
})
</script>

<style scoped>
.elite-list { padding: 20px; }
.card-header { display: flex; flex-direction: column; gap: 10px; }
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.bio-meta {
  color: #666;
  margin-bottom: 12px;
  font-size: 14px;
}
.bio-text {
  white-space: pre-wrap;
  line-height: 1.8;
  color: #333;
  text-align: justify;
  max-height: 60vh;
  overflow-y: auto;
}
</style>
