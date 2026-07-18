<template>
  <div class="wife-form">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ isEdit ? '编辑媳妇' : '添加媳妇' }}</span>
          <el-button @click="goBack">返回</el-button>
        </div>
      </template>
      
      <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="姓名" prop="name">
              <el-input v-model="form.name" placeholder="请输入姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="娘家姓氏" prop="maidenName">
              <el-input v-model="form.maidenName" placeholder="如：王" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="籍贯" prop="hometown">
              <el-input v-model="form.hometown" placeholder="如：坛源村" />
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
            <el-form-item label="丈夫ID" prop="husbandId">
              <el-input v-model="form.husbandId" placeholder="丈夫的originalId" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="丈夫姓名">
              <el-input v-model="form.husbandName" disabled />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="婚配类型" prop="marriageType">
              <el-select v-model="form.marriageType">
                <el-option label="配" value="配" />
                <el-option label="元配" value="元配" />
                <el-option label="继配" value="继配" />
                <el-option label="续配" value="续配" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="婚姻状态" prop="marriageStatus">
              <el-select v-model="form.marriageStatus">
                <el-option label="在婚" value="married" />
                <el-option label="丧偶" value="widowed" />
                <el-option label="离异" value="divorced" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="婚配序号">
              <el-input-number v-model="form.marriageOrder" :min="1" :max="10" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="葬地">
              <el-input v-model="form.burialPlace" placeholder="葬于..." />
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" />
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="submit" :loading="loading">
            {{ isEdit ? '保存' : '添加' }}
          </el-button>
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
import { wivesApi, initCloud } from '../../api/cloudApi.js'

const route = useRoute()
const router = useRouter()
const formRef = ref()
const loading = ref(false)

const isEdit = computed(() => !!route.query.id)

const form = reactive({
  _id: '',
  name: '',
  maidenName: '',
  hometown: '',
  generation: null,
  husbandId: '',
  husbandName: '',
  marriageType: '配',
  marriageOrder: 1,
  marriageStatus: 'married',
  burialPlace: '',
  remark: ''
})

const rules = {
  husbandId: [{ required: true, message: '请输入丈夫ID', trigger: 'blur' }],
  marriageType: [{ required: true, message: '请选择婚配类型', trigger: 'change' }]
}

onMounted(async () => {
  await initCloud()
  if (isEdit.value) {
    await loadData()
  }
})

const loadData = async () => {
  try {
    const res = await wivesApi.getById(route.query.id)
    if (res && res.success && res.data) {
      Object.assign(form, res.data)
    }
  } catch (err) {
    ElMessage.error('加载失败')
  }
}

const submit = async () => {
  try {
    await formRef.value.validate()
    loading.value = true
    
    let res
    if (isEdit.value) {
      res = await wivesApi.update(form._id, form)
    } else {
      res = await wivesApi.create(form)
    }
    
    if (res && res.success) {
      ElMessage.success(isEdit.value ? '保存成功' : '添加成功')
      goBack()
    } else {
      ElMessage.error(res?.message || '操作失败')
    }
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.push('/wives')
}
</script>

<style scoped>
.wife-form {
  padding: 20px;
  max-width: 800px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
