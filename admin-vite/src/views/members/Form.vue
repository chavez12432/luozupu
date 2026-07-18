<template>
  <div class="member-form">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ isEdit ? '编辑族人' : '添加族人' }}</span>
        </div>
      </template>
      
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="120px"
      >
        <!-- 基本信息 -->
        <el-divider content-position="left">基本信息</el-divider>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="MemberID">
              <el-input v-model="form.memberId" disabled placeholder="系统自动生成" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="原表ID">
              <el-input v-model="form.originalId" disabled placeholder="无" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="姓名" prop="name">
              <el-input v-model="form.name" placeholder="请输入姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="世代" prop="generation">
              <el-input-number v-model="form.generation" :min="1" :max="50" style="width: 100%;" @change="onGenerationChange" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="分堂">
              <el-select v-model="form.branch" placeholder="选择分堂" style="width: 100%;">
                <el-option label="中和堂" value="中和堂" />
                <el-option label="明儒堂" value="明儒堂" />
                <el-option label="德裕堂" value="德裕堂" />
                <el-option label="忠爱堂" value="忠爱堂" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="性别">
              <el-radio-group v-model="form.gender">
                <el-radio label="男">男</el-radio>
                <el-radio label="女">女</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="是否断层">
              <el-switch v-model="form.hasBrokenLineage" active-text="是" inactive-text="否" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="寿命">
              <el-input-number v-model="form.lifespan" :min="0" :max="150" placeholder="自动计算" disabled style="width: 100%;" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 断层说明 -->
        <el-row v-if="form.hasBrokenLineage" :gutter="20">
          <el-col :span="24">
            <el-form-item label="断层说明">
              <el-input v-model="form.brokenLineageNote" type="textarea" :rows="2" placeholder="请输入断层原因说明" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 出生日期（农历） -->
        <el-divider content-position="left">出生日期（农历）</el-divider>
        <el-row :gutter="20">
          <el-col :span="6">
            <el-form-item label="农历年">
              <el-input-number v-model="form.birthDate.lunar.year" :min="1" :max="2100" placeholder="如：1985" style="width: 100%;" />
            </el-form-item>
          </el-col>
          <el-col :span="5">
            <el-form-item label="农历月">
              <el-select v-model="form.birthDate.lunar.month" placeholder="选择月份" style="width: 100%;">
                <el-option v-for="m in 12" :key="m" :label="lunarMonths[m-1] + '月'" :value="m" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="5">
            <el-form-item label="农历日">
              <el-select v-model="form.birthDate.lunar.day" placeholder="选择日期" style="width: 100%;">
                <el-option v-for="d in 30" :key="d" :label="lunarDays[d-1]" :value="d" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label="闰月">
              <el-switch v-model="form.birthDate.lunar.isLeap" active-text="是" inactive-text="否" />
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item>
              <el-button type="primary" @click="convertBirthDate">转换日期</el-button>
            </el-form-item>
          </el-col>
        </el-row>
        
        <!-- 出生日期转换结果 -->
        <el-row v-if="form.birthDate.converted">
          <el-col :span="24">
            <el-form-item label="转换结果">
              <div class="conversion-result">
                <el-tag type="success">公历：{{ form.birthDate.gregorian.formatted }}</el-tag>
                <el-tag type="warning">干支：{{ form.birthDate.ganzhi }}</el-tag>
                <el-tag type="info">生肖：{{ form.birthDate.zodiac }}年</el-tag>
                <el-tag v-if="form.birthDate.dynasty" type="danger">朝代：{{ form.birthDate.dynasty }} {{ form.birthDate.eraName }}{{ form.birthDate.eraYear }}年</el-tag>
              </div>
            </el-form-item>
          </el-col>
        </el-row>
        
        <!-- 逝世日期（农历） -->
        <el-divider content-position="left">逝世日期（农历）</el-divider>
          <el-row :gutter="20">
            <el-col :span="6">
              <el-form-item label="农历年">
                <el-input-number v-model="form.deathDate.lunar.year" :min="1" :max="2100" placeholder="如：2020" style="width: 100%;" />
              </el-form-item>
            </el-col>
            <el-col :span="5">
              <el-form-item label="农历月">
                <el-select v-model="form.deathDate.lunar.month" placeholder="选择月份" style="width: 100%;">
                  <el-option v-for="m in 12" :key="m" :label="lunarMonths[m-1] + '月'" :value="m" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="5">
              <el-form-item label="农历日">
                <el-select v-model="form.deathDate.lunar.day" placeholder="选择日期" style="width: 100%;">
                  <el-option v-for="d in 30" :key="d" :label="lunarDays[d-1]" :value="d" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="4">
              <el-form-item label="闰月">
                <el-switch v-model="form.deathDate.lunar.isLeap" active-text="是" inactive-text="否" />
              </el-form-item>
            </el-col>
            <el-col :span="4">
              <el-form-item>
                <el-button type="primary" @click="convertDeathDate">转换日期</el-button>
              </el-form-item>
            </el-col>
          </el-row>

          <!-- 逝世日期转换结果 -->
          <el-row v-if="form.deathDate.converted">
            <el-col :span="24">
              <el-form-item label="转换结果">
                <div class="conversion-result">
                  <el-tag type="success">公历：{{ form.deathDate.gregorian.formatted }}</el-tag>
                  <el-tag type="warning">干支：{{ form.deathDate.ganzhi }}</el-tag>
                  <el-tag type="info">生肖：{{ form.deathDate.zodiac }}年</el-tag>
                  <el-tag v-if="form.deathDate.dynasty" type="danger">朝代：{{ form.deathDate.dynasty }} {{ form.deathDate.eraName }}{{ form.deathDate.eraYear }}年</el-tag>
                </div>
              </el-form-item>
            </el-col>
          </el-row>
        
        <!-- 亲属关系 -->
        <el-divider content-position="left">亲属关系</el-divider>
        <el-alert
          title="亲属关系规则"
          type="info"
          :closable="false"
          style="margin-bottom: 15px;"
        >
          <template #default>
            父亲/母亲的世代必须是 <strong>{{ form.generation - 1 }}代</strong>（当前{{ form.generation }}代 - 1）
          </template>
        </el-alert>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="父亲ID">
              <el-input v-model="form.fatherId" placeholder="输入父亲MemberID，如：M000001" @blur="validateFather" />
              <div class="id-input-hint">父亲必须是 {{ form.generation - 1 }} 代</div>
              <div v-if="fatherError" class="generation-error">{{ fatherError }}</div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="父亲姓名">
              <el-input v-model="form.fatherName" placeholder="父亲姓名" disabled />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="母亲ID">
              <el-input v-model="form.motherId" placeholder="输入母亲ID，如 W000002_1（媳妇）或 M000002（本村）" @blur="validateMother" />
              <div class="id-input-hint">优先填父亲对应的媳妇 ID（W 开头）；本村母亲可填族人 MemberID</div>
              <div v-if="motherError" class="generation-error">{{ motherError }}</div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="母亲姓名">
              <el-input v-model="form.motherName" placeholder="母亲姓名" disabled />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="配偶ID">
              <el-input v-model="form.spouseId" placeholder="输入配偶ID，如 W000001（媳妇）或 S000001（女婿）" />
              <div class="id-input-hint">男族人的配偶填 W 开头（媳妇ID），女族人的配偶填 S 开头（女婿ID）</div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="配偶姓名">
              <el-input v-model="form.spouseName" placeholder="配偶姓名" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <!-- 个人信息 -->
        <el-divider content-position="left">个人信息</el-divider>
        
        <!-- 隐私设置（32代以后生效） -->
        <el-row :gutter="20">
          <el-col :span="24">
            <el-form-item label="隐私设置">
              <el-alert
                v-if="form.generation && form.generation <= 32"
                title="32代及之前成员信息默认公开，无需设置"
                type="success"
                :closable="false"
                show-icon
                style="margin-bottom: 10px;"
              />
              <div v-else>
                <el-switch
                  v-model="form.isPublic"
                  active-text="公开所有信息"
                  inactive-text="仅公开基本信息"
                  style="margin-right: 20px;"
                />
                <el-tag :type="form.isPublic ? 'success' : 'warning'" size="small">
                  {{ form.isPublic ? '已公开' : '私密模式' }}
                </el-tag>
                <div class="privacy-hint">
                  公开后，姓名、世代、分堂、性别等信息将对所有访客可见
                </div>
              </div>
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="出生地">
              <el-input v-model="form.birthplace" placeholder="出生地" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="现居地">
              <el-input v-model="form.residence" placeholder="现居地" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="联系电话">
              <el-input v-model="form.phone" placeholder="联系电话" />
            </el-form-item>
          </el-col>
        </el-row>
        
        <!-- 学历信息 -->
        <el-divider content-position="left">学历信息</el-divider>
        <div class="section-content">
          <el-row :gutter="20">
            <el-col :span="6">
              <el-form-item label="学历">
                <el-select v-model="educationForm.degree" placeholder="选择学历" style="width: 100%;">
                  <el-option v-for="item in degreeOptions" :key="item" :label="item" :value="item" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="学校">
                <el-input v-model="educationForm.school" placeholder="学校名称" />
              </el-form-item>
            </el-col>
            <el-col :span="5">
              <el-form-item label="专业">
                <el-input v-model="educationForm.major" placeholder="专业" />
              </el-form-item>
            </el-col>
            <el-col :span="4">
              <el-form-item label="毕业年份">
                <el-input-number v-model="educationForm.year" :min="1" :max="2100" style="width: 100%;" />
              </el-form-item>
            </el-col>
            <el-col :span="3">
              <el-form-item>
                <el-button type="primary" @click="addEducation">添加</el-button>
              </el-form-item>
            </el-col>
          </el-row>
          
          <!-- 学历列表 -->
          <el-table v-if="form.education.length > 0" :data="form.education" border size="small" style="margin-top: 10px;">
            <el-table-column prop="degree" label="学历" width="120" />
            <el-table-column prop="school" label="学校" />
            <el-table-column prop="major" label="专业" width="150" />
            <el-table-column prop="year" label="毕业年份" width="100" />
            <el-table-column label="操作" width="80" fixed="right">
              <template #default="scope">
                <el-button type="danger" size="small" @click="removeEducation(scope.$index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        
        <!-- 职位信息 -->
        <el-divider content-position="left">职位信息</el-divider>
        <div class="section-content">
          <el-row :gutter="20">
            <el-col :span="6">
              <el-form-item label="职位">
                <el-input v-model="positionForm.title" placeholder="职位名称" />
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="单位">
                <el-input v-model="positionForm.organization" placeholder="单位/机构" />
              </el-form-item>
            </el-col>
            <el-col :span="5">
              <el-form-item label="级别">
                <el-select v-model="positionForm.level" placeholder="选择级别" style="width: 100%;">
                  <el-option v-for="item in levelOptions" :key="item" :label="item" :value="item" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="4">
              <el-form-item label="现任">
                <el-switch v-model="positionForm.isCurrent" active-text="是" inactive-text="否" />
              </el-form-item>
            </el-col>
            <el-col :span="3">
              <el-form-item>
                <el-button type="primary" @click="addPosition">添加</el-button>
              </el-form-item>
            </el-col>
          </el-row>
          
          <!-- 职位列表 -->
          <el-table v-if="form.positions.length > 0" :data="form.positions" border size="small" style="margin-top: 10px;">
            <el-table-column prop="title" label="职位" />
            <el-table-column prop="organization" label="单位" />
            <el-table-column prop="level" label="级别" width="120" />
            <el-table-column prop="isCurrent" label="现任" width="80">
              <template #default="scope">
                <el-tag v-if="scope.row.isCurrent" type="success">是</el-tag>
                <el-tag v-else type="info">否</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80" fixed="right">
              <template #default="scope">
                <el-button type="danger" size="small" @click="removePosition(scope.$index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        
        <!-- 荣誉信息 -->
        <el-divider content-position="left">荣誉信息</el-divider>
        <div class="section-content">
          <el-row :gutter="20">
            <el-col :span="5">
              <el-form-item label="类型">
                <el-select v-model="honorForm.type" placeholder="选择类型" style="width: 100%;">
                  <el-option v-for="item in honorTypeOptions" :key="item" :label="item" :value="item" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="6">
              <el-form-item label="荣誉名称">
                <el-input v-model="honorForm.title" placeholder="荣誉名称" />
              </el-form-item>
            </el-col>
            <el-col :span="5">
              <el-form-item label="级别">
                <el-select v-model="honorForm.level" placeholder="选择级别" style="width: 100%;">
                  <el-option v-for="item in honorLevelOptions" :key="item" :label="item" :value="item" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="4">
              <el-form-item label="获得年份">
                <el-input-number v-model="honorForm.year" :min="1" :max="2100" style="width: 100%;" />
              </el-form-item>
            </el-col>
            <el-col :span="4">
              <el-form-item>
                <el-button type="primary" @click="addHonor">添加</el-button>
              </el-form-item>
            </el-col>
          </el-row>
          
          <!-- 荣誉列表 -->
          <el-table v-if="form.honors.length > 0" :data="form.honors" border size="small" style="margin-top: 10px;">
            <el-table-column prop="type" label="类型" width="100" />
            <el-table-column prop="title" label="荣誉名称" />
            <el-table-column prop="level" label="级别" width="100" />
            <el-table-column prop="year" label="获得年份" width="100" />
            <el-table-column label="操作" width="80" fixed="right">
              <template #default="scope">
                <el-button type="danger" size="small" @click="removeHonor(scope.$index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        
        <!-- 备注 -->
        <el-divider content-position="left">备注</el-divider>
        <el-row :gutter="20">
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input
                v-model="form.remark"
                type="textarea"
                :rows="4"
                placeholder="请输入备注信息（原biography字段内容）"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 照片上传 -->
        <el-divider content-position="left">照片</el-divider>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="资料照片">
              <el-upload
                class="avatar-uploader"
                action="/api/upload"
                :show-file-list="false"
                :on-success="handleAvatarSuccess"
              >
                <img v-if="form.avatar" :src="form.avatar" class="avatar" />
                <el-icon v-else class="avatar-uploader-icon"><Plus /></el-icon>
              </el-upload>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="照片库">
              <el-upload
                action="/api/upload"
                list-type="picture-card"
                :file-list="form.photoGallery.map(url => ({ url }))"
                :on-success="handlePhotoSuccess"
              >
                <el-icon><Plus /></el-icon>
              </el-upload>
            </el-form-item>
          </el-col>
        </el-row>
        
        <el-form-item style="margin-top: 30px;">
          <el-button type="primary" size="large" @click="submitForm">保存</el-button>
          <el-button size="large" @click="goBack">返回</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { memberApi, wivesApi, initCloud } from '../../api/cloudApi.js'
import { returnToMembersList } from '../../utils/membersListQuery.js'

const route = useRoute()
const router = useRouter()
const formRef = ref(null)
const loading = ref(false)

// 判断是否为编辑模式（id存在且不为undefined字符串）
const isEdit = computed(() => {
  const id = route.params.id
  return id && id !== 'undefined' && id !== 'null' && id !== ''
})

// 如果是无效ID，重定向到添加页面
if (route.params.id === 'undefined' || route.params.id === 'null') {
  router.replace('/members/add')
}

// 农历月份和日期名称
const lunarMonths = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊']
const lunarDays = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
]

// 表单数据
const form = reactive({
  // 云数据库文档ID（用于更新）
  _id: '',
  // ID
  memberId: '',
  originalId: '',
  
  // 基本信息
  name: '',
  generation: null,
  branch: '',
  gender: '男',
  hasBrokenLineage: false,
  brokenLineageNote: '',
  lifespan: null,
  
  // 隐私设置（32代以后生效）
  isPublic: false,
  
  // 出生日期（农历）
  birthDate: {
    lunar: { year: null, month: null, day: null, isLeap: false },
    gregorian: { year: null, month: null, day: null, formatted: '' },
    dynasty: '',
    eraName: '',
    eraYear: null,
    ganzhi: '',
    zodiac: '',
    converted: false
  },
  
  // 逝世日期（农历）
  deathDate: {
    lunar: { year: null, month: null, day: null, isLeap: false },
    gregorian: { year: null, month: null, day: null, formatted: '' },
    dynasty: '',
    eraName: '',
    eraYear: null,
    ganzhi: '',
    zodiac: '',
    converted: false
  },
  
  // 亲属关系
  fatherId: '',
  fatherName: '',
  motherId: '',
  motherName: '',
  spouseId: '',
  spouseName: '',
  wifeIds: [],
  
  // 个人信息
  birthplace: '',
  residence: '',
  phone: '',
  
  // 学历（数组）
  education: [],
  
  // 职位（数组）
  positions: [],
  
  // 荣誉（数组）
  honors: [],
  
  // 照片
  avatar: '',
  photoGallery: [],
  
  // 备注
  remark: ''
})

// 学历表单
const educationForm = reactive({
  degree: '',
  school: '',
  major: '',
  year: null,
  isDefault: false
})

// 职位表单
const positionForm = reactive({
  title: '',
  organization: '',
  level: '',
  startYear: null,
  endYear: null,
  isDefault: false,
  isCurrent: false
})

// 荣誉表单
const honorForm = reactive({
  type: '',
  title: '',
  level: '',
  year: null,
  description: ''
})

// 学历选项
const degreeOptions = [
  '小学', '初中', '高中', '中专', '大专', '本科', 
  '硕士', '博士', '博士后', '秀才','进士', '举人', '博学鸿儒', '其他'
]

// 职位级别选项
const levelOptions = [
  '正国级', '副国级', '正部级', '副部级', '正厅级', '副厅级',
  '正处级', '副处级', '正科级', '副科级', '其他'
]

// 荣誉类型选项
const honorTypeOptions = [
  '军人', '烈士', '荣誉称号', '表彰', '勋章', '学位', '科举', '其他'
]

// 荣誉级别选项
const honorLevelOptions = ['国家级', '省级', '市级', '县级', '其他']

const rules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  generation: [{ required: true, message: '请输入世代', trigger: 'blur' }]
}

// 亲属关系验证错误
const fatherError = ref('')
const motherError = ref('')

// 查询成员信息
async function queryMemberById(memberId) {
  try {
    const result = await memberApi.getById(memberId)
    if (result.success && result.data) {
      return result.data
    }
    return null
  } catch (error) {
    console.error('查询成员失败:', error)
    return null
  }
}

function resolveSpouseIdFromData(data) {
  const sid = String(data.spouseId || '').trim()
  if (/^[WS]/i.test(sid)) return sid
  if (Array.isArray(data.wifeIds) && data.wifeIds[0]) return data.wifeIds[0]
  const infoWid = data.spouseInfo && data.spouseInfo[0] && data.spouseInfo[0].wifeId
  if (infoWid) return infoWid
  return sid
}

async function queryWifeById(wifeId) {
  try {
    const result = await wivesApi.getById(wifeId)
    if (result.success && result.data) return result.data
    // 兼容：按 wifeId 字段列表查
    const list = await wivesApi.getList({ wifeId, pageSize: 1 })
    if (list.success && list.data && list.data[0]) return list.data[0]
    return null
  } catch (error) {
    console.error('查询媳妇失败:', error)
    return null
  }
}

// 验证父亲
async function validateFather() {
  fatherError.value = ''
  if (!form.fatherId) {
    form.fatherName = ''
    return
  }
  
  const expectedGen = form.generation - 1
  if (!expectedGen || expectedGen < 1) {
    fatherError.value = '当前世代不能为1（始祖无父母）'
    return
  }
  
  // 查询父亲信息
  const father = await queryMemberById(form.fatherId)
  if (!father) {
    fatherError.value = '未找到该ID的成员'
    return
  }
  
  if (father.generation !== expectedGen) {
    fatherError.value = `世代不符：该成员为${father.generation}代，应为${expectedGen}代`
    form.hasBrokenLineage = true
  } else {
    form.fatherName = father.name
  }
}

// 验证母亲（支持媳妇 W… 或族人 M…/数字 ID）
async function validateMother() {
  motherError.value = ''
  if (!form.motherId) {
    form.motherName = ''
    return
  }

  const mid = String(form.motherId).trim()
  if (/^W/i.test(mid)) {
    const wife = await queryWifeById(mid)
    if (!wife) {
      motherError.value = '未找到该媳妇ID'
      return
    }
    form.motherName = wife.name || ''
    return
  }

  const expectedGen = form.generation - 1
  if (!expectedGen || expectedGen < 1) {
    motherError.value = '当前世代不能为1（始祖无父母）'
    return
  }

  const mother = await queryMemberById(mid)
  if (!mother) {
    motherError.value = '未找到该ID的成员'
    return
  }

  if (mother.generation !== expectedGen) {
    motherError.value = `世代不符：该成员为${mother.generation}代，应为${expectedGen}代`
    form.hasBrokenLineage = true
  } else {
    form.motherName = mother.name
  }
}

// 世代改变时重新验证，并更新隐私设置提示
function validateRelationships() {
  if (form.fatherId) validateFather()
  if (form.motherId) validateMother()
}

// 世代变更时自动调整隐私设置
function onGenerationChange() {
  // 如果从32代以下变为32代及以上，默认公开
  if (form.generation && form.generation <= 32) {
    form.isPublic = true
  }
  // 如果从32代及以上变为32代以下，询问用户是否要设为私密
  // 验证亲属关系
  validateRelationships()
}

// 天干地支计算
const tiangan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const dizhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const zodiacAnimals = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']

// 计算干支和生肖
function calculateGanzhi(year) {
  const ganIndex = (year - 4) % 10
  const zhiIndex = (year - 4) % 12
  return {
    ganzhi: tiangan[ganIndex] + dizhi[zhiIndex] + '年',
    zodiac: zodiacAnimals[zhiIndex]
  }
}

// 简化的农历转公历（实际应调用后端API）
function lunarToGregorian(lunar) {
  // 简化处理：农历转公历大约晚1-2个月
  let gYear = lunar.year
  let gMonth = lunar.month + 1
  let gDay = lunar.day
  
  if (gMonth > 12) {
    gMonth -= 12
    gYear += 1
  }
  
  return { year: gYear, month: gMonth, day: gDay }
}

// 获取朝代年号（简化版）
function getDynastyInfo(year) {
  if (year >= 1949) return { dynasty: '中华人民共和国', eraName: null, eraYear: year - 1949 + 1 }
  if (year >= 1912) return { dynasty: '民国', eraName: null, eraYear: year - 1912 + 1 }
  if (year >= 1644) return { dynasty: '清', eraName: '康熙', eraYear: year - 1661 + 1 }
  if (year >= 1368) return { dynasty: '明', eraName: '永乐', eraYear: year - 1402 + 1 }
  if (year >= 1271) return { dynasty: '元', eraName: '至元', eraYear: year - 1264 + 1 }
  if (year >= 960) return { dynasty: '宋', eraName: '绍兴', eraYear: year - 1131 + 1 }
  return { dynasty: '未知', eraName: null, eraYear: null }
}

// 计算寿命
function calculateLifespan() {
  const birthYear = form.birthDate.lunar.year
  const deathYear = form.deathDate.lunar.year
  
  if (birthYear && deathYear) {
    form.lifespan = deathYear - birthYear
  } else {
    form.lifespan = null
  }
}

// 转换出生日期
function convertBirthDate() {
  const lunar = form.birthDate.lunar
  if (!lunar.year || !lunar.month || !lunar.day) {
    ElMessage.warning('请填写完整的农历日期')
    return
  }
  
  const gregorian = lunarToGregorian(lunar)
  const ganzhiInfo = calculateGanzhi(gregorian.year)
  const dynastyInfo = getDynastyInfo(gregorian.year)
  
  form.birthDate.gregorian = {
    ...gregorian,
    formatted: `${gregorian.year}年${gregorian.month}月${gregorian.day}日`
  }
  form.birthDate.ganzhi = ganzhiInfo.ganzhi
  form.birthDate.zodiac = ganzhiInfo.zodiac
  form.birthDate.dynasty = dynastyInfo.dynasty
  form.birthDate.eraName = dynastyInfo.eraName
  form.birthDate.eraYear = dynastyInfo.eraYear
  form.birthDate.converted = true
  
  // 自动计算寿命
  calculateLifespan()
  
  ElMessage.success('日期转换成功')
}

// 转换逝世日期
function convertDeathDate() {
  const lunar = form.deathDate.lunar
  if (!lunar.year || !lunar.month || !lunar.day) {
    ElMessage.warning('请填写完整的农历日期')
    return
  }
  
  const gregorian = lunarToGregorian(lunar)
  const ganzhiInfo = calculateGanzhi(gregorian.year)
  const dynastyInfo = getDynastyInfo(gregorian.year)
  
  form.deathDate.gregorian = {
    ...gregorian,
    formatted: `${gregorian.year}年${gregorian.month}月${gregorian.day}日`
  }
  form.deathDate.ganzhi = ganzhiInfo.ganzhi
  form.deathDate.zodiac = ganzhiInfo.zodiac
  form.deathDate.dynasty = dynastyInfo.dynasty
  form.deathDate.eraName = dynastyInfo.eraName
  form.deathDate.eraYear = dynastyInfo.eraYear
  form.deathDate.converted = true
  
  // 自动计算寿命
  calculateLifespan()
  
  ElMessage.success('日期转换成功')
}

// 添加学历
function addEducation() {
  if (!educationForm.degree) {
    ElMessage.warning('请填写学历')
    return
  }
  form.education.push({ ...educationForm })
  // 重置表单
  educationForm.degree = ''
  educationForm.school = ''
  educationForm.major = ''
  educationForm.year = null
  educationForm.isDefault = false
  ElMessage.success('添加成功')
}

// 删除学历
function removeEducation(index) {
  form.education.splice(index, 1)
}

// 添加职位
function addPosition() {
  if (!positionForm.title) {
    ElMessage.warning('请填写职位名称')
    return
  }
  form.positions.push({ ...positionForm })
  // 重置表单
  positionForm.title = ''
  positionForm.organization = ''
  positionForm.level = ''
  positionForm.startYear = null
  positionForm.endYear = null
  positionForm.isDefault = false
  positionForm.isCurrent = false
  ElMessage.success('添加成功')
}

// 删除职位
function removePosition(index) {
  form.positions.splice(index, 1)
}

// 添加荣誉
function addHonor() {
  if (!honorForm.title) {
    ElMessage.warning('请填写荣誉名称')
    return
  }
  form.honors.push({ ...honorForm })
  // 重置表单
  honorForm.type = ''
  honorForm.title = ''
  honorForm.level = ''
  honorForm.year = null
  honorForm.description = ''
  ElMessage.success('添加成功')
}

// 删除荣誉
function removeHonor(index) {
  form.honors.splice(index, 1)
}

// 头像上传成功
function handleAvatarSuccess(res) {
  form.avatar = res.url
  ElMessage.success('上传成功')
}

// 照片上传成功
function handlePhotoSuccess(res) {
  form.photoGallery.push(res.url)
  ElMessage.success('上传成功')
}

// 删除照片
function removePhoto(index) {
  form.photoGallery.splice(index, 1)
}

const submitForm = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  
  loading.value = true
  try {
    // 准备提交的数据
    const submitData = {
      name: form.name,
      generation: form.generation,
      branch: form.branch,
      gender: form.gender,
      hasBrokenLineage: form.hasBrokenLineage,
      brokenLineageNote: form.brokenLineageNote,
      lifespan: form.lifespan,
      birthDate: form.birthDate,
      deathDate: form.deathDate,
      fatherId: form.fatherId,
      fatherName: form.fatherName,
      motherId: form.motherId,
      motherName: form.motherName,
      spouseId: form.spouseId,
      spouseName: form.spouseName,
      wifeIds: (() => {
        const sid = String(form.spouseId || '').trim()
        if (!/^W/i.test(sid)) return form.wifeIds || []
        const rest = (form.wifeIds || []).filter((id) => id && id !== sid)
        return [sid, ...rest]
      })(),
      birthplace: form.birthplace,
      residence: form.residence,
      phone: form.phone,
      education: form.education,
      positions: form.positions,
      honors: form.honors,
      avatar: form.avatar,
      photoGallery: form.photoGallery,
      remark: form.remark,
      isPublic: form.isPublic
    }
    
    if (isEdit.value) {
      submitData.memberId = form.memberId
    }
    
    let result
    if (isEdit.value) {
      // 编辑模式 - 使用云数据库的 _id 更新数据
      if (!form._id) {
        ElMessage.error('缺少文档ID，无法更新')
        loading.value = false
        return
      }
      result = await memberApi.update(form._id, submitData)
    } else {
      // 添加模式 - 创建新数据（memberId / originalId 由服务端自动生成）
      result = await memberApi.create(submitData)
    }
    
    if (result.success) {
      ElMessage.success(
        isEdit.value
          ? '修改成功（已写入云库并同步本地数据）'
          : '添加成功（已写入云库并同步本地数据）'
      )
      returnToMembersList(router, route.query)
    } else {
      ElMessage.error(result.message || (isEdit.value ? '修改失败' : '添加失败'))
    }
  } catch (error) {
    console.error('提交失败:', error)
    ElMessage.error('操作失败: ' + (error.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

// 加载成员数据（编辑模式）
async function loadMemberData() {
  if (!isEdit.value) return
  
  loading.value = true
  try {
    const result = await memberApi.getById(route.params.id)
    if (result.success && result.data) {
      const data = result.data
      // 填充表单数据
      Object.assign(form, {
        // 云数据库文档ID
        _id: data._id || '',
        memberId: data.memberId || '',
        originalId: data.originalId || '',
        name: data.name || '',
        generation: data.generation || null,
        branch: data.branch || '',
        gender: data.gender || '男',
        hasBrokenLineage: data.hasBrokenLineage || false,
        brokenLineageNote: data.brokenLineageNote || '',
        lifespan: data.lifespan || null,
        isPublic: data.isPublic !== undefined ? data.isPublic : false,
        birthDate: data.birthDate || {
          lunar: { year: null, month: null, day: null, isLeap: false },
          gregorian: { year: null, month: null, day: null, formatted: '' },
          dynasty: '', eraName: '', eraYear: null,
          ganzhi: '', zodiac: '', converted: false
        },
        deathDate: data.deathDate || {
          lunar: { year: null, month: null, day: null, isLeap: false },
          gregorian: { year: null, month: null, day: null, formatted: '' },
          dynasty: '', eraName: '', eraYear: null,
          ganzhi: '', zodiac: '', converted: false
        },
        fatherId: data.fatherId || '',
        fatherName: data.fatherName || '',
        motherId: data.motherId || '',
        motherName: data.motherName || '',
        spouseId: resolveSpouseIdFromData(data),
        spouseName: data.spouseName || '',
        wifeIds: Array.isArray(data.wifeIds) ? data.wifeIds : [],
        birthplace: data.birthplace || '',
        residence: data.residence || '',
        phone: data.phone || '',
        education: data.education || [],
        positions: data.positions || [],
        honors: data.honors || [],
        avatar: data.avatar || '',
        photoGallery: data.photoGallery || [],
        remark: data.remark || ''
      })
    } else {
      ElMessage.error('获取数据失败: ' + (result.message || '未知错误'))
      returnToMembersList(router, route.query)
    }
  } catch (error) {
    console.error('加载成员数据失败:', error)
    ElMessage.error('加载数据失败: ' + (error.message || '未知错误'))
    returnToMembersList(router, route.query)
  } finally {
    loading.value = false
  }
}

// 页面加载时初始化
onMounted(async () => {
  const success = await initCloud()
  if (success) {
    loadMemberData()
  } else {
    ElMessage.warning('云开发初始化失败，请检查网络或配置')
  }
})

const goBack = () => {
  returnToMembersList(router, route.query)
}
</script>

<style scoped>
.member-form {
  padding: 20px;
}

.card-header {
  font-weight: bold;
  font-size: 18px;
}

.conversion-result {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.section-content {
  background-color: #f5f7fa;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 10px;
}

/* 头像上传样式 */
.avatar-uploader {
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: var(--el-transition-duration-fast);
  width: 120px;
  height: 120px;
}

.avatar-uploader:hover {
  border-color: var(--el-color-primary);
}

.avatar-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 120px;
  height: 120px;
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: center;
}

.avatar {
  width: 120px;
  height: 120px;
  display: block;
  object-fit: cover;
}

:deep(.el-divider__text) {
  font-size: 16px;
  font-weight: bold;
  color: #409eff;
}

:deep(.el-form-item__label) {
  font-weight: 500;
}

.id-input-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.generation-error {
  color: #f56c6c;
  font-size: 12px;
  margin-top: 4px;
}

.privacy-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
  line-height: 1.4;
}
</style>
