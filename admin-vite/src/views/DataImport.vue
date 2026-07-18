<template>
  <div class="data-import">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>旧数据导入</span>
          <el-button type="primary" @click="loadData">
            <el-icon><Refresh /></el-icon>
            加载数据文件
          </el-button>
        </div>
      </template>

      <!-- 步骤条 -->
      <el-steps :active="activeStep" finish-status="success" class="steps">
        <el-step title="加载数据" />
        <el-step title="字段映射检查" />
        <el-step title="数据预览" />
        <el-step title="确认导入" />
      </el-steps>

      <!-- 步骤1: 加载数据 -->
      <div v-if="activeStep === 0" class="step-content">
        <el-alert
          title="数据导入说明"
          description="请上传 所有表0409.json 数据文件，系统将自动转换为新表格式并验证亲属关系。"
          type="info"
          show-icon
          :closable="false"
          style="margin-bottom: 20px;"
        />

        <el-alert
          v-if="localDataCount > 0"
          :title="`本地已有 ${localDataCount} 条数据，新导入将覆盖现有数据`"
          type="warning"
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
            拖拽 JSON 文件到此处或 <em>点击上传</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              请上传 所有表0409.json 文件
            </div>
          </template>
        </el-upload>

        <div class="action-area">
          <el-button type="primary" size="large" @click="loadData">
            尝试自动加载
          </el-button>
          <el-button v-if="localDataCount > 0" type="danger" size="large" @click="clearLocalData">
            清空本地数据
          </el-button>
        </div>
      </div>

      <!-- 步骤2: 字段映射检查 -->
      <div v-if="activeStep === 1" class="step-content">
        <h3>字段映射对照表</h3>
        <el-table :data="fieldMapping" border style="width: 100%">
          <el-table-column prop="source" label="源表字段" width="150" />
          <el-table-column prop="target" label="目标表字段" width="200" />
          <el-table-column prop="required" label="必填" width="80">
            <template #default="scope">
              <el-tag v-if="scope.row.required" type="danger">是</el-tag>
              <el-tag v-else type="info">否</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="说明" />
          <el-table-column label="状态" width="100">
            <template #default="scope">
              <el-tag type="success">✓</el-tag>
            </template>
          </el-table-column>
        </el-table>

        <el-divider />

        <h3>数据转换规则</h3>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="ID处理">
            原表ID保留，生成memberId格式为 M000001，确保唯一标识
          </el-descriptions-item>
          <el-descriptions-item label="日期处理">
            源表的公历日期将直接转换，系统会自动计算对应的干支、生肖、朝代信息
          </el-descriptions-item>
          <el-descriptions-item label="分堂转换">
            中和堂/明儒堂/德裕堂/忠爱堂（忠爱堂会转换为忠爱堂）
          </el-descriptions-item>
          <el-descriptions-item label="性别转换">
            male→男, female→女
          </el-descriptions-item>
          <el-descriptions-item label="学历解析">
            从education字段提取学历关键词（博士/硕士/本科等）
          </el-descriptions-item>
          <el-descriptions-item label="职位解析">
            从occupation字段按分号或换行分割为多个职位
          </el-descriptions-item>
          <el-descriptions-item label="亲属关联验证">
            <el-tag type="danger">重要</el-tag> 父亲/母亲的世代必须是子女世代-1，否则会被标记为关系异常
          </el-descriptions-item>
        </el-descriptions>

        <el-divider />

        <el-alert
          title="亲属关系验证规则"
          type="warning"
          :closable="false"
        >
          <template #default>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>23代人的父亲/母亲必须是22代</li>
              <li>34代人的父亲/母亲必须是33代</li>
              <li>不符合此规则的亲属关系会被标记为"断层"并记录错误</li>
              <li>同名人物通过ID区分，不会混淆</li>
            </ul>
          </template>
        </el-alert>

        <div class="action-area">
          <el-button @click="activeStep = 0">上一步</el-button>
          <el-button type="primary" @click="handlePreview">下一步：数据预览</el-button>
        </div>
      </div>

      <!-- 步骤3: 数据预览 -->
      <div v-if="activeStep === 2" class="step-content">
        <h3>转换结果统计</h3>
        <el-row :gutter="20" class="stats-row">
          <el-col :span="4">
            <el-statistic title="总记录数" :value="conversionResult.total" />
          </el-col>
          <el-col :span="5">
            <el-statistic title="成功转换" :value="conversionResult.success" class="success-stat" />
          </el-col>
          <el-col :span="5">
            <el-statistic title="转换失败" :value="conversionResult.failed" class="error-stat" />
          </el-col>
          <el-col :span="5">
            <el-statistic title="关系异常" :value="conversionResult.warningCount || 0" class="warning-stat" />
          </el-col>
          <el-col :span="5">
            <el-statistic title="成功率" :value="successRate" suffix="%" />
          </el-col>
        </el-row>

        <el-divider />

        <!-- 关系错误详情 -->
        <div v-if="conversionResult.warnings && conversionResult.warnings.length > 0">
          <h3>
            亲属关系异常
            <el-tag type="warning">{{ conversionResult.warnings.length }}条</el-tag>
          </h3>
          <el-alert
            title="以下记录的亲属关系不符合世代规则（父母必须是子女世代-1），已被标记为断层"
            type="warning"
            :closable="false"
            style="margin-bottom: 10px;"
          />
          <el-table :data="conversionResult.warnings.slice(0, 20)" border size="small" style="margin-bottom: 20px;">
            <el-table-column prop="memberId" label="MemberID" width="120" />
            <el-table-column prop="name" label="姓名" width="100" />
            <el-table-column prop="generation" label="世代" width="80">
              <template #default="scope">
                {{ getMemberGeneration(scope.row.memberId) }}代
              </template>
            </el-table-column>
            <el-table-column label="异常详情">
              <template #default="scope">
                <div v-for="(w, idx) in scope.row.warnings" :key="idx" class="warning-item">
                  <el-tag type="danger" size="small">{{ w.type === 'father' ? '父亲' : '母亲' }}</el-tag>
                  {{ w.name }}(ID:{{ w.id }}) - {{ w.error }}
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <h3>数据预览（前10条）</h3>
        <el-table :data="previewList" border style="width: 100%" size="small" max-height="500">
          <el-table-column prop="name" label="姓名" width="100" fixed />
          <el-table-column prop="generation" label="世代" width="70" />
          <el-table-column prop="branch" label="分堂" width="100" />
          <el-table-column prop="gender" label="性别" width="70" />
          <el-table-column label="寿命" width="80">
            <template #default="scope">
              <span v-if="scope.row.lifespan">{{ scope.row.lifespan }}岁</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="出生日期" width="180">
            <template #default="scope">
              <div v-if="scope.row.birthDate?.converted">
                {{ scope.row.birthDate.gregorian.formatted }}
                <el-tag size="small" type="warning">{{ scope.row.birthDate.ganzhi }}</el-tag>
              </div>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="逝世日期" width="180">
            <template #default="scope">
              <div v-if="scope.row.deathDate?.converted">
                {{ scope.row.deathDate.gregorian.formatted }}
                <el-tag size="small" type="warning">{{ scope.row.deathDate.ganzhi }}</el-tag>
              </div>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="fatherId" label="父亲ID" width="80" />
          <el-table-column prop="birthplace" label="出生地" width="120" show-overflow-tooltip />
          <el-table-column prop="residence" label="现居地" width="120" show-overflow-tooltip />
          <el-table-column label="学历" width="100">
            <template #default="scope">
              <el-tag v-for="(edu, idx) in scope.row.education.slice(0, 1)" :key="idx" size="small">
                {{ edu.degree }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="职位" width="150">
            <template #default="scope">
              <div v-for="(pos, idx) in scope.row.positions.slice(0, 1)" :key="idx" class="text-ellipsis">
                {{ pos.title }}
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div class="action-area">
          <el-button @click="activeStep = 1">上一步</el-button>
          <el-button type="primary" @click="activeStep = 3">下一步：确认导入</el-button>
        </div>
      </div>

      <!-- 步骤4: 确认导入 -->
      <div v-if="activeStep === 3" class="step-content">
        <h3>导入确认</h3>
        <el-alert
          title="即将导入数据"
          :description="`共 ${conversionResult.success} 条记录将被导入到系统中`"
          type="warning"
          show-icon
          :closable="false"
        />

        <el-divider />

        <h4>导入选项</h4>
        <el-form :model="importOptions" label-width="150px">
          <el-form-item label="冲突处理">
            <el-radio-group v-model="importOptions.conflictMode">
              <el-radio label="skip">跳过重复</el-radio>
              <el-radio label="overwrite">覆盖现有</el-radio>
              <el-radio label="merge">合并数据</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="自动关联亲属">
            <el-switch v-model="importOptions.autoLinkRelatives" active-text="是" inactive-text="否" />
            <div class="form-tip">导入后自动根据father_id和mother_id关联亲属关系</div>
          </el-form-item>
        </el-form>

        <div class="action-area">
          <el-button @click="activeStep = 2">上一步</el-button>
          <el-button type="primary" :loading="importing" @click="confirmImport">
            确认导入
          </el-button>
        </div>
      </div>

      <!-- 导入结果 -->
      <div v-if="activeStep === 4" class="step-content">
        <el-result
          :icon="importResult.success ? 'success' : 'error'"
          :title="importResult.success ? '导入成功' : '导入完成（部分失败）'"
          :sub-title="`成功导入 ${importResult.imported} 条记录，失败 ${importResult.failed} 条`"
        >
          <template #extra>
            <el-button type="primary" @click="goToList">查看族人列表</el-button>
            <el-button @click="reset">重新导入</el-button>
          </template>
        </el-result>

        <div v-if="importResult.errors.length > 0">
          <h4>错误明细</h4>
          <el-table :data="importResult.errors" border size="small">
            <el-table-column prop="index" label="序号" width="80" />
            <el-table-column prop="name" label="姓名" width="100" />
            <el-table-column prop="error" label="错误信息" />
          </el-table>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { convertAllPersons, generateFieldMapping, generateValidationReport } from '../utils/dataConverter.js'
import { memberApi, clearAllMembers, getMembers } from '../api/localStorage.js'

const router = useRouter()
const activeStep = ref(0)
const loading = ref(false)
const importing = ref(false)

// 原始数据
const rawData = ref(null)
const conversionResult = ref({
  total: 0,
  success: 0,
  failed: 0,
  data: [],
  errors: []
})

// 字段映射
const fieldMapping = ref(generateFieldMapping())

// 预览数据（计算属性）
const previewList = computed(() => {
  return conversionResult.value.data.slice(0, 10)
})

  // 成功率
const successRate = computed(() => {
  if (conversionResult.value.total === 0) return 0
  return Math.round((conversionResult.value.success / conversionResult.value.total) * 100)
})

// 获取成员世代
function getMemberGeneration(memberId) {
  const member = conversionResult.value.data.find(m => m.memberId === memberId)
  return member ? member.generation : '-'
}

// 导入选项
const importOptions = ref({
  conflictMode: 'skip',
  autoLinkRelatives: true
})

// 本地数据数量
const localDataCount = ref(0)

// 刷新本地数据数量
function refreshLocalCount() {
  localDataCount.value = getMembers().length
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

// 页面加载时获取本地数据数量
refreshLocalCount()

// 导入结果
const importResult = ref({
  success: true,
  imported: 0,
  failed: 0,
  errors: []
})

// 加载数据
async function loadData() {
  loading.value = true
  try {
    // 尝试从 public 目录加载
    const response = await fetch('/所有表0409.json')
    if (response.ok) {
      rawData.value = await response.json()
      ElMessage.success('数据加载成功')
      activeStep.value = 1
      return
    }
  } catch (error) {
    console.log('从public加载失败，尝试其他方式')
  }

  // 如果 fetch 失败，提示用户手动上传
  ElMessage.warning('自动加载失败，请手动上传数据文件')
  loading.value = false
}

// 处理文件上传
function handleFileUpload(file) {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      rawData.value = JSON.parse(e.target.result)
      ElMessage.success('文件上传成功')
      activeStep.value = 1
    } catch (error) {
      ElMessage.error('JSON解析失败: ' + error.message)
    }
  }
  reader.readAsText(file.raw)
}

// 处理数据预览
function handlePreview() {
  if (!rawData.value) {
    ElMessage.warning('请先加载数据')
    return
  }

  loading.value = true
  try {
    conversionResult.value = convertAllPersons(rawData.value)
    activeStep.value = 2
    ElMessage.success(`数据转换完成，成功 ${conversionResult.value.success} 条`)
  } catch (error) {
    ElMessage.error('数据转换失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

// 确认导入
async function confirmImport() {
  importing.value = true
  importResult.value.errors = []

  try {
    const data = conversionResult.value.data
    
    // 调用云函数批量导入
    const result = await memberApi.batchImport(data)
    
    if (result.success) {
      importResult.value = {
        success: result.failed === 0,
        imported: result.imported,
        failed: result.failed,
        errors: result.errors || []
      }
      ElMessage.success(`成功导入 ${result.imported} 条记录`)
    } else {
      importResult.value = {
        success: false,
        imported: result.imported || 0,
        failed: result.failed || data.length,
        errors: result.errors || [{ error: result.message || '导入失败' }]
      }
      ElMessage.warning(`导入完成，成功 ${result.imported || 0} 条，失败 ${result.failed || 0} 条`)
    }

    activeStep.value = 4
  } catch (error) {
    console.error('导入失败:', error)
    ElMessage.error('导入失败: ' + (error.message || '未知错误'))
    importResult.value = {
      success: false,
      imported: 0,
      failed: conversionResult.value.data.length,
      errors: [{ error: error.message }]
    }
    activeStep.value = 4
  } finally {
    importing.value = false
  }
}

// 跳转到列表
function goToList() {
  router.push('/members')
}

// 重置
function reset() {
  activeStep.value = 0
  rawData.value = null
  conversionResult.value = {
    total: 0,
    success: 0,
    failed: 0,
    data: [],
    errors: []
  }
}
</script>

<style scoped>
.data-import {
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

.action-area {
  margin-top: 30px;
  text-align: center;
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

.warning-item {
  margin-bottom: 5px;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}

.text-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
