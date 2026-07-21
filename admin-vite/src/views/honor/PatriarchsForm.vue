<template>
  <div class="patriarch-form">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ isEdit ? '编辑族长' : '添加族长' }}</span>
          <el-button @click="goBack">返回</el-button>
        </div>
      </template>

      <el-alert type="info" :closable="false" show-icon style="margin-bottom: 16px">
        <template #title>
          请先关联族人：姓名、世代、分堂等从族人库联动；本页只维护称号、分堂称号、排序与补充成就。
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
            <el-form-item label="称号" prop="title">
              <el-input v-model="form.title" placeholder="如：一世基祖" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="排序" prop="sortOrder">
              <el-input-number v-model="form.sortOrder" :min="1" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="分堂称号">
          <el-input v-model="form.branchTitle" placeholder="如：高洲基祖" />
        </el-form-item>

        <el-form-item label="补充成就">
          <el-input v-model="form.achievements" type="textarea" :rows="3" placeholder="可选；侧重族长身份说明" />
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
import { patriarchsApi, memberApi, initCloud } from '../../api/cloudApi.js'

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
  title: '',
  branchTitle: '',
  sortOrder: 1,
  achievements: ''
})

const linkedPreview = reactive({
  name: '',
  originalId: '',
  generation: null,
  branch: ''
})

const rules = {
  memberDocId: [{ required: true, message: '请选择关联族人', trigger: 'change' }],
  title: [{ required: true, message: '请输入称号', trigger: 'blur' }]
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
    linkedPreview.name = ''
    linkedPreview.originalId = ''
    linkedPreview.generation = null
    linkedPreview.branch = ''
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
  const m = memberOptions.value.find(x => x._id === id)
  applyMember(m || null)
}

onMounted(async () => {
  await initCloud()
  if (isEdit.value) {
    try {
      const res = await patriarchsApi.getById(route.query.id)
      if (res && res.success && res.data) {
        const d = res.data
        form._id = d._id || route.query.id
        form.memberDocId = d.memberDocId || ''
        form.originalId = d.originalId || ''
        form.title = d.title || ''
        form.branchTitle = d.branchTitle || ''
        form.sortOrder = d.sortOrder ?? 1
        form.achievements = d.achievements || ''
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
      title: form.title,
      branchTitle: form.branchTitle || '',
      sortOrder: form.sortOrder || 1,
      achievements: form.achievements || ''
    }
    let res
    if (isEdit.value) {
      res = await patriarchsApi.update(form._id || route.query.id, payload)
    } else {
      res = await patriarchsApi.create(payload)
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

const goBack = () => router.push('/honor/patriarchs')
</script>

<style scoped>
.patriarch-form { padding: 20px; max-width: 800px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
</style>
