<template>
  <div class="fengtu-form">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ isEdit ? '编辑文章' : '添加文章' }}</span>
          <el-button @click="goBack">返回</el-button>
        </div>
      </template>

      <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="标题" prop="title">
              <el-input v-model="form.title" placeholder="文章标题" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="版式" prop="layout">
              <el-select v-model="form.layout" style="width: 100%">
                <el-option label="普通文章" value="plain" />
                <el-option label="古文三栏" value="classic" />
                <el-option label="诗配图" value="poem" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="作者">
              <el-input v-model="form.authorName" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="世系">
              <el-input v-model="form.authorGeneration" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="排序">
              <el-input-number v-model="form.sortOrder" :min="0" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="朝代">
              <el-input v-model="form.dynasty" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="公元">
              <el-input v-model="form.year" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="上架">
              <el-switch v-model="form.published" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="摘要">
          <el-input v-model="form.summary" type="textarea" :rows="2" />
        </el-form-item>

        <template v-if="form.layout === 'classic'">
          <el-form-item label="古文原文">
            <el-input v-model="form.original" type="textarea" :rows="10" />
          </el-form-item>
          <el-form-item label="现代译文">
            <el-input v-model="form.translation" type="textarea" :rows="10" />
          </el-form-item>
          <el-form-item label="考评注释">
            <el-input v-model="form.notes" type="textarea" :rows="8" />
          </el-form-item>
        </template>

        <template v-else-if="form.layout === 'poem'">
          <el-form-item label="导语">
            <el-input v-model="form.content" type="textarea" :rows="2" placeholder="可选说明" />
          </el-form-item>
          <el-form-item label="八景图配诗">
            <div class="scenes-editor">
              <div v-for="(scene, idx) in form.scenes" :key="idx" class="scene-card">
                <div class="scene-card-head">第 {{ idx + 1 }} 景</div>
                <el-input v-model="scene.title" placeholder="景名，如：一、凤山耸翠" style="margin-bottom: 8px" />
                <el-input v-model="scene.image" placeholder="图片路径，如 /images/bajing/01.jpg" style="margin-bottom: 8px" />
                <el-input v-model="scene.poem" type="textarea" :rows="4" placeholder="诗句" />
                <el-button type="danger" link @click="form.scenes.splice(idx, 1)">删除本景</el-button>
              </div>
              <el-button @click="form.scenes.push({ title: '', image: '', poem: '' })">添加一景</el-button>
            </div>
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item label="正文">
            <el-input v-model="form.content" type="textarea" :rows="14" />
          </el-form-item>
        </template>

        <el-form-item>
          <el-button type="primary" :loading="saving" @click="handleSubmit">保存</el-button>
          <el-button @click="goBack">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { fengtuApi, initCloud } from '../../api/cloudApi.js'

const router = useRouter()
const route = useRoute()
const formRef = ref(null)
const saving = ref(false)
const isEdit = computed(() => !!route.query.id)

const form = reactive({
  layout: 'plain',
  title: '',
  authorName: '',
  authorGeneration: '',
  dynasty: '',
  year: '',
  summary: '',
  original: '',
  translation: '',
  notes: '',
  content: '',
  images: [],
  scenes: [],
  sortOrder: 0,
  published: true
})

const rules = {
  title: [{ required: true, message: '请填写标题', trigger: 'blur' }],
  layout: [{ required: true, message: '请选择版式', trigger: 'change' }]
}

onMounted(async () => {
  await initCloud()
  if (route.query.id) {
    const res = await fengtuApi.getById(route.query.id)
    if (res && res.success && res.data) {
      Object.assign(form, {
        layout: res.data.layout || 'plain',
        title: res.data.title || '',
        authorName: res.data.authorName || '',
        authorGeneration: res.data.authorGeneration || '',
        dynasty: res.data.dynasty || '',
        year: res.data.year || '',
        summary: res.data.summary || '',
        original: res.data.original || '',
        translation: res.data.translation || '',
        notes: res.data.notes || '',
        content: res.data.content || '',
        images: Array.isArray(res.data.images) ? res.data.images.slice() : [],
        scenes: Array.isArray(res.data.scenes)
          ? res.data.scenes.map(s => ({
              title: s.title || '',
              image: s.image || '',
              poem: s.poem || ''
            }))
          : [],
        sortOrder: res.data.sortOrder || 0,
        published: res.data.published !== false
      })
    }
  }
})

const goBack = () => router.push('/fengtu')

const handleSubmit = async () => {
  await formRef.value.validate()
  saving.value = true
  try {
    const payload = {
      ...form,
      scenes: (form.scenes || []).filter(s => s.title || s.poem || s.image),
      images: (form.scenes || []).map(s => s.image).filter(Boolean)
    }
    let res
    if (isEdit.value) {
      res = await fengtuApi.update(route.query.id, payload)
    } else {
      res = await fengtuApi.create(payload)
    }
    if (res && res.success) {
      ElMessage.success('已保存')
      goBack()
    } else {
      ElMessage.error((res && res.message) || '保存失败')
    }
  } catch (e) {
    if (e !== false) ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.fengtu-form { padding: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.images-editor { width: 100%; }
.image-row { display: flex; gap: 8px; margin-bottom: 8px; }
.scenes-editor { width: 100%; }
.scene-card {
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  background: #fafafa;
}
.scene-card-head { font-weight: 600; margin-bottom: 8px; }
</style>
