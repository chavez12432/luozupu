<template>
  <div class="elite-form">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ isEdit ? '编辑群英' : '添加群英' }}</span>
          <el-button @click="goBack">返回</el-button>
        </div>
      </template>

      <el-alert type="info" :closable="false" show-icon style="margin-bottom: 16px">
        <template #title>
          关联族人后，姓名/堂份/世代等从族人库联动；本页维护简介与小传正文。
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
          <el-descriptions-item label="分堂">{{ linkedPreview.branch || '—' }}</el-descriptions-item>
        </el-descriptions>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="成就类型" prop="achievementType">
              <el-select v-model="form.achievementType">
                <el-option label="政务" value="政务" />
                <el-option label="军事" value="军事" />
                <el-option label="教育" value="教育" />
                <el-option label="企业" value="企业" />
                <el-option label="科研" value="科研" />
                <el-option label="其他" value="其他" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="排序">
              <el-input-number v-model="form.sortOrder" :min="1" :max="100" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="简介">
          <el-input v-model="form.summary" type="textarea" :rows="2" />
        </el-form-item>

        <el-form-item label="小传正文" prop="biography">
          <el-input
            v-model="form.biography"
            type="textarea"
            :rows="12"
            placeholder="段落之间空一行"
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
import { eliteApi, memberApi, initCloud } from '../../api/cloudApi.js'

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
  heroId: '',
  achievementType: '其他',
  summary: '',
  biography: '',
  sortOrder: 1,
  isAlive: true
})

const linkedPreview = reactive({
  name: '',
  originalId: '',
  generation: null,
  branch: ''
})

const rules = {
  memberDocId: [{ required: true, message: '请选择关联族人', trigger: 'change' }],
  achievementType: [{ required: true, message: '请选择类型', trigger: 'change' }],
  biography: [{ required: true, message: '请填写小传', trigger: 'blur' }]
}

function memberLabel(m) {
  const oid = m.originalId || m.memberId || ''
  const gen = m.generation != null ? `${m.generation}世` : ''
  return [m.name, oid, gen, m.branch].filter(Boolean).join(' · ')
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
    Object.assign(linkedPreview, { name: '', originalId: '', generation: null, branch: '' })
    form.originalId = ''
    return
  }
  form.memberDocId = m._id
  form.originalId = m.originalId || m.memberId || ''
  linkedPreview.name = m.name || ''
  linkedPreview.originalId = form.originalId
  linkedPreview.generation = m.generation ?? null
  linkedPreview.branch = m.branch || ''
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
      const res = await eliteApi.getById(route.query.id)
      if (res && res.success && res.data) {
        const d = res.data
        form._id = d._id || route.query.id
        form.memberDocId = d.memberDocId || ''
        form.originalId = d.originalId || ''
        form.heroId = d.heroId || ''
        form.achievementType = d.achievementType || '其他'
        form.summary = d.summary || ''
        form.biography = d.biography || ''
        form.sortOrder = d.sortOrder ?? 1
        form.isAlive = d.isAlive !== false
        if (d.memberDocId || d.name) {
          applyMember({
            _id: d.memberDocId,
            name: d.name,
            originalId: d.originalId,
            generation: d.generation,
            branch: d.branch
          })
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
      heroId: form.heroId || '',
      achievementType: form.achievementType,
      summary: form.summary || '',
      biography: form.biography || '',
      sortOrder: form.sortOrder || 1,
      isAlive: form.isAlive !== false
    }
    let res
    if (isEdit.value) {
      res = await eliteApi.update(form._id || route.query.id, payload)
    } else {
      res = await eliteApi.create(payload)
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

const goBack = () => router.push('/honor/elite')
</script>

<style scoped>
.elite-form { padding: 20px; max-width: 800px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
</style>
