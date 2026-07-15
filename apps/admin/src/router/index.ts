import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

// 路由配置
const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { title: '登录', requiresAuth: false }
  },
  {
    path: '/',
    name: 'AdminLayout',
    component: () => import('../layouts/AdminLayout.vue'),
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/DashboardView.vue'),
        meta: { title: '仪表盘' }
      },
      {
        path: 'managers',
        name: 'ManagerList',
        component: () => import('../views/manager/ManagerListView.vue'),
        meta: { title: '渠道管理' }
      },
      {
        path: 'users',
        name: 'UserList',
        component: () => import('../views/user/UserListView.vue'),
        meta: { title: '团队管理' }
      },
      {
        path: 'commissions',
        name: 'CommissionAdmin',
        component: () => import('../views/commission/CommissionAdminView.vue'),
        meta: { title: '佣金管理' }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('../views/SettingsView.vue'),
        meta: { title: '系统设置' }
      },
      {
        path: 'categories',
        name: 'CategoryManage',
        component: () => import('../views/category/CategoryManageView.vue'),
        meta: { title: '分类管理' }
      },
      {
        path: 'operation-logs',
        name: 'OperationLogs',
        component: () => import('../views/OperationLogView.vue'),
        meta: { title: '操作日志' }
      }
    ]
  }
]

// 创建路由实例
const router = createRouter({
  history: createWebHistory('/admin/'),
  routes
})

// 处理动态导入失败（部署后缓存问题）
router.onError((error: any) => {
  const pattern = /Failed to fetch dynamically imported module/i
  if (pattern.test(error.message)) {
    window.location.reload()
  }
})

// 路由守卫：检查登录状态
router.beforeEach((to, _from, next) => {
  // 设置页面标题
  const title = to.meta.title as string
  if (title) {
    document.title = `${title} - 管理后台`
  }

  // 检查是否需要认证
  const token = localStorage.getItem('admin_token')

  if (to.meta.requiresAuth !== false && !token) {
    // 未登录且需要认证，跳转到登录页
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else if (to.name === 'Login' && token) {
    // 已登录访问登录页，跳转到仪表盘
    next({ name: 'Dashboard' })
  } else {
    next()
  }
})

export default router
