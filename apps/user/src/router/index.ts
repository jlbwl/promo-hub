import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { showToast } from 'vant'

// 获取当前登录类型
const getLoginType = (): 'user' | 'employee' | null => {
  const type = localStorage.getItem('login_type')
  if (type === 'employee') return 'employee'
  if (localStorage.getItem('user_token')) return 'user'
  return null
}

// 路由配置
const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { title: '登录', requiresAuth: false }
  },
  {
    path: '/employee/login',
    name: 'EmployeeLogin',
    component: () => import('../views/EmployeeLoginView.vue'),
    meta: { title: '员工登录', requiresAuth: false }
  },
  {
    path: '/',
    name: 'TabbarLayout',
    component: () => import('../layouts/TabbarLayout.vue'),
    redirect: '/home',
    children: [
      {
        path: 'home',
        name: 'Home',
        component: () => import('../views/HomeView.vue'),
        meta: { title: '产品大厅', requiresAuth: false }
      },
      {
        path: 'product/:id',
        name: 'ProductDetail',
        component: () => import('../views/ProductDetailView.vue'),
        meta: { title: '产品详情', requiresAuth: false }
      },
      {
        path: 'commissions',
        name: 'Commissions',
        component: () => import('../views/CommissionView.vue'),
        meta: { title: '佣金', requiresAuth: true }
      },
      {
        path: 'cart',
        name: 'Cart',
        component: () => import('../views/CartView.vue'),
        meta: { title: '收藏', requiresAuth: true }
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('../views/ProfileView.vue'),
        meta: { title: '个人中心', requiresAuth: true, requiresUser: true }
      },
      {
        path: 'employee-profile',
        name: 'EmployeeProfile',
        component: () => import('../views/EmployeeProfileView.vue'),
        meta: { title: '员工中心', requiresAuth: true, requiresEmployee: true }
      }
    ]
  },
  // 404 兜底路由
  {
    path: '/:pathMatch(.*)*',
    redirect: '/home'
  }
]

// 创建路由实例
const router = createRouter({
  history: createWebHistory('/user/'),
  routes
})

// 处理动态导入失败（部署后缓存问题）
router.onError((error: any) => {
  const pattern = /Failed to fetch dynamically imported module/i
  if (pattern.test(error.message)) {
    window.location.reload()
  }
})

// 全局前置守卫
router.beforeEach((to, _from, next) => {
  // 设置页面标题
  if (to.meta.title) {
    document.title = to.meta.title as string
  }

  const loginType = getLoginType()

  // 检查是否需要登录
  if (to.meta.requiresAuth === true) {
    const token = localStorage.getItem('user_token')
    if (!token) {
      next({ name: 'Login', query: { redirect: to.fullPath } })
      return
    }
  }

  // 检查是否需要主账户权限
  if (to.meta.requiresUser === true) {
    if (loginType === 'employee') {
      showToast('员工账户无法访问此页面')
      next({ name: 'EmployeeProfile' })
      return
    }
  }

  // 检查是否需要员工账户权限
  if (to.meta.requiresEmployee === true) {
    if (loginType !== 'employee') {
      showToast('请使用员工账户登录')
      next({ name: 'Profile' })
      return
    }
  }

  next()
})

export default router
