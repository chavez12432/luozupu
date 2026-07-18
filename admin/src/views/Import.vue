<template>
  <div class="import-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>批量导入人员资料</span>
          <el-button type="primary" @click="downloadTemplate">
            <el-icon><Download /></el-icon>
            下载导入模板
          </el-button>
        </div>
      </template>
      
      <!-- 导入步骤 -->
      <el-steps :active="activeStep" finish-status="success" class="steps">
        <el-step title="下载模板" />
        <el-step title="填写数据" />
        <el-step title="上传文件" />
        <el-step title="确认导入" />
      </el-steps>
      
      <!-- 上传区域 -->
      <div class="upload-section" v-if="activeStep === 2">
        <el-upload
          class="upload-demo"
          drag
          action="#"
          :auto-upload="false"
          :on-change="handleFileChange"
          accept=".xlsx,.xls,.csv"
        >
          <el-icon class="el-icon--upload"><upload-filled /></el-icon>
          <div class="el-upload__text">
            拖拽文件到此处或 <em>点击上传</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              支持 Excel (.xlsx, .xls) 或 CSV 格式文件
            </div>
          </template>
        </el-upload>
      </div>
      
      <!-- 数据预览 -->
      <div v-if="previewData.length > 0" class="preview-section">
        <h3>数据预览（前10条）</h3>
        <el-table :data="previewData" border style="width: 100%">
          <el-table-column prop="name" label="姓名" width="100" />
          <el-table-column prop="generation" label="世代" width="80" />
          <el-table-column prop="branch" label="分堂" width="100" />
          <el-table-column prop="gender" label="性别" width="80" />
          <el-table-column prop="birthDate" label="出生日期" width="150" />
          <el-table-column prop="fatherName" label="父亲姓名" width="100" />
          <el-table-column prop="birthplace" label="出生地" />
          <el-table-column prop="residence" label="现居地" />
        </el-table>
        
        <div class="import-actions">
          <el-button @click="reset">重新上传</el-button>
          <el-button type="primary" :loading="importing" @click="confirmImport">
            确认导入
          </el-button>
        </div>
      </div>
      
      <!-- 导入说明 -->
      <el-collapse class="instructions">
        <el-collapse-item title="导入字段说明" name="1">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="姓名*">必填，族人姓名</el-descriptions-item>
            <el-descriptions-item label="世代*">必填，数字，如25</el-descriptions-item>
            <el-descriptions-item label="分堂">中和堂/明儒堂/德裕堂/忠爱堂</el-descriptions-item>
            <el-descriptions-item label="性别">男/女</el-descriptions-item>
            <el-descriptions-item label="出生日期">格式：YYYY-M-D（农历）</el-descriptions-item>
            <el-descriptions-item label="逝世日期">格式：YYYY-M-D（农历）</el-descriptions-item>
            <el-descriptions-item label="父亲姓名">用于关联父子关系</el-descriptions-item>
            <el-descriptions-item label="出生地">籍贯</el-descriptions-item>
            <el-descriptions-item label="现居地">当前居住地</el-descriptions-item>
            <el-descriptions-item label="联系电话">手机号码</el-descriptions-item>
            <el-descriptions-item label="学历">格式：学校|学历|专业，多个用;分隔</el-descriptions-item>
            <el-descriptions-item label="职位">格式：单位|职位|级别，多个用;分隔</el-descriptions-item>
          </el-descriptions>
        </el-collapse-item>
        
        <el-collapse-item title="导入示例" name="2">
          <el-table :data="exampleData" border style="width: 100%">
            <el-table-column prop="name" label="姓名" width="100" />
            <el-table-column prop="generation" label="世代" width="80" />
            <el-table-column prop="branch" label="分堂" width="100" />
            <el-table-column prop="gender" label="性别" width="80" />
            <el-table-column prop="birthDate" label="出生日期" width="120" />
            <el-table-column prop="fatherName" label="父亲姓名" width="100" />
            <el-table-column prop="education" label="学历" />
          </el-table>
        </el-collapse-item>
      </el-collapse>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import * as XLSX from 'xlsx'
import { ElMessage } from 'element-plus'

const activeStep = ref(2)
const previewData = ref([])
const importing = ref(false)

// 示例数据
const exampleData = [
  {
    name: '罗某某',
    generation: 25,
    branch: '明儒堂',
    gender: '男',
    birthDate: '1985-8-15',
    fatherName: '罗某',
    education: '北京大学|本科|计算机科学;清华大学|硕士|软件工程'
  },
  {
    name: '罗某某',
    generation: 26,
    branch: '德裕堂',
    gender: '男',
    birthDate: '2010-3-20',
    fatherName: '罗某某',
    education: ''
  }
]

// 下载模板
const downloadTemplate = () => {
  const headers = [
    '姓名*', '世代*', '分堂', '性别', 
    '出生日期(农历)', '逝世日期(农历)', 
    '父亲姓名', '父亲世代',
    '出生地', '现居地', '联系电话',
    '学历', '职位', '荣誉', '备注'
  ]
  
  const ws = XLSX.utils.aoa_to_sheet([headers])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '导入模板')
  XLSX.writeFile(wb, '高洲罗氏族谱导入模板.xlsx')
  
  ElMessage.success('模板下载成功')
}

// 处理文件上传
const handleFileChange = (file) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result)
    const workbook = XLSX.read(data, { type: 'array' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(firstSheet)
    
    previewData.value = jsonData.slice(0, 10).map(row => ({
      name: row['姓名*'] || row['姓名'] || '',
      generation: row['世代*'] || row['世代'] || '',
      branch: row['分堂'] || '',
      gender: row['性别'] || '',
      birthDate: row['出生日期(农历)'] || row['出生日期'] || '',
      fatherName: row['父亲姓名'] || '',
      birthplace: row['出生地'] || '',
      residence: row['现居地'] || ''
    }))
    
    activeStep.value = 3
    ElMessage.success(`成功读取 ${jsonData.length} 条数据`)
  }
  reader.readAsArrayBuffer(file.raw)
}

// 确认导入
const confirmImport = async () => {
  importing.value = true
  
  try {
    // 这里调用后端API进行导入
    // await importMembers(previewData.value)
    
    ElMessage.success('导入成功')
    activeStep.value = 4
  } catch (error) {
    ElMessage.error('导入失败：' + error.message)
  } finally {
    importing.value = false
  }
}

// 重置
const reset = () => {
  previewData.value = []
  activeStep.value = 2
}
</script>

<style scoped>
.import-container {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.steps {
  margin: 30px 0;
}

.upload-section {
  margin: 30px 0;
}

.preview-section {
  margin-top: 30px;
}

.preview-section h3 {
  margin-bottom: 15px;
  color: #333;
}

.import-actions {
  margin-top: 20px;
  text-align: center;
}

.instructions {
  margin-top: 30px;
}
</style>
