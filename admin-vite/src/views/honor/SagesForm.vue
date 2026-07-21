<template>
  <div class="sage-form">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ isEdit ? '编辑乡贤' : '添加乡贤' }}</span>
          <el-button @click="goBack">返回</el-button>
        </div>
      </template>

      <el-alert type="info" :closable="false" show-icon style="margin-bottom: 16px">
        <template #title>
          关联族人后，姓名/世代等从族人库联动；本榜侧重填写「主要成就」（功名官职亦可参考族人字段）。
        </template>
      </el-alert>

      <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
        <el-form-item label="关联族人" prop="memberDocId">
          <el-select
            v-model="form.memberDocId"
            filterable
            remote
            clearable
            reserve-keyword
            placeholder="输入姓名搜索族人"
            :remote-method="searchMembers"
            :loading="memberLoading"
            style="width: 100%"
            @change="onMemberChange"
          >
            <el-option
              v-for="m in memberOptions"
              :key="m._id"
              :label="memberLabel(m)"
              :value="m._id"
            />
          </el-select>
        </el-form-item>

        <el-descriptions v-if="linkedPreview.name" :column="2" border style="margin-bottom: 16px">
          <el-descriptions-item label="姓名">{{ linkedPreview.name }}</el-descriptions-item>
          <el-descriptions-item label="族谱ID">{{ linkedPreview.originalId || '—' }}</el-descriptions-item>
          <el-descriptions-item label="世代">{{ linkedPreview.generation ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="功名">{{ linkedPreview.gongming || '—' }}</el-descriptions-item>
          <el-descriptions-item label="官职" :span="2">{{ linkedPreview.guanzhi || '—' }}</el-descriptions-item>
        </el-descriptions>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="朝代" prop="dynasty">
              <el-select v-model="form.dynasty" clearable>
                <el-option label="宋" value="宋" />
                <el-option label="元" value="元" />
                <el-option label="明" value="明" />
                <el-option label="清" value="清" />
                <el-option label="近现代" value="近现代" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="年号">
              <el-input v-model="form.eraName" placeholder="可选" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="主要成就" prop="achievements">
          <el-input
            v-model="form.achievements"
            type="textarea"
            :rows="6"
            placeholder="簪缨引成就文案；空则小程序可回退展示族人功名"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="submit" :loading="loading">保存</el-button>
          <el-button @click="goBack">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { sagesApi, memberApi, initCloud } from '../../api/cloudApi.js'

const route = useRoute()
const router = useRouter()
const formRef = ref()
const loading = ref(false)
const memberLoading = ref(false)
const memberOptions = ref([])
const isEdit = computed(() => !!route.query.id)

const form = reactive({
  _id: '',
  memberDocId: '',
  originalId: '',
  dynasty: '',
  eraName: '',
  achievements: ''
})

const linkedPreview = reactive({
  name: '',
  originalId: '',
  generation: null,
  gongming: '',
  guanzhi: ''
})

const rules = {
  memberDocId: [{ required: true, message: '请选择关联族人', trigger: 'change' }]
}

function memberLabel(m) {
  const oid = m.originalId || m.memberId || ''
  const gen = m.generation != null ? `${m.generation}世` : ''
  return [m.name, oid, gen].filter(Boolean).join(' · ')
}

async function searchMembers(query) {
  const q = String(query || '').trim()
  if (!q) {
    memberOptions.value = []
    return
  }
  memberLoading.value = true
  try {
    const res = await memberApi.getList({ name: q, page: 1, pageSize: 30 })
    memberOptions.value = (res && res.data) || []
  } catch (e) {
    memberOptions.value = []
  } finally {
    memberLoading.value = false
  }
}

function applyMember(m) {
  if (!m) {
    Object.assign(linkedPreview, { name: '', originalId: '', generation: null, gongming: '', guanzhi: '' })
    form.originalId = ''
    return
  }
  form.memberDocId = m._id
  form.originalId = m.originalId || m.memberId || ''
  linkedPreview.name = m.name || ''
  linkedPreview.originalId = form.originalId
  linkedPreview.generation = m.generation ?? null
  linkedPreview.gongming = m.gongming || ''
  linkedPreview.guanzhi = m.guanzhi || ''
  if (!form.achievements && m.gongming) form.achievements = m.gongming
  if (!memberOptions.value.find(x => x._id === m._id)) {
    memberOptions.value = [m, ...memberOptions.value]
  }
}

function onMemberChange(id) {
  applyMember(memberOptions.value.find(x => x._id === id) || null)
}

onMounted(async () => {
  await initCloud()
  if (isEdit.value) {
    try {
      const res = await sagesApi.getById(route.query.id)
      if (res && res.success && res.data) {
        const d = res.data
        form._id = d._id || route.query.id
        form.memberDocId = d.memberDocId || ''
        form.originalId = d.originalId || ''
        form.dynasty = d.dynasty || ''
        form.eraName = d.eraName || ''
        form.achievements = d.achievements || ''
        if (d.memberDocId || d.name) {
          applyMember({
            _id: d.memberDocId,
            name: d.name,
            originalId: d.originalId,
            generation: d.generation,
            gongming: d.gongming,
            guanzhi: d.guanzhi
          })
          form.achievements = d.achievements || form.achievements
        }
      } else {
        ElMessage.error(res?.message || '加载失败')
      }
    } catch (e) {
      ElMessage.error(e.message || '加载失败')
    }
  }
})

const submit = async () => {
  try {
    await formRef.value.validate()
  } catch {
    ElMessage.warning('请完善必填项')
    return
  }
  loading.value = true
  try {
    const payload = {
      memberDocId: form.memberDocId,
      originalId: form.originalId,
      dynasty: form.dynasty || '',
      eraName: form.eraName || '',
      achievements: form.achievements || ''
    }
    let res
    if (isEdit.value) {
      res = await sagesApi.update(form._id || route.query.id, payload)
    } else {
      res = await sagesApi.create(payload)
    }
    if (res && res.success) {
      ElMessage.success(res.message || '保存成功')
      goBack()
    } else {
      ElMessage.error(res?.message || '保存失败')
    }
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    loading.value = false
  }
}

const goBack = () => router.push('/honor/sages')
</script>

<style scoped>
.sage-form { padding: 20px; max-width: 800px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
</style>
