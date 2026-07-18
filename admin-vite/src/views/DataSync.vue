<template>
  <div class="data-sync">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>数据同步管理</span>
          <el-tag v-if="localCount > 0" type="info">本地 {{ localCount }} 条</el-tag>
        </div>
      </template>

      <el-alert
        title="数据同步说明"
        description="在 Web 后台管理数据，完成后同步到微信云开发数据库。支持本地编辑、云端备份、双向同步。"
        type="info"
        show-icon
        :closable="false"
        style="margin-bottom: 20px;"
      />

      <!-- 数据概览 -->
      <el-row :gutter="20" class="stats-row">
        <el-col :span="8">
          <el-statistic title="本地数据" :value="localCount">
            <template #suffix>
              <el-button type="primary" size="small" @click="goToMembers">管理</el-button>
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="8">
          <el-statistic title="云端数据" :value="cloudCount">
            <template #suffix>
              <el-button type="success" size="small" @click="refreshCloudCount">刷新</el-button>
            </template>
          </el-statistic>
        </el-col>
        <el-col :span="8">
          <el-statistic title="差异" :value="diffCount" :value-style="{ color: diffCount > 0 ? '#f56c6c' : '#67c23a' }">
            <template #suffix>
              <el-button type="warning" size="small" @click="compareData" :loading="comparing">比较</el-button>
            </template>
          </el-statistic>
        </el-col>
      </el-row>

      <el-divider />

      <!-- 同步操作 -->
      <h3>同步操作</h3>
      <el-row :gutter="20">
        <!-- 上传到云端 -->
        <el-col :span="12">
          <el-card>
            <template #header>
              <span>本地 → 云端</span>
            </template>
            <p>将本地编辑好的数据上传到微信云开发</p>
            <ol style="margin: 10px 0; padding-left: 20px; color: #666;">
              <li>在族人列表中编辑数据</li>
              <li>点击"生成云端导入文件"</li>
              <li>在云开发控制台导入文件</li>
            </ol>
            <el-button 
              type="primary" 
              @click="generateCloudImportFile" 
              :disabled="localCount === 0"
              style="margin-top: 10px;"
            >
              <el-icon><Document /></el-icon>
              生成云端导入文件
            </el-button>
            <el-button 
              type="success" 
              @click="syncToCloud" 
              :loading="uploading"
              :disabled="localCount === 0"
              style="margin-top: 10px;"
            >
              <el-icon><Upload /></el-icon>
              直接上传
            </el-button>
          </el-card>
        </el-col>

        <!-- 下载到本地 -->
        <el-col :span="12">
          <el-card>
            <template #header>
              <span>云端 → 本地</span>
            </template>
            <p>从微信云开发下载数据到本地</p>
            <ol style="margin: 10px 0; padding-left: 20px; color: #666;">
              <li>备份云端数据到本地</li>
              <li>在本地进行编辑</li>
              <li>编辑完成后再上传</li>
            </ol>
            <el-button 
              type="success" 
              @click="syncFromCloud" 
              :loading="downloading"
              style="margin-top: 10px;"
            >
              <el-icon><Download /></el-icon>
              下载到本地
            </el-button>
          </el-card>
        </el-col>
      </el-row>

      <el-divider />

      <!-- 数据管理 -->
      <h3>数据管理</h3>
      <el-row :gutter="20">
        <el-col :span="8">
          <el-button @click="exportLocalData">
            <el-icon><Document /></el-icon>
            导出本地数据
          </el-button>
        </el-col>
        <el-col :span="8">
          <el-button type="danger" @click="clearLocalData">
            <el-icon><Delete /></el-icon>
            清空本地数据
          </el-button>
        </el-col>
        <el-col :span="8">
          <el-button type="warning" @click="clearCloudData">
            <el-icon><DeleteFilled /></el-icon>
            清空云端数据
          </el-button>
        </el-col>
      </el-row>

      <!-- 进度对话框 -->
      <el-dialog v-model="showProgress" title="同步进度" :close-on-click-modal="false" :show-close="!syncing">
        <el-progress :percentage="syncProgress" :status="syncStatus" />
        <p style="text-align: center; margin-top: 10px;">
          {{ syncMessage }}
        </p>
      </el-dialog>

      <!-- 比较结果对话框 -->
      <el-dialog v-model="showCompare" title="数据比较结果" width="600px">
        <div v-if="compareResult">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="本地数据">{{ compareResult.localCount }} 条</el-descriptions-item>
            <el-descriptions-item label="云端数据">{{ compareResult.cloudCount }} 条</el-descriptions-item>
            <el-descriptions-item label="仅在本地">{{ compareResult.onlyInLocal }} 条</el-descriptions-item>
            <el-descriptions-item label="仅在云端">{{ compareResult.onlyInCloud }} 条</el-descriptions-item>
            <el-descriptions-item label="两边都有">{{ compareResult.inBoth }} 条</el-descriptions-item>
          </el-descriptions>

          <div v-if="compareResult.onlyInLocal > 0" style="margin-top: 20px;">
            <h4>仅在本地（{{ compareResult.details.onlyInLocal.length }}条）</h4>
            <el-table :data="compareResult.details.onlyInLocal.slice(0, 10)" size="small">
              <el-table-column prop="memberId" label="ID" width="100" />
              <el-table-column prop="name" label="姓名" />
            </el-table>
          </div>

          <div v-if="compareResult.onlyInCloud > 0" style="margin-top: 20px;">
            <h4>仅在云端（{{ compareResult.details.onlyInCloud.length }}条）</h4>
            <el-table :data="compareResult.details.onlyInCloud.slice(0, 10)" size="small">
              <el-table-column prop="memberId" label="ID" width="100" />
              <el-table-column prop="name" label="姓名" />
            </el-table>
          </div>
        </div>
      </el-dialog>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getMembers, clearAllMembers, exportToJSON } from '../api/localStorage.js'
import { syncToCloud as syncToCloudApi, syncFromCloud as syncFromCloudApi, compareData as compareDataApi, clearCloudData as clearCloudDataApi } from '../api/syncService.js'

const router = useRouter()

const localCount = ref(0)
const cloudCount = ref(0)
const diffCount = ref(0)
const uploading = ref(false)
const downloading = ref(false)
const comparing = ref(false)
const syncing = ref(false)
const showProgress = ref(false)
const showCompare = ref(false)
const syncProgress = ref(0)
const syncStatus = ref('')
const syncMessage = ref('')
const compareResult = ref(null)

// 刷新本地数据数量
function refreshLocalCount() {
  const members = getMembers()
  localCount.value = members.length
}

// 刷新云端数据数量
async function refreshCloudCount() {
  try {
    const result = await compareDataApi()
    if (result.success) {
      cloudCount.value = result.cloudCount
      diffCount.value = result.onlyInLocal + result.onlyInCloud
    }
  } catch (error) {
    ElMessage.warning('获取云端数据失败: ' + error.message)
  }
}

// 比较数据
async function compareData() {
  comparing.value = true
  try {
    const result = await compareDataApi()
    if (result.success) {
      compareResult.value = result
      cloudCount.value = result.cloudCount
      diffCount.value = result.onlyInLocal + result.onlyInCloud
      showCompare.value = true
    } else {
      ElMessage.error(result.message || '比较失败')
    }
  } catch (error) {
    ElMessage.error('比较失败: ' + error.message)
  } finally {
    comparing.value = false
  }
}

// 同步到云端
async function syncToCloud() {
  if (localCount.value === 0) {
    ElMessage.warning('本地没有数据可同步')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要将本地 ${localCount.value} 条数据上传到云端吗？`,
      '确认上传',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    uploading.value = true
    syncing.value = true
    showProgress.value = true
    syncProgress.value = 0
    syncStatus.value = ''
    syncMessage.value = '准备上传...'

    const result = await syncToCloudApi((progress) => {
      syncProgress.value = progress.percentage
      syncMessage.value = `已上传 ${progress.current} / ${progress.total} 条`
    })

    syncProgress.value = 100
    syncStatus.value = result.success ? 'success' : 'exception'
    syncMessage.value = result.success 
      ? `上传完成！成功 ${result.uploaded} 条，失败 ${result.failed} 条`
      : `上传失败: ${result.message}`

    if (result.success) {
      ElMessage.success(`成功上传 ${result.uploaded} 条数据到云端`)
      await refreshCloudCount()
    } else {
      ElMessage.error(result.message || '上传失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('上传失败:', error)
      const errorMsg = error.message || '未知错误'
      if (errorMsg.includes('请在微信开发者工具中打开')) {
        ElMessage.warning('当前环境无法直接调用云函数。请使用以下方式之一：\n1. 在小程序中访问数据导入页面\n2. 配置云开发 HTTP API 访问\n3. 导出数据文件后手动导入')
      } else {
        ElMessage.error('上传失败: ' + errorMsg)
      }
    }
  } finally {
    uploading.value = false
    syncing.value = false
    setTimeout(() => {
      showProgress.value = false
    }, 2000)
  }
}

// 从云端同步
async function syncFromCloud() {
  try {
    await ElMessageBox.confirm(
      '确定要从云端下载数据吗？本地数据将被覆盖！',
      '确认下载',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    downloading.value = true
    syncing.value = true
    showProgress.value = true
    syncProgress.value = 0
    syncStatus.value = ''
    syncMessage.value = '正在下载...'

    const result = await syncFromCloudApi((progress) => {
      syncProgress.value = progress.percentage
      syncMessage.value = `已下载 ${progress.current} / ${progress.total} 条`
    })

    syncProgress.value = 100
    syncStatus.value = result.success ? 'success' : 'exception'
    syncMessage.value = result.success 
      ? `下载完成！共 ${result.count} 条数据`
      : `下载失败: ${result.message}`

    if (result.success) {
      ElMessage.success(result.message)
      refreshLocalCount()
      await refreshCloudCount()
    } else {
      ElMessage.error(result.message || '下载失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('下载失败:', error)
      ElMessage.error('下载失败: ' + error.message)
    }
  } finally {
    downloading.value = false
    syncing.value = false
    setTimeout(() => {
      showProgress.value = false
    }, 2000)
  }
}

// 导出本地数据
function exportLocalData() {
  const json = exportToJSON()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `members-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  ElMessage.success('数据已导出')
}

// 生成云端导入文件（JSON Lines格式）
function generateCloudImportFile() {
  const members = getMembers()
  if (members.length === 0) {
    ElMessage.warning('本地没有数据')
    return
  }

  // 转换为云开发格式（每行一个JSON对象）
  const jsonLines = members.map(member => {
    // 清理本地字段
    const { _id, createdAt, updatedAt, ...cleanMember } = member
    return JSON.stringify(cleanMember)
  }).join('\n')

  const blob = new Blob([jsonLines], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `cloud-import-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  ElMessage.success('云端导入文件已生成')
  ElMessage.info('请将此文件上传到云开发控制台的数据库导入功能中')
}

// 清空本地数据
async function clearLocalData() {
  try {
    await ElMessageBox.confirm(
      '确定要清空本地所有数据吗？此操作不可恢复！',
      '确认清空',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'danger'
      }
    )

    clearAllMembers()
    refreshLocalCount()
    ElMessage.success('本地数据已清空')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('清空失败: ' + error.message)
    }
  }
}

// 清空云端数据
async function clearCloudData() {
  try {
    await ElMessageBox.confirm(
      '确定要清空云端所有数据吗？此操作不可恢复！',
      '确认清空',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'danger'
      }
    )

    const result = await clearCloudDataApi()
    if (result.success) {
      ElMessage.success(result.message)
      await refreshCloudCount()
    } else {
      ElMessage.error(result.message || '清空失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('清空失败: ' + error.message)
    }
  }
}

// 跳转到族人管理
function goToMembers() {
  router.push('/members')
}

// 页面加载
onMounted(() => {
  refreshLocalCount()
  refreshCloudCount()
})
</script>

<style scoped>
.data-sync {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 18px;
  font-weight: bold;
}

.stats-row {
  margin: 20px 0;
}

.action-area {
  margin-top: 30px;
  text-align: center;
}
</style>
