<template>
  <div class="patriarch-form">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ isEdit ? '编辑族长' : '添加族长' }}</span>
          <el-button @click="goBack">返回</el-button>
        </div>
      </template>
      
      <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="姓名" prop="name">
              <el-input v-model="form.name" placeholder="如：公瑾" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="称号" prop="title">
              <el-input v-model="form.title" placeholder="如：一世基祖" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="世代" prop="generation">
              <el-input-number v-model="form.generation" :min="1" :max="50" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="排序" prop="sortOrder">
              <el-input-number v-model="form.sortOrder" :min="1" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="分堂" prop="branch">
              <el-select v-model="form.branch" placeholder="请选择分堂">
                <el-option label="中和堂" value="中和堂" />
                <el-option label="明儒堂" value="明儒堂" />
                <el-option label="德裕堂" value="德裕堂" />
                <el-option label="忠爱堂" value="忠爱堂" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="分堂称号" prop="branchTitle">
              <el-input v-model="form.branchTitle" placeholder="如：高洲基祖" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="来源地" prop="originRegion">
              <el-input v-model="form.originRegion" placeholder="如：高洲" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="族人ID" prop="memberId">
              <el-input v-model="form.memberId" placeholder="关联的 originalId" />
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
import { patriarchsApi, initCloud } from '../../api/cloudApi.js'

const route = useRoute()
const router = useRouter()
const formRef = ref()
const loading = ref(false)
const isEdit = computed(() => !!route.query.id)

const form = reactive({
  _id: '',
  name: '',
  title: '',
  generation: null,
  sortOrder: 1,
  branch: '',
  branchTitle: '',
  originRegion: '',
  memberId: '',
  achievements: ''
})

const rules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  generation: [{ required: true, message: '请输入世代', trigger: 'blur' }],
  branch: [{ required: true, message: '请选择分堂', trigger: 'change' }]
}

onMounted(async () => {
  await initCloud()
  if (isEdit.value) {
    const res = await patriarchsApi.getById(route.query.id)
    if (res && res.success && res.data) {
      Object.assign(form, res.data)
    }
  }
})

const submit = async () => {
  try {
    await formRef.value.validate()
    loading.value = true
    let res
    if (isEdit.value) {
      res = await patriarchsApi.update(form._id, form)
    } else {
      res = await patriarchsApi.create(form)
    }
    if (res && res.success) {
      ElMessage.success('保存成功')
      goBack()
    }
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
