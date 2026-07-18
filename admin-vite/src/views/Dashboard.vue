<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card>
          <div class="stat-item">
            <div class="stat-icon" style="background: #409EFF;">
              <el-icon size="32"><User /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ totalCount }}</div>
              <div class="stat-label">总族人</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div class="stat-item">
            <div class="stat-icon" style="background: #67C23A;">
              <el-icon size="32"><Male /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ maleCount }}</div>
              <div class="stat-label">男性</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div class="stat-item">
            <div class="stat-icon" style="background: #E6A23C;">
              <el-icon size="32"><Female /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ femaleCount }}</div>
              <div class="stat-label">女性</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card>
          <div class="stat-item">
            <div class="stat-icon" style="background: #F56C6C;">
              <el-icon size="32"><Histogram /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ maxGeneration }}</div>
              <div class="stat-label">世代</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>分堂统计</span>
          </template>
          <div class="branch-stats">
            <div v-for="(branch, index) in branchList" :key="branch.name" class="branch-item">
              <span class="branch-name">{{ branch.name }}</span>
              <el-progress :percentage="branch.percentage" :color="['#409EFF', '#67C23A', '#E6A23C', '#F56C6C'][index % 4]" />
              <span class="branch-count">{{ branch.count }}人</span>
            </div>
            <div v-if="branchList.length === 0" class="empty-data">
              暂无数据
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>最近更新</span>
          </template>
          <el-timeline>
            <el-timeline-item
              v-for="(activity, index) in activities"
              :key="index"
              :timestamp="activity.time"
            >
              {{ activity.content }}
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getMembers } from '../api/localStorage.js'

const members = ref([])

// 统计数据
const totalCount = computed(() => members.value.length)
const maleCount = computed(() => members.value.filter(m => m.gender === '男').length)
const femaleCount = computed(() => members.value.filter(m => m.gender === '女').length)
const maxGeneration = computed(() => {
  const gens = members.value.map(m => m.generation).filter(g => g)
  return gens.length > 0 ? Math.max(...gens) : 0
})

// 分堂统计
const branchStats = computed(() => {
  const stats = {}
  members.value.forEach(m => {
    const branch = m.branch || '未知'
    stats[branch] = (stats[branch] || 0) + 1
  })
  return stats
})

const branchList = computed(() => {
  const total = members.value.length
  return Object.entries(branchStats.value).map(([name, count]) => ({
    name,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0
  }))
})

// 加载数据
onMounted(() => {
  members.value = getMembers()
})
</script>

<style scoped>
.stat-item {
  display: flex;
  align-items: center;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  margin-right: 15px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 5px;
}

.branch-stats {
  padding: 10px 0;
}

.branch-item {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.branch-item:last-child {
  margin-bottom: 0;
}

.branch-name {
  width: 80px;
  color: #606266;
}

.branch-count {
  width: 60px;
  text-align: right;
  color: #909399;
  font-size: 14px;
}

.el-progress {
  flex: 1;
  margin: 0 15px;
}
</style>
