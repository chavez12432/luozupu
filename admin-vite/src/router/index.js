import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/user.js'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { public: true }
  },
  {
    path: '/',
    name: 'Layout',
    component: () => import('../views/Layout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/Dashboard.vue'),
        meta: { title: '数据概览' }
      },
      {
        path: 'members',
        name: 'Members',
        component: () => import('../views/members/List.vue'),
        meta: { title: '族人管理' }
      },
      {
        path: 'import',
        name: 'Import',
        component: () => import('../views/Import.vue'),
        meta: { title: '批量导入' }
      },
      {
        path: 'data-import',
        name: 'DataImport',
        component: () => import('../views/DataImport.vue'),
        meta: { title: '旧数据导入' }
      },
      {
        path: 'data-migration',
        name: 'DataMigration',
        component: () => import('../views/DataMigration.vue'),
        meta: { title: '数据迁移到云开发' }
      },
      {
        path: 'data-sync',
        name: 'DataSync',
        component: () => import('../views/DataSync.vue'),
        meta: { title: '数据同步管理' }
      },
      {
        path: 'members/add',
        name: 'MemberAdd',
        component: () => import('../views/members/Form.vue'),
        meta: { title: '添加族人' }
      },
      {
        path: 'members/edit/:id',
        name: 'MemberEdit',
        component: () => import('../views/members/Form.vue'),
        meta: { title: '编辑族人' }
      },
      {
        path: 'wives',
        name: 'Wives',
        component: () => import('../views/wives/List.vue'),
        meta: { title: '媳妇管理' }
      },
      {
        path: 'wives/form',
        name: 'WifeForm',
        component: () => import('../views/wives/Form.vue'),
        meta: { title: '媳妇表单' }
      },
      {
        path: 'sons-in-law',
        name: 'SonsInLaw',
        component: () => import('../views/sons-in-law/List.vue'),
        meta: { title: '女婿管理' }
      },
      {
        path: 'sons-in-law/form',
        name: 'SonInLawForm',
        component: () => import('../views/sons-in-law/Form.vue'),
        meta: { title: '女婿表单' }
      },
      // 荣誉榜（云库可运营）
      {
        path: 'honor/patriarchs',
        name: 'Patriarchs',
        component: () => import('../views/honor/Patriarchs.vue'),
        meta: { title: '族长表' }
      },
      {
        path: 'honor/patriarchs/form',
        name: 'PatriarchForm',
        component: () => import('../views/honor/PatriarchsForm.vue'),
        meta: { title: '族长表单' }
      },
      {
        path: 'honor/sages',
        name: 'Sages',
        component: () => import('../views/honor/Sages.vue'),
        meta: { title: '乡贤榜' }
      },
      {
        path: 'honor/sages/form',
        name: 'SageForm',
        component: () => import('../views/honor/SagesForm.vue'),
        meta: { title: '乡贤表单' }
      },
      {
        path: 'honor/elite',
        name: 'Elite',
        component: () => import('../views/honor/Elite.vue'),
        meta: { title: '群英榜' }
      },
      {
        path: 'honor/elite/form',
        name: 'EliteForm',
        component: () => import('../views/honor/EliteForm.vue'),
        meta: { title: '群英表单' }
      },
      {
        path: 'honor/graduates',
        name: 'Graduates',
        component: () => import('../views/honor/Graduates.vue'),
        meta: { title: '学历榜' }
      },
      {
        path: 'fengtu',
        name: 'Fengtu',
        component: () => import('../views/fengtu/List.vue'),
        meta: { title: '风土志' }
      },
      {
        path: 'fengtu/form',
        name: 'FengtuForm',
        component: () => import('../views/fengtu/Form.vue'),
        meta: { title: '风土志表单' }
      },
      {
        path: 'accounts',
        name: 'Accounts',
        component: () => import('../views/ops/Accounts.vue'),
        meta: { title: '登录账号' }
      },
      {
        path: 'messages',
        name: 'Messages',
        component: () => import('../views/ops/Messages.vue'),
        meta: { title: '开发者留言' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  if (!to.meta.public && !userStore.token) {
    next('/login')
  } else {
    next()
  }
})

export default router
