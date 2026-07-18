<template>
  <div class="elite-form">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ isEdit ? '编辑' : '添加' }}群英</span>
          <el-button @click="goBack">返回</el-button>
        </div>
      </template>
      
      <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="姓名" prop="name">
              <el-input v-model="form.name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="世代" prop="generation">
              <el-input-number v-model="form.generation" :min="1" :max="50" />
            </el-form-item>
          </el-col>
        </el-row>
        
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
            <el-form-item label="在世">
              <el-switch v-model="form.isAlive" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="职位">
              <el-input v-model="form.position" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="级别">
              <el-input v-model="form.level" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="单位">
          <el-input v-model="form.organization" />
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
import { eliteApi, initCloud } from '../../api/cloudApi.js'

const route = useRouter()
const router = useRouter()
const formRef = ref()
const loading = ref(false)
const isEdit = computed(() => !!route.query.id)

const form = reactive({
  _id: '',
  name: '',
  generation: null,
  memberId: '',
  achievementType: '其他',
  position: '',
  organization: '',
  level: '',
  birthYear: null,
  isAlive: true
})

const rules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  achievementType: [{ required: true, message: '请选择类型', trigger: 'change' }]
}

onMounted(async () => {
  await initCloud()
  if (isEdit.value) {
    const res = await eliteApi.getById(route.query.id)
    if (res && res.success && res.data) Object.assign(form, res.data)
  }
})

const submit = async () => {
  try {
    await formRef.value.validate()
    loading.value = true
    let res
    if (isEdit.value) res = await eliteApi.update(form._id, form)
    else res = await eliteApi.create(form)
    if (res && res.success) { ElMessage.success('保存成功'); goBack() }
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
