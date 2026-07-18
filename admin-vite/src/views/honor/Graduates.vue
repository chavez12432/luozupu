<template>
  <div class="graduates-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>学历榜（功名与学历）</span>
          <el-alert type="info" :closable="false" show-icon>
            <template #title>
              数据来源：族人学历字段及谱文备注。分三类：科举功名、民国—2000、1997年后考大学（专科及以上）。点击姓名可进入族人详情。
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
        <el-table-column label="姓名" width="120" fixed>
          <template #default="scope">
            <el-button link type="primary" @click="viewDetail(scope.row)">
              {{ scope.row.name }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column prop="birthText" label="出生日期" width="160" show-overflow-tooltip />

        <el-table-column v-if="currentTab === 'imperial'" prop="dynastyEra" label="朝代年号" width="180" show-overflow-tooltip />
        <el-table-column v-if="currentTab === 'imperial'" prop="titleText" label="称号" min-width="160" />

        <el-table-column v-if="currentTab !== 'imperial'" label="学校 / 学历" min-width="280">
          <template #default="scope">
            <div v-for="(edu, idx) in scope.row.educations" :key="idx" class="edu-line">
              <el-tag size="small" type="success">{{ edu.degree }}</el-tag>
              <span class="school-text">{{ edu.school || '—' }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="110" fixed="right">
          <template #default="scope">
            <el-button type="primary" size="small" @click="viewDetail(scope.row)">
              查看详情
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
}
.school-text {
  color: #606266;
}
</style>
