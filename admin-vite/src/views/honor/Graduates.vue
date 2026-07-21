<template>
  <div class="graduates-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>学历榜（族人学历 / 功名联动）</span>
          <el-alert type="info" :closable="false" show-icon>
            <template #title>
              只读：与个人详情「学历」三字段（学历/学位、学校、毕业年份）一致展示。有结构化 education 时不再用备注覆盖。点姓名打开族人编辑页。
            </template>
          </el-alert>
          <el-radio-group v-model="currentTab" @change="onTabChange">
            <el-radio-button label="imperial">科举功名（{{ counts.imperial }}）</el-radio-button>
            <el-radio-button label="republican">民国—2000（{{ counts.republican }}）</el-radio-button>
            <el-radio-button label="modern">1997年后（{{ counts.modern }}）</el-radio-button>
          </el-radio-group>
        </div>
      </template>

      <el-table :data="pagedData" border v-loading="loading">
        <el-table-column label="姓名" width="110" fixed>
          <template #default="scope">
            <el-button link type="primary" @click="viewDetail(scope.row)">
              {{ scope.row.name }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column prop="originalId" label="族谱ID" width="100" show-overflow-tooltip />
        <el-table-column prop="birthText" label="出生日期" width="140" show-overflow-tooltip />

        <el-table-column v-if="currentTab === 'imperial'" prop="dynastyEra" label="朝代年号" width="150" show-overflow-tooltip />
        <el-table-column v-if="currentTab === 'imperial'" prop="titleText" label="功名/称号" min-width="140" show-overflow-tooltip />
        <el-table-column v-if="currentTab === 'imperial'" prop="gongming" label="功名字段" min-width="120" show-overflow-tooltip />
        <el-table-column v-if="currentTab === 'imperial'" prop="guanzhi" label="官职" min-width="140" show-overflow-tooltip />

        <el-table-column v-if="currentTab !== 'imperial'" label="学历" min-width="280">
          <template #default="scope">
            <div v-for="(edu, idx) in scope.row.educations" :key="idx" class="edu-line">
              <span class="edu-display">{{ edu.display || [edu.degree, edu.school, edu.year].filter(Boolean).join(' ') || '—' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column v-if="currentTab !== 'imperial'" prop="guanzhi" label="官职/职务" min-width="140" show-overflow-tooltip />

        <el-table-column label="关联" width="100" fixed="right">
          <template #default="scope">
            <el-tag v-if="scope.row._id" type="success" size="small">已关联</el-tag>
            <el-tag v-else type="danger" size="small">无ID</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="scope">
            <el-button type="primary" size="small" :disabled="!scope.row._id" @click="viewDetail(scope.row)">
              打开族人
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="currentList.length"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        style="margin-top: 20px; justify-content: center;"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { graduatesApi, initCloud } from '../../api/cloudApi.js'

const router = useRouter()
const loading = ref(false)
const currentTab = ref('imperial')
const page = ref(1)
const pageSize = ref(20)

const lists = ref({
  imperial: [],
  republican: [],
  modern: []
})

const counts = computed(() => ({
  imperial: lists.value.imperial.length,
  republican: lists.value.republican.length,
  modern: lists.value.modern.length
}))

const currentList = computed(() => lists.value[currentTab.value] || [])

const pagedData = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return currentList.value.slice(start, start + pageSize.value)
})

const onTabChange = () => {
  page.value = 1
}

const loadData = async () => {
  loading.value = true
  try {
    const res = await graduatesApi.getEducationHonor()
    if (res && res.success) {
      const data = res.data || {}
      lists.value = {
        imperial: data.imperial || [],
        republican: data.republican || [],
        modern: data.modern || []
      }
    } else {
      ElMessage.error(res?.message || '加载失败')
    }
  } catch (err) {
    console.error('加载失败:', err)
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

const viewDetail = (row) => {
  if (row._id) {
    router.push(`/members/edit/${row._id}`)
  } else {
    ElMessage.warning('该条未关联到云库成员 _id')
  }
}

onMounted(async () => {
  await initCloud()
  loadData()
})
</script>

<style scoped>
.graduates-list { padding: 20px; }
.card-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.edu-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}
.edu-display {
  color: #303133;
  line-height: 1.5;
}
.school-text {
  color: #606266;
}
.year-text {
  color: #909399;
  font-size: 12px;
}
</style>
