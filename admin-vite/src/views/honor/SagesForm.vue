<template>
  <div class="sage-form">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ isEdit ? '编辑乡贤' : '添加乡贤' }}</span>
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
            <el-form-item label="朝代" prop="dynasty">
              <el-select v-model="form.dynasty">
                <el-option label="宋" value="宋" />
                <el-option label="元" value="元" />
                <el-option label="明" value="明" />
                <el-option label="清" value="清" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="年号">
              <el-input v-model="form.eraName" placeholder="如：绍兴" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="出生年">
              <el-input-number v-model="form.birthYear" :min="1" :max="2000" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="去世年">
              <el-input-number v-model="form.deathYear" :min="1" :max="2000" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="主要成就" prop="achievements">
          <el-input v-model="form.achievements" type="textarea" :rows="3" />
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
import { sagesApi, initCloud } from '../../api/cloudApi.js'

const route = useRouter()
const router = useRouter()
const formRef = ref()
const loading = ref(false)
const isEdit = computed(() => !!route.query.id)

const form = reactive({
  _id: '',
  name: '',
  generation: null,
  dynasty: '',
  eraName: '',
  birthYear: null,
  deathYear: null,
  achievements: ''
})

const rules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  dynasty: [{ required: true, message: '请选择朝代', trigger: 'change' }]
}

onMounted(async () => {
  await initCloud()
  if (isEdit.value) {
    const res = await sagesApi.getById(route.query.id)
    if (res && res.success && res.data) Object.assign(form, res.data)
  }
})

const submit = async () => {
  try {
    await formRef.value.validate()
    loading.value = true
    let res
    if (isEdit.value) res = await sagesApi.update(form._id, form)
    else res = await sagesApi.create(form)
    if (res && res.success) {
      ElMessage.success('保存成功')
      goBack()
    }
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
