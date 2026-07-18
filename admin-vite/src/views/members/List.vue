<template>
  <div class="members-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>族人列表</span>
          <div class="header-actions">
            <el-button type="success" @click="exportToExcel">
              <el-icon><Download /></el-icon>
              导出Excel
            </el-button>
            <el-upload
              class="import-btn"
              action="#"
              :auto-upload="false"
              :show-file-list="false"
              :on-change="handleExcelImport"
              accept=".xlsx,.xls"
            >
              <el-button type="warning">
                <el-icon><Upload /></el-icon>
                导入Excel
              </el-button>
            </el-upload>
            <el-button type="primary" @click="goToAdd">
              <el-icon><Plus /></el-icon>
              添加族人
            </el-button>
          </div>
        </div>
      </template>
      
      <!-- 搜索栏 -->
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="姓名">
          <el-input v-model="searchForm.name" placeholder="请输入姓名" clearable />
        </el-form-item>
        <el-form-item label="世代">
          <el-input-number v-model="searchForm.generation" :min="1" :max="50" placeholder="世代" />
        </el-form-item>
        <el-form-item label="分堂" class="branch-form-item">
          <el-select
            v-model="searchForm.branch"
            placeholder="选择分堂"
            clearable
            class="branch-select"
          >
            <el-option label="中和堂" value="中和堂" />
            <el-option label="明儒堂" value="明儒堂" />
            <el-option label="德裕堂" value="德裕堂" />
            <el-option label="忠爱堂" value="忠爱堂" />
          </el-select>
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
        <el-table-column type="selection" width="50" fixed />
        <el-table-column prop="memberId" label="ID" width="100" fixed />
        <el-table-column prop="name" label="姓名" width="100">
          <template #default="scope">
            <el-link type="primary" :underline="false" @click="handleEdit(scope.row)">
              {{ scope.row.name }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column prop="generation" label="世代" width="80">
          <template #default="scope">
            <el-tag :type="scope.row.generation <= PUBLIC_GENERATION_THRESHOLD ? 'success' : 'warning'" size="small">
              {{ scope.row.generation }}代
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="branch" label="分堂" width="100" />
        <el-table-column prop="gender" label="性别" width="80" />
        
        <!-- 出生日期：32代后需要隐私设置 -->
        <el-table-column label="出生日期" width="180">
          <template #default="scope">
            <template v-if="isGenerationPublic(scope.row.generation) || scope.row.isPublic">
              <div v-if="scope.row.birthDate?.lunar?.year">
                <div>农历：{{ scope.row.birthDate.lunar.year }}年{{ lunarMonths[scope.row.birthDate.lunar.month-1] }}月{{ lunarDays[scope.row.birthDate.lunar.day-1] }}</div>
                <div v-if="scope.row.birthDate.ganzhi" class="text-gray">{{ scope.row.birthDate.ganzhi }}</div>
              </div>
              <span v-else>-</span>
            </template>
            <el-tag v-else type="info" size="small">已隐藏</el-tag>
          </template>
        </el-table-column>
        
        <!-- 逝世日期：32代后需要隐私设置 -->
        <el-table-column label="逝世日期" width="180">
          <template #default="scope">
            <template v-if="isGenerationPublic(scope.row.generation) || scope.row.isPublic">
              <div v-if="scope.row.deathDate?.lunar?.year">
                <div>农历：{{ scope.row.deathDate.lunar.year }}年{{ lunarMonths[scope.row.deathDate.lunar.month-1] }}月{{ lunarDays[scope.row.deathDate.lunar.day-1] }}</div>
                <div v-if="scope.row.deathDate.ganzhi" class="text-gray">{{ scope.row.deathDate.ganzhi }}</div>
              </div>
              <span v-else>-</span>
            </template>
            <el-tag v-else type="info" size="small">已隐藏</el-tag>
          </template>
        </el-table-column>
        
        <!-- 寿命：32代后需要隐私设置 -->
        <el-table-column label="寿命" width="80">
          <template #default="scope">
            <template v-if="isGenerationPublic(scope.row.generation) || scope.row.isPublic">
              <el-tag v-if="scope.row.lifespan" type="info" size="small">{{ scope.row.lifespan }}岁</el-tag>
              <span v-else>-</span>
            </template>
            <el-tag v-else type="info" size="small">已隐藏</el-tag>
          </template>
        </el-table-column>
        
        <!-- 父亲：32代后需要隐私设置 -->
        <el-table-column label="父亲" width="150">
          <template #default="scope">
            <template v-if="isGenerationPublic(scope.row.generation) || scope.row.isPublic">
              {{ scope.row._fatherName || scope.row.fatherName || '-' }}
            </template>
            <el-tag v-else type="info" size="small">已隐藏</el-tag>
          </template>
        </el-table-column>
        
        <!-- 母亲：32代后需要隐私设置 -->
        <el-table-column label="母亲" width="150">
          <template #default="scope">
            <template v-if="isGenerationPublic(scope.row.generation) || scope.row.isPublic">
              {{ scope.row._motherName || scope.row.motherName || '-' }}
            </template>
            <el-tag v-else type="info" size="small">已隐藏</el-tag>
          </template>
        </el-table-column>
        
        <!-- 配偶ID和姓名 -->
        <el-table-column label="配偶" width="200">
          <template #default="scope">
            <template v-if="isGenerationPublic(scope.row.generation) || scope.row.isPublic">
              <div v-if="scope.row.spouseId">
                <el-tag size="small" type="info">{{ scope.row.spouseId }}</el-tag>
                <span style="margin-left: 5px;">{{ scope.row._spouseName || scope.row.spouseName || '' }}</span>
              </div>
              <span v-else>-</span>
            </template>
            <el-tag v-else type="info" size="small">已隐藏</el-tag>
          </template>
        </el-table-column>
        
        <!-- 学历：32代后需要隐私设置 -->
        <el-table-column label="学历" width="120">
          <template #default="scope">
            <template v-if="isGenerationPublic(scope.row.generation) || scope.row.isPublic">
              <div v-if="scope.row.education && scope.row.education.length > 0">
                <el-tag v-for="(edu, idx) in scope.row.education.slice(0, 2)" :key="idx" size="small" style="margin-right: 5px; margin-bottom: 2px;">
                  {{ edu.degree }}
                </el-tag>
                <span v-if="scope.row.education.length > 2">...</span>
              </div>
              <span v-else>-</span>
            </template>
            <el-tag v-else type="info" size="small">已隐藏</el-tag>
          </template>
        </el-table-column>
        
        <!-- 职位：32代后需要隐私设置 -->
        <el-table-column label="职位" width="150">
          <template #default="scope">
            <template v-if="isGenerationPublic(scope.row.generation) || scope.row.isPublic">
              <div v-if="scope.row.positions && scope.row.positions.length > 0">
                <div v-for="(pos, idx) in scope.row.positions.slice(0, 2)" :key="idx" class="position-item">
                  {{ pos.title }}
                  <el-tag v-if="pos.isCurrent" type="success" size="small">现任</el-tag>
                </div>
                <span v-if="scope.row.positions.length > 2">...</span>
              </div>
              <span v-else>-</span>
            </template>
            <el-tag v-else type="info" size="small">已隐藏</el-tag>
          </template>
        </el-table-column>
        
        <!-- 现居地：32代后需要隐私设置 -->
        <el-table-column label="现居地" width="120">
          <template #default="scope">
            <template v-if="isGenerationPublic(scope.row.generation) || scope.row.isPublic">
              {{ scope.row.residence || '-' }}
            </template>
            <el-tag v-else type="info" size="small">已隐藏</el-tag>
          </template>
        </el-table-column>
        
        <!-- 断层 -->
        <el-table-column label="断层" width="80">
          <template #default="scope">
            <el-tag v-if="scope.row.hasBrokenLineage" type="warning" size="small">是</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        
        <!-- 隐私状态 -->
        <el-table-column label="隐私" width="80">
          <template #default="scope">
            <template v-if="isGenerationPublic(scope.row.generation)">
              <el-tag type="success" size="small">公开</el-tag>
            </template>
            <template v-else>
              <el-tag :type="scope.row.isPublic ? 'success' : 'warning'" size="small">
                {{ scope.row.isPublic ? '已公开' : '私密' }}
              </el-tag>
            </template>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="scope">
            <el-button type="primary" size="small" @click="handleEdit(scope.row)">编辑</el-button>
            <el-button type="danger" size="small" @click="handleDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <!-- 分页 -->
      <div class="pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { memberApi, initCloud } from '../../api/cloudApi.js'
import { membersEditRoute, membersListRoute } from '../../utils/membersListQuery.js'
import * as XLSX from 'xlsx'

const router = useRouter()
const route = useRoute()

// 隐私设置常量：默认全公开，测试阶段不限制
// TODO: 32代后可以自己选择部分非公开
const PUBLIC_GENERATION_THRESHOLD = 999

// 检查世代是否公开（32代及之前公开）
const isGenerationPublic = (generation) => {
  return generation && generation <= PUBLIC_GENERATION_THRESHOLD
}

const searchForm = reactive({
  name: '',
  generation: null,
  branch: ''
})

// 农历月份和日期名称
const lunarMonths = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊']
const lunarDays = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
]

const tableData = ref([])
const selectedRows = ref([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const loading = ref(false)
const cloudInitialized = ref(false)

function buildListQuery() {
  const q = {}
  if (searchForm.branch) q.branch = searchForm.branch
  if (searchForm.generation != null && searchForm.generation !== '') {
    q.generation = String(searchForm.generation)
  }
  if (searchForm.name) q.name = searchForm.name
  if (page.value > 1) q.page = String(page.value)
  if (pageSize.value !== 10) q.pageSize = String(pageSize.value)
  return q
}

function applyQueryFromRoute() {
  const q = route.query
  searchForm.branch = q.branch ? String(q.branch) : ''
  searchForm.generation = q.generation ? Number(q.generation) : null
  searchForm.name = q.name ? String(q.name) : ''
  page.value = q.page ? Math.max(1, Number(q.page) || 1) : 1
  pageSize.value = q.pageSize ? Number(q.pageSize) || 10 : 10
}

function syncQueryToUrl() {
  router.replace(membersListRoute(buildListQuery()))
}

// 初始化云开发（代理未启动时列表仍可走本地 JSON 回退）
async function init() {
  try {
    cloudInitialized.value = await initCloud()
  } catch (error) {
    console.error('初始化失败:', error)
    cloudInitialized.value = false
  }
  loadMembers()
}

// 加载成员列表
async function loadMembers() {
  loading.value = true
  try {
    const result = await memberApi.getList({
      branch: searchForm.branch,
      generation: searchForm.generation,
      name: searchForm.name,
      page: page.value,
      pageSize: pageSize.value
    })
    
    if (result.success) {
      tableData.value = result.data || []
      total.value = result.total || result.data?.length || 0
      if (result.source === 'local-json') {
        ElMessage.warning('代理未连接，当前为本地 JSON 只读数据；保存/删除请先启动 proxy-server')
      }
    } else {
      ElMessage.error(result.message || '获取数据失败')
    }
  } catch (error) {
    console.error('获取成员列表失败:', error)
    ElMessage.error('获取数据失败: ' + (error.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

// 页面加载时获取数据（支持从 URL 恢复筛选与分页）
onMounted(() => {
  applyQueryFromRoute()
  init()
})

const handleSearch = () => {
  page.value = 1
  loadMembers()
  syncQueryToUrl()
}

const resetSearch = () => {
  searchForm.name = ''
  searchForm.generation = null
  searchForm.branch = ''
  page.value = 1
  loadMembers()
  syncQueryToUrl()
}

const goToAdd = () => {
  router.push('/members/add')
}

const handleEdit = (row) => {
  if (!row._id) {
    ElMessage.warning('该记录没有ID，无法编辑')
    return
  }
  router.push(membersEditRoute(row._id, buildListQuery()))
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('确认删除该记录？', '提示', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    loading.value = true
    const result = await memberApi.delete(row._id)
    
    if (result.success) {
      ElMessage.success('删除成功')
      loadMembers()
    } else {
      ElMessage.error(result.message || '删除失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败: ' + (error.message || '未知错误'))
    }
  } finally {
    loading.value = false
  }
}

const handleSizeChange = (val) => {
  pageSize.value = val
  page.value = 1
  loadMembers()
  syncQueryToUrl()
}

const handleCurrentChange = (val) => {
  page.value = val
  loadMembers()
  syncQueryToUrl()
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
          const result = await memberApi.delete(row._id)
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
    loadMembers()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('批量删除失败')
    }
  } finally {
    loading.value = false
  }
}

// 导出Excel（直连云库全量，含配偶/母亲 ID，字段与导入对齐）
async function exportToExcel() {
  try {
    ElMessage.info('正在导出数据...')

    const result = await memberApi.exportAll()

    if (!result.success || !result.data || result.data.length === 0) {
      ElMessage.warning(result.message || '没有数据可导出')
      return
    }

    const data = result.data

    const exportData = data.map(item => ({
      'MemberID': item.memberId || '',
      '云文档ID': item._id || '',
      '原表ID': item.originalId ?? '',
      '姓名': item.name || '',
      '性别': item.gender || '',
      '世代': item.generation || '',
      '分堂': item.branch || '',
      '父亲ID': item.fatherId || '',
      '父亲姓名': item.fatherName || '',
      '母亲ID': item.motherId || '',
      '母亲姓名': item.motherName || '',
      '配偶ID': item.spouseId || (Array.isArray(item.wifeIds) ? item.wifeIds[0] : '') || '',
      '配偶姓名': item.spouseName || '',
      '出生地': item.birthplace || '',
      '现居地': item.residence || '',
      '寿命': item.lifespan || '',
      '出生农历': item.birthDate?.lunar?.year
        ? `${item.birthDate.lunar.year}年${lunarMonths[item.birthDate.lunar.month - 1] || ''}月${lunarDays[item.birthDate.lunar.day - 1] || ''}`
        : '',
      '出生公历': item.birthDate?.gregorian?.formatted || '',
      '逝世农历': item.deathDate?.lunar?.year
        ? `${item.deathDate.lunar.year}年${lunarMonths[item.deathDate.lunar.month - 1] || ''}月${lunarDays[item.deathDate.lunar.day - 1] || ''}`
        : '',
      '逝世公历': item.deathDate?.gregorian?.formatted || '',
      '学历': Array.isArray(item.education)
        ? item.education.map(e => (typeof e === 'string' ? e : e.degree)).filter(Boolean).join('; ')
        : '',
      '职位': Array.isArray(item.positions)
        ? item.positions.map(p => (typeof p === 'string' ? p : p.title)).filter(Boolean).join('; ')
        : '',
      '备注': item.remark || ''
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '族人列表')

    const fileName = `族人列表_${new Date().toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(wb, fileName)

    ElMessage.success(`成功导出 ${exportData.length} 条数据`)
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败: ' + (error.message || '未知错误'))
  }
}

// 导入Excel：优先按 MemberID / 云文档ID 更新，写云库并同步本地
async function handleExcelImport(file) {
  try {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)

        if (jsonData.length === 0) {
          ElMessage.warning('Excel文件中没有数据')
          return
        }

        ElMessage.info(`检测到 ${jsonData.length} 条数据，正在导入云库并同步本地...`)
        _memberIndexPromise = null // 每次导入重建索引

        let successCount = 0
        let failCount = 0
        const errors = []

        for (const row of jsonData) {
          try {
            const memberId = String(row['MemberID'] || row['ID'] || '').trim()
            const docId = String(row['云文档ID'] || row['_id'] || '').trim()
            const name = String(row['姓名'] || '').trim()
            if (!memberId && !docId && !name) continue

            const updateData = {}
            if (row['性别']) updateData.gender = String(row['性别']).trim()
            if (row['世代'] !== undefined && row['世代'] !== '') {
              updateData.generation = parseInt(row['世代'], 10)
            }
            if (row['分堂']) updateData.branch = String(row['分堂']).trim()
            if (row['父亲ID'] !== undefined) updateData.fatherId = String(row['父亲ID'] ?? '').trim()
            if (row['父亲姓名']) updateData.fatherName = String(row['父亲姓名']).trim()
            if (row['母亲ID'] !== undefined) updateData.motherId = String(row['母亲ID'] ?? '').trim()
            if (row['母亲姓名']) updateData.motherName = String(row['母亲姓名']).trim()
            if (row['配偶ID'] !== undefined) {
              const sid = String(row['配偶ID'] ?? '').trim()
              updateData.spouseId = sid
              if (/^W/i.test(sid)) updateData.wifeIds = [sid]
            }
            if (row['配偶姓名']) updateData.spouseName = String(row['配偶姓名']).trim()
            if (row['出生地'] !== undefined) updateData.birthplace = String(row['出生地'] ?? '').trim()
            if (row['现居地'] !== undefined) updateData.residence = String(row['现居地'] ?? '').trim()
            if (row['寿命'] !== undefined && row['寿命'] !== '') {
              updateData.lifespan = parseInt(row['寿命'], 10)
            }
            if (row['备注'] !== undefined) updateData.remark = String(row['备注'] ?? '')
            if (row['学历']) {
              const degrees = String(row['学历']).split(';').map(d => d.trim()).filter(Boolean)
              if (degrees.length) {
                updateData.education = degrees.map(d => ({ degree: d, school: '', major: '' }))
              }
            }
            if (row['职位']) {
              const titles = String(row['职位']).split(';').map(t => t.trim()).filter(Boolean)
              if (titles.length) {
                updateData.positions = titles.map(t => ({ title: t, organization: '', isCurrent: false }))
              }
            }

            let result
            if (docId) {
              result = await memberApi.update(docId, updateData)
            } else if (memberId || name) {
              result = await importUpdateByMemberId(memberId, name, updateData)
            }

            if (result && result.success) {
              successCount++
            } else {
              failCount++
              errors.push({ name: name || memberId || docId, error: (result && result.message) || '失败' })
            }
          } catch (err) {
            failCount++
            errors.push({ name: row['姓名'] || row['MemberID'] || '未知', error: err.message })
          }
        }

        ElMessage.success(`导入完成：成功 ${successCount} 条，失败 ${failCount} 条`)
        if (errors.length > 0) console.log('导入错误:', errors)
        loadMembers()
      } catch (err) {
        ElMessage.error('解析Excel失败: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file.raw)
  } catch (error) {
    ElMessage.error('导入失败: ' + error.message)
  }
}

/** 按 MemberID 定位后更新（内部用全量索引缓存） */
let _memberIndexPromise = null
async function getMemberIndex() {
  if (!_memberIndexPromise) {
    _memberIndexPromise = memberApi.exportAll().then((r) => {
      const byMemberId = new Map()
      const byName = new Map()
      for (const m of r.data || []) {
        if (m.memberId) byMemberId.set(String(m.memberId), m)
        if (m.name) {
          if (!byName.has(m.name)) byName.set(m.name, [])
          byName.get(m.name).push(m)
        }
      }
      return { byMemberId, byName }
    })
  }
  return _memberIndexPromise
}

async function importUpdateByMemberId(memberId, name, updateData) {
  const idx = await getMemberIndex()
  let doc = memberId ? idx.byMemberId.get(String(memberId)) : null
  if (!doc && name) {
    const list = idx.byName.get(name) || []
    doc = list.length === 1 ? list[0] : null
    if (!doc && list.length > 1) {
      return { success: false, message: `重名「${name}」共 ${list.length} 人，请使用 MemberID` }
    }
  }
  if (!doc || !doc._id) {
    return { success: false, message: `未找到 ${memberId || name}` }
  }
  return memberApi.update(doc._id, updateData)
}

</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.import-btn {
  display: inline-block;
}

.search-form {
  margin-bottom: 20px;
}

.search-form .branch-form-item :deep(.el-select) {
  width: 150px;
}

.search-form .branch-select {
  width: 150px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.text-gray {
  color: #909399;
  font-size: 12px;
}

.position-item {
  margin-bottom: 2px;
}
</style>
