<template>
  <div class="graduate-form">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ isEdit ? '编辑' : '添加' }}学历</span>
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
            <el-form-item label="学历" prop="degree">
              <el-select v-model="form.degree">
                <el-option label="博士" value="博士" />
                <el-option label="硕士" value="硕士" />
                <el-option label="本科" value="本科" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="毕业年份" prop="graduationYear">
              <el-input-number v-model="form.graduationYear" :min="1950" :max="2030" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="学校" prop="school">
          <el-input v-model="form.school" />
        </el-form-item>
        
        <el-form-item label="专业">
          <el-input v-model="form.major" />
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
import { graduatesApi, initCloud } from '../../api/cloudApi.js'

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
  degree: '本科',
  school: '',
  major: '',
  graduationYear: null
})

const rules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  degree: [{ required: true, message: '请选择学历', trigger: 'change' }],
  graduationYear: [{ required: true, message: '请输入毕业年份', trigger: 'blur' }]
}

onMounted(async () => {
  await initCloud()
  if (isEdit.value) {
    const res = await graduatesApi.getById(route.query.id)
    if (res && res.success && res.data) Object.assign(form, res.data)
  }
})

const submit = async () => {
  try {
    await formRef.value.validate()
    loading.value = true
    let res
    if (isEdit.value) res = await graduatesApi.update(form._id, form)
    else res = await graduatesApi.create(form)
    if (res && res.success) { ElMessage.success('保存成功'); goBack() }
  } finally {
    loading.value = false
  }
}

const goBack = () => router.push('/honor/graduates')
</script>

<style scoped>
.graduate-form { padding: 20px; max-width: 800px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
</style>
