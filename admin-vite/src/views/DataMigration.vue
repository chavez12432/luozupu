<template>
  <div class="data-migration">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>数据迁移到微信云开发</span>
        </div>
      </template>

      <!-- 步骤条 -->
      <el-steps :active="activeStep" finish-status="success" class="steps">
        <el-step title="上传数据" />
        <el-step title="转换验证" />
        <el-step title="导出/导入" />
      </el-steps>

      <!-- 步骤1: 上传数据 -->
      <div v-if="activeStep === 0" class="step-content">
        <el-alert
          title="数据迁移说明"
          description="将旧数据库文件转换为微信云开发格式，支持批量导入到云数据库。"
          type="info"
          show-icon
          :closable="false"
          style="margin-bottom: 20px;"
        />

        <el-upload
          class="upload-demo"
          drag
          action="#"
          :auto-upload="false"
          :on-change="handleFileUpload"
          accept=".json"
        >
          <el-icon class="el-icon--upload" size="60" color="#409EFF"><upload-filled /></el-icon>
          <div class="el-upload__text">
            拖拽 所有表0409.json 文件到此处或 <em>点击上传</em>
          </div>
        </el-upload>
      </div>

      <!-- 步骤2: 转换验证 -->
      <div v-if="activeStep === 1" class="step-content">
        <h3>转换结果统计</h3>
        <el-row :gutter="20" class="stats-row">
          <el-col :span="6">
            <el-statistic title="总记录数" :value="migrationResult.total" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="成功转换" :value="migrationResult.converted" class="success-stat" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="转换失败" :value="migrationResult.errors?.length || 0" class="error-stat" />
          </el-col>
          <el-col :span="6">
            <el-statistic title="关系异常" :value="migrationResult.warnings?.length || 0" class="warning-stat" />
          </el-col>
        </el-row>

        <el-divider />

        <!-- 数据完整性统计 -->
        <div v-if="migrationResult.stats">
          <h3>数据完整性</h3>
          <el-row :gutter="20">
            <el-col :span="4">
              <div class="stat-item">
                <div class="stat-value">{{ migrationResult.stats.withFather }}</div>
                <div class="stat-label">有父亲记录</div>
              </div>
            </el-col>
            <el-col :span="4">
              <div class="stat-item">
                <div class="stat-value">{{ migrationResult.stats.withMother }}</div>
                <div class="stat-label">有母亲记录</div>
              </div>
            </el-col>
            <el-col :span="4">
              <div class="stat-item">
                <div class="stat-value">{{ migrationResult.stats.withLifespan }}</div>
                <div class="stat-label">有寿命数据</div>
              </div>
            </el-col>
            <el-col :span="4">
              <div class="stat-item">
                <div class="stat-value">{{ migrationResult.stats.withPhoto }}</div>
                <div class="stat-label">有照片</div>
              </div>
            </el-col>
            <el-col :span="4">
              <div class="stat-item">
                <div class="stat-value">{{ migrationResult.stats.withBiography }}</div>
                <div class="stat-label">有传记</div>
              </div>
            </el-col>
          </el-row>

          <el-divider />

          <!-- 分堂分布 -->
          <h3>分堂分布</h3>
          <el-table :data="branchStats" border size="small" style="width: 300px">
            <el-table-column prop="branch" label="分堂" />
            <el-table-column prop="count" label="人数" width="100" />
          </el-table>

          <el-divider />

          <!-- 世代分布 -->
          <h3>世代分布</h3>
          <el-table :data="generationStats" border size="small" style="width: 300px">
            <el-table-column prop="generation" label="世代" />
            <el-table-column prop="count" label="人数" width="100" />
          </el-table>
        </div>

        <div class="action-area">
          <el-button @click="activeStep = 0">上一步</el-button>
          <el-button type="primary" @click="goToExport">下一步：导出/导入</el-button>
        </div>
      </div>

      <!-- 步骤3: 导出/导入 -->
      <div v-if="activeStep === 2" class="step-content">
        <h3>导出云开发导入文件</h3>
        
        <el-alert
          title="导入方式选择"
          description="请选择适合您的方式将数据导入微信云开发数据库"
          type="info"
          show-icon
          :closable="false"
          style="margin-bottom: 20px;"
        />

        <el-row :gutter="20">
          <!-- 方式1: JSON Lines 文件 -->
          <el-col :span="12">
            <el-card>
              <template #header>
                <span>方式一：控制台导入</span>
              </template>
              <p>下载 JSON Lines 格式文件，通过微信开发者工具控制台导入</p>
              <ol style="margin: 10px 0; padding-left: 20px;">
                <li>下载导入文件</li>
                <li>打开微信开发者工具</li>
                <li>进入云开发控制台 → 数据库</li>
                <li>选择 members 集合</li>
                <li>点击"导入"按钮</li>
                <li>选择下载的文件</li>
              </ol>
              <el-button type="primary" @click="downloadImportFile" style="margin-top: 10px;">
                <el-icon><Download /></el-icon>
                下载导入文件
              </el-button>
            </el-card>
          </el-col>

          <!-- 方式2: 云函数导入 -->
          <el-col :span="12">
            <el-card>
              <template #header>
                <span>方式二：云函数批量导入</span>
              </template>
              <p>将数据分批通过云函数导入（需要部署云函数）</p>
              <ol style="margin: 10px 0; padding-left: 20px;">
                <li>确保 addMember 云函数已部署</li>
                <li>点击"开始批量导入"</li>
                <li>等待导入完成</li>
              </ol>
              <el-button type="success" @click="batchImportToCloud" :loading="importing" style="margin-top: 10px;">
                <el-icon><Upload /></el-icon>
                开始批量导入
              </el-button>
            </el-card>
          </el-col>
        </el-row>

        <el-divider />

        <!-- 导出迁移报告 -->
        <h3>导出迁移报告</h3>
        <p>下载详细的迁移报告，包含数据统计和错误信息</p>
        <el-button @click="downloadReport">
          <el-icon><Document /></el-icon>
          下载迁移报告
        </el-button>

        <div class="action-area">
          <el-button @click="activeStep = 1">上一步</el-button>
          <el-button type="primary" @click="reset">完成</el-button>
        </div>
      </div>

      <!-- 导入进度 -->
      <el-dialog v-model="showProgress" title="导入进度" :close-on-click-modal="false" :show-close="false">
        <el-progress :percentage="importProgress" :status="importStatus" />
        <p style="text-align: center; margin-top: 10px;">
          已导入 {{ importedCount }} / {{ totalCount }} 条记录
        </p>
        <p v-if="importErrors.length > 0" style="color: #f56c6c; margin-top: 10px;">
          失败 {{ importErrors.length }} 条
        </p>
      </el-dialog>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  convertToCloudFormat, 
  downloadCloudImportFile, 
  downloadMigrationReport,
  exportInBatches 
} from '../utils/dataMigration.js'
import { memberApi } from '../api/localStorage.js'

const activeStep = ref(0)
const rawData = ref(null)
const migrationResult = ref({})
const importing = ref(false)
const showProgress = ref(false)
const importProgress = ref(0)
const importStatus = ref('')
const importedCount = ref(0)
const totalCount = ref(0)
const importErrors = ref([])

// 分堂统计
const branchStats = computed(() => {
  if (!migrationResult.value.stats?.byBranch) return []
  return Object.entries(migrationResult.value.stats.byBranch).map(([branch, count]) => ({
    branch,
    count
  }))
})

// 世代统计
const generationStats = computed(() => {
  if (!migrationResult.value.stats?.byGeneration) return []
  return Object.entries(migrationResult.value.stats.byGeneration)
    .map(([gen, count]) => ({ generation: gen + '代', count }))
    .sort((a, b) => parseInt(a.generation) - parseInt(b.generation))
})

// 处理文件上传
function handleFileUpload(file) {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      rawData.value = JSON.parse(e.target.result)
      ElMessage.success('文件上传成功')
      
      // 自动开始转换
      startConversion()
    } catch (error) {
      ElMessage.error('JSON解析失败: ' + error.message)
    }
  }
  reader.readAsText(file.raw)
}

// 开始转换
function startConversion() {
  if (!rawData.value) {
    ElMessage.warning('请先上传数据文件')
    return
  }

  try {
    const result = convertToCloudFormat(rawData.value)
    
    if (result.success) {
      migrationResult.value = result
      activeStep.value = 1
      ElMessage.success(`数据转换完成，共 ${result.converted} 条记录`)
    } else {
      ElMessage.error('数据转换失败: ' + (result.message || '未知错误'))
    }
  } catch (error) {
    console.error('转换失败:', error)
    ElMessage.error('数据转换失败: ' + error.message)
  }
}

// 进入导出步骤
function goToExport() {
  activeStep.value = 2
}

// 下载导入文件
function downloadImportFile() {
  if (!migrationResult.value.data) {
    ElMessage.warning('没有可导出的数据')
    return
  }
  
  downloadCloudImportFile(migrationResult.value.data, 'members-import-data.jsonl')
  ElMessage.success('导入文件已下载')
}

// 下载迁移报告
function downloadReport() {
  if (!migrationResult.value) {
    ElMessage.warning('没有可导出的报告')
    return
  }
  
  const report = {
    summary: {
      total: migrationResult.value.total,
      converted: migrationResult.value.converted,
      errors: migrationResult.value.errors?.length || 0,
      warnings: migrationResult.value.warnings?.length || 0
    },
    stats: migrationResult.value.stats,
    errors: migrationResult.value.errors,
    warnings: migrationResult.value.warnings
  }
  
  downloadMigrationReport(report, 'data-migration-report.json')
  ElMessage.success('迁移报告已下载')
}

// 调用云函数
async function callCloudFunction(name, data = {}) {
  // 如果是在微信开发者工具中，可以通过 wx.cloud.callFunction 调用
  // 这里提供一个模拟实现，实际使用时需要替换为真实的云函数调用
  
  // 方案1: 如果是在小程序WebView中
  if (typeof wx !== 'undefined' && wx.cloud) {
    const result = await wx.cloud.callFunction({
      name,
      data
    });
    return result.result;
  }
  
  // 方案2: 使用 HTTP API（需要配置云开发HTTP访问服务）
  // 这里暂时返回模拟结果，提示用户在微信开发者工具中操作
  throw new Error('请在微信开发者工具中使用此功能，或配置云开发HTTP API访问');
}

// 批量导入到云开发（通过云函数）
async function batchImportToCloud() {
  if (!migrationResult.value.data) {
    ElMessage.warning('没有可导入的数据')
    return
  }

  importing.value = true
  showProgress.value = true
  importErrors.value = []
  importedCount.value = 0
  totalCount.value = migrationResult.value.data.length
  importStatus.value = ''

  try {
    // 调用云函数批量导入
    const result = await callCloudFunction('batchImportMembers', {
      members: migrationResult.value.data,
      clearExisting: false
    })
    
    if (result.success) {
      importedCount.value = result.imported
      importErrors.value = result.errors || []
      importProgress.value = 100
      importStatus.value = result.failed > 0 ? 'exception' : 'success'
      
      if (result.failed === 0) {
        ElMessage.success(`成功导入 ${result.imported} 条记录`)
      } else {
        ElMessage.warning(`导入完成，成功 ${result.imported} 条，失败 ${result.failed} 条`)
      }
    } else {
      throw new Error(result.message || '导入失败')
    }
  } catch (error) {
    console.error('批量导入失败:', error)
    ElMessage.error('批量导入失败: ' + error.message)
    importStatus.value = 'exception'
    
    // 如果云函数调用失败，提示用户使用控制台导入
    ElMessage.info('请使用"方式一：控制台导入"，下载文件后手动导入')
  } finally {
    importing.value = false
  }
}

// 重置
function reset() {
  activeStep.value = 0
  rawData.value = null
  migrationResult.value = {}
  importProgress.value = 0
  importStatus.value = ''
  importedCount.value = 0
  totalCount.value = 0
  importErrors.value = []
}
</script>

<style scoped>
.data-migration {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 18px;
  font-weight: bold;
}

.steps {
  margin: 30px 0;
}

.step-content {
  margin-top: 20px;
}

.stats-row {
  margin: 20px 0;
}

.success-stat {
  :deep(.el-statistic__content) {
    color: #67c23a;
  }
}

.error-stat {
  :deep(.el-statistic__content) {
    color: #f56c6c;
  }
}

.warning-stat {
  :deep(.el-statistic__content) {
    color: #e6a23c;
  }
}

.stat-item {
  text-align: center;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #409eff;
}

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}

.action-area {
  margin-top: 30px;
  text-align: center;
}
</style>
