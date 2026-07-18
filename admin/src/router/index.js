import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/user'

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
        path: 'wives/add',
        name: 'WifeAdd',
        component: () => import('../views/wives/Form.vue'),
        meta: { title: '添加媳妇' }
      },
      {
        path: 'sons-in-law',
        name: 'SonsInLaw',
        component: () => import('../views/sonsInLaw/List.vue'),
        meta: { title: '女婿管理' }
      },
      {
        path: 'sons-in-law/add',
        name: 'SonInLawAdd',
        component: () => import('../views/sonsInLaw/Form.vue'),
        meta: { title: '添加女婿' }
      },
      {
        path: 'import',
        name: 'Import',
        component: () => import('../views/Import.vue'),
        meta: { title: '批量导入' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('../views/Settings.vue'),
        meta: { title: '系统设置' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  
  if (!to.meta.public && !userStore.token) {
    next('/login')
  } else {
    next()
  }
})

export default router
