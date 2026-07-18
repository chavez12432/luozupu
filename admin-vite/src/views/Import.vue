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
      
      <el-steps :active="activeStep" finish-status="success" class="steps">
        <el-step title="下载模板" />
        <el-step title="填写数据" />
        <el-step title="上传文件" />
        <el-step title="确认导入" />
      </el-steps>
      
      <div class="upload-section" v-if="activeStep === 2">
        <el-upload
          class="upload-demo"
          drag
          action="#"
          :auto-upload="false"
          :on-change="handleFileChange"
          accept=".xlsx,.xls,.csv"
        >
          <el-icon class="el-icon--upload" size="60" color="#409EFF"><upload-filled /></el-icon>
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
      
      <div v-if="previewData.length > 0" class="preview-section">
        <h3>数据预览（前10条）</h3>
        <el-table :data="previewData" border style="width: 100%" size="small">
          <el-table-column prop="name" label="姓名" width="100" fixed />
          <el-table-column prop="generation" label="世代" width="80" />
          <el-table-column prop="branch" label="分堂" width="100" />
          <el-table-column prop="gender" label="性别" width="80" />
          <el-table-column label="在世" width="80">
            <template #default="scope">
              <el-tag v-if="scope.row.isAlive" type="success" size="small">是</el-tag>
              <el-tag v-else type="danger" size="small">否</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="断层" width="80">
            <template #default="scope">
              <el-tag v-if="scope.row.hasBrokenLineage" type="warning" size="small">是</el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="出生日期" width="150">
            <template #default="scope">
              <div v-if="scope.row.birthDate">
                {{ scope.row.birthDate.year }}-{{ scope.row.birthDate.month }}-{{ scope.row.birthDate.day }}
                <el-tag v-if="scope.row.birthDateLeap" type="warning" size="small">闰</el-tag>
              </div>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="逝世日期" width="150">
            <template #default="scope">
              <div v-if="scope.row.deathDate">
                {{ scope.row.deathDate.year }}-{{ scope.row.deathDate.month }}-{{ scope.row.deathDate.day }}
                <el-tag v-if="scope.row.deathDateLeap" type="warning" size="small">闰</el-tag>
              </div>
              <span v-else-if="!scope.row.isAlive">-</span>
              <el-tag v-else type="success" size="small">在世</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="fatherName" label="父亲" width="100" />
          <el-table-column prop="motherName" label="母亲" width="100" />
          <el-table-column prop="spouseName" label="配偶" width="100" />
          <el-table-column label="学历" width="120">
            <template #default="scope">
              <el-tag v-for="(edu, idx) in scope.row.education.slice(0, 2)" :key="idx" size="small" style="margin-right: 4px;">
                {{ edu.degree }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="职位" width="150">
            <template #default="scope">
              <div v-for="(pos, idx) in scope.row.positions.slice(0, 2)" :key="idx" class="position-tag">
                {{ pos.title }}
                <el-tag v-if="pos.isCurrent" type="success" size="small">现任</el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="birthplace" label="出生地" width="100" />
          <el-table-column prop="residence" label="现居地" width="100" />
          <el-table-column prop="phone" label="电话" width="120" />
        </el-table>
        
        <div class="import-actions">
          <el-button @click="reset">重新上传</el-button>
          <el-button type="primary" :loading="importing" @click="confirmImport">
            确认导入
          </el-button>
        </div>
      </div>
      
      <el-collapse class="instructions">
        <el-collapse-item title="导入字段说明" name="1">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="姓名*" :span="2">必填，族人姓名</el-descriptions-item>
            <el-descriptions-item label="世代*">必填，数字，如25</el-descriptions-item>
            <el-descriptions-item label="分堂">中和堂/明儒堂/德裕堂/忠爱堂</el-descriptions-item>
            <el-descriptions-item label="性别">男/女</el-descriptions-item>
            <el-descriptions-item label="是否在世">是/否，默认是</el-descriptions-item>
            <el-descriptions-item label="是否断层">是/否，默认否</el-descriptions-item>
            <el-descriptions-item label="断层说明" :span="2">断层原因说明</el-descriptions-item>
            <el-descriptions-item label="出生日期(农历)">格式：YYYY-M-D，如1985-8-15</el-descriptions-item>
            <el-descriptions-item label="出生日期闰月">是/否</el-descriptions-item>
            <el-descriptions-item label="逝世日期(农历)">格式：YYYY-M-D</el-descriptions-item>
            <el-descriptions-item label="逝世日期闰月">是/否</el-descriptions-item>
            <el-descriptions-item label="父亲姓名">用于关联父子关系</el-descriptions-item>
            <el-descriptions-item label="母亲姓名">母亲姓名</el-descriptions-item>
            <el-descriptions-item label="配偶姓名">配偶姓名</el-descriptions-item>
            <el-descriptions-item label="出生地">籍贯</el-descriptions-item>
            <el-descriptions-item label="现居地">现居住地址</el-descriptions-item>
            <el-descriptions-item label="联系电话">手机号码</el-descriptions-item>
            <el-descriptions-item label="学历1">如：本科</el-descriptions-item>
            <el-descriptions-item label="学校1">毕业院校</el-descriptions-item>
            <el-descriptions-item label="专业1">所学专业</el-descriptions-item>
            <el-descriptions-item label="毕业年份1">如：2008</el-descriptions-item>
            <el-descriptions-item label="学历2">第二学历（如有）</el-descriptions-item>
            <el-descriptions-item label="学校2">第二学校</el-descriptions-item>
            <el-descriptions-item label="职位1">职位名称</el-descriptions-item>
            <el-descriptions-item label="单位1">工作单位</el-descriptions-item>
            <el-descriptions-item label="职位级别1">正国级/副国级/正部级等</el-descriptions-item>
            <el-descriptions-item label="是否现任1">是/否</el-descriptions-item>
            <el-descriptions-item label="荣誉类型1">军人/烈士/荣誉称号/勋章等</el-descriptions-item>
            <el-descriptions-item label="荣誉名称1">具体荣誉名称</el-descriptions-item>
            <el-descriptions-item label="荣誉级别1">国家级/省级/市级/县级</el-descriptions-item>
            <el-descriptions-item label="获得年份1">如：2020</el-descriptions-item>
            <el-descriptions-item label="备注" :span="2">原biography字段内容，个人简介、传记等</el-descriptions-item>
          </el-descriptions>
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

const downloadTemplate = () => {
  // 表头 - 包含所有字段
  const headers = [
    '姓名*', '世代*', '分堂', '性别', '是否在世', '是否断层', '断层说明',
    '出生日期(农历)', '出生日期闰月', '逝世日期(农历)', '逝世日期闰月',
    '父亲姓名', '母亲姓名', '配偶姓名',
    '出生地', '现居地', '联系电话',
    '学历1', '学校1', '专业1', '毕业年份1',
    '学历2', '学校2', '专业2', '毕业年份2',
    '职位1', '单位1', '职位级别1', '是否现任1',
    '职位2', '单位2', '职位级别2', '是否现任2',
    '荣誉类型1', '荣誉名称1', '荣誉级别1', '获得年份1',
    '荣誉类型2', '荣誉名称2', '荣誉级别2', '获得年份2',
    '备注'
  ]
  
  // 示例数据
  const exampleData = [
    '罗某某', 25, '明儒堂', '男', '是', '否', '',
    '1985-8-15', '否', '', '',
    '罗某', '张氏', '李氏',
    '广东梅州', '广东深圳', '13800138000',
    '本科', '中山大学', '计算机', 2008,
    '硕士', '北京大学', '软件工程', 2011,
    '工程师', '腾讯科技', '其他', '是',
    '技术总监', '阿里巴巴', '其他', '否',
    '荣誉称号', '优秀员工', '市级', 2020,
    '', '', '', '',
    ''
  ]
  
  const ws = XLSX.utils.aoa_to_sheet([headers, exampleData])
  
  // 设置列宽
  ws['!cols'] = headers.map(() => ({ wch: 15 }))
  
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '导入模板')
  
  // 添加说明sheet
  const instructions = [
    ['字段名', '说明', '必填', '示例'],
    ['姓名', '族人姓名', '是', '罗某某'],
    ['世代', '家族世代，数字1-50', '是', '25'],
    ['分堂', '中和堂/明儒堂/德裕堂/忠爱堂', '否', '明儒堂'],
    ['性别', '男/女', '否', '男'],
    ['是否在世', '是/否，默认是', '否', '是'],
    ['是否断层', '是/否，默认否', '否', '否'],
    ['断层说明', '断层原因说明', '否', '18代某支失考'],
    ['出生日期(农历)', '格式：YYYY-M-D', '否', '1985-8-15'],
    ['出生日期闰月', '是/否', '否', '否'],
    ['逝世日期(农历)', '格式：YYYY-M-D，已故时填写', '否', '2020-3-10'],
    ['逝世日期闰月', '是/否', '否', '否'],
    ['父亲姓名', '父亲姓名，用于关联', '否', '罗某'],
    ['母亲姓名', '母亲姓名', '否', '张氏'],
    ['配偶姓名', '配偶姓名', '否', '李氏'],
    ['出生地', '籍贯', '否', '广东梅州'],
    ['现居地', '现居住地址', '否', '广东深圳'],
    ['联系电话', '手机号码', '否', '13800138000'],
    ['学历1-2', '学历层次', '否', '本科/硕士'],
    ['学校1-2', '毕业院校', '否', '中山大学'],
    ['专业1-2', '所学专业', '否', '计算机'],
    ['毕业年份1-2', '毕业年份', '否', '2008'],
    ['职位1-2', '职位名称', '否', '工程师'],
    ['单位1-2', '工作单位', '否', '腾讯科技'],
    ['职位级别1-2', '正国级/副国级/正部级/副部级/正厅级/副厅级/正处级/副处级/正科级/副科级/其他', '否', '其他'],
    ['是否现任1-2', '是/否', '否', '是'],
    ['荣誉类型1-2', '军人/烈士/荣誉称号/表彰/勋章/学位/科举/其他', '否', '荣誉称号'],
    ['荣誉名称1-2', '具体荣誉名称', '否', '优秀员工'],
    ['荣誉级别1-2', '国家级/省级/市级/县级/其他', '否', '市级'],
    ['获得年份1-2', '获得年份', '否', '2020'],
    ['备注', '原biography字段内容，个人简介、传记等', '否', '']
  ]
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions)
  wsInstructions['!cols'] = [{ wch: 20 }, { wch: 50 }, { wch: 10 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsInstructions, '填写说明')
  
  XLSX.writeFile(wb, '高洲罗氏族谱导入模板.xlsx')
  
  ElMessage.success('模板下载成功')
}

const handleFileChange = (file) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result)
    const workbook = XLSX.read(data, { type: 'array' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(firstSheet)
    
    previewData.value = jsonData.slice(0, 10).map(row => {
      // 解析农历日期
      const parseLunarDate = (dateStr) => {
        if (!dateStr) return null
        const parts = String(dateStr).split('-')
        if (parts.length !== 3) return null
        return {
          year: parseInt(parts[0]),
          month: parseInt(parts[1]),
          day: parseInt(parts[2])
        }
      }
      
      // 构建学历数组
      const education = []
      if (row['学历1']) {
        education.push({
          degree: row['学历1'],
          school: row['学校1'] || '',
          major: row['专业1'] || '',
          year: row['毕业年份1'] || null
        })
      }
      if (row['学历2']) {
        education.push({
          degree: row['学历2'],
          school: row['学校2'] || '',
          major: row['专业2'] || '',
          year: row['毕业年份2'] || null
        })
      }
      
      // 构建职位数组
      const positions = []
      if (row['职位1']) {
        positions.push({
          title: row['职位1'],
          organization: row['单位1'] || '',
          level: row['职位级别1'] || '',
          isCurrent: row['是否现任1'] === '是'
        })
      }
      if (row['职位2']) {
        positions.push({
          title: row['职位2'],
          organization: row['单位2'] || '',
          level: row['职位级别2'] || '',
          isCurrent: row['是否现任2'] === '是'
        })
      }
      
      // 构建荣誉数组
      const honors = []
      if (row['荣誉名称1']) {
        honors.push({
          type: row['荣誉类型1'] || '',
          title: row['荣誉名称1'],
          level: row['荣誉级别1'] || '',
          year: row['获得年份1'] || null
        })
      }
      if (row['荣誉名称2']) {
        honors.push({
          type: row['荣誉类型2'] || '',
          title: row['荣誉名称2'],
          level: row['荣誉级别2'] || '',
          year: row['获得年份2'] || null
        })
      }
      
      return {
        name: row['姓名*'] || row['姓名'] || '',
        generation: row['世代*'] || row['世代'] || '',
        branch: row['分堂'] || '',
        gender: row['性别'] || '',
        isAlive: row['是否在世'] !== '否',
        hasBrokenLineage: row['是否断层'] === '是',
        brokenLineageNote: row['断层说明'] || '',
        birthDate: parseLunarDate(row['出生日期(农历)'] || row['出生日期']),
        birthDateLeap: row['出生日期闰月'] === '是',
        deathDate: parseLunarDate(row['逝世日期(农历)'] || row['逝世日期']),
        deathDateLeap: row['逝世日期闰月'] === '是',
        fatherName: row['父亲姓名'] || '',
        motherName: row['母亲姓名'] || '',
        spouseName: row['配偶姓名'] || '',
        birthplace: row['出生地'] || '',
        residence: row['现居地'] || '',
        phone: row['联系电话'] || '',
        education: education,
        positions: positions,
        honors: honors,
        remark: row['备注'] || ''
      }
    })
    
    activeStep.value = 3
    ElMessage.success(`成功读取 ${jsonData.length} 条数据`)
  }
  reader.readAsArrayBuffer(file.raw)
}

const confirmImport = async () => {
  importing.value = true
  try {
    ElMessage.success('导入成功')
    activeStep.value = 4
  } catch (error) {
    ElMessage.error('导入失败：' + error.message)
  } finally {
    importing.value = false
  }
}

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

.position-tag {
  margin-bottom: 2px;
}
</style>
