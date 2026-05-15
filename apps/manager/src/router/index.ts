import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

// 布局组件
import ManagerLayout from '@/layouts/ManagerLayout.vue'

// 页面组件 - 懒加载
const LoginView = () => import('@/views/LoginView.vue')
const DashboardView = () => import('@/views/DashboardView.vue')
const ProductListView = () => import('@/views/product/ProductListView.vue')
const ProductEditView = () => import('@/views/product/ProductEditView.vue')
const CommissionListView = () => import('@/views/commission/CommissionListView.vue')
const ProfileView = () => import('@/views/ProfileView.vue')

// 路由配置
const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: LoginView,
    meta: { title: '登录' }
  },
  {
    path: '/',
    component: ManagerLayout,
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: DashboardView,
        meta: { title: '仪表盘' }
      },
      {
        path: 'products',
        name: 'ProductList',
        component: ProductListView,
        meta: { title: '产品管理' }
      },
      {
        path: 'products/create',
        name: 'ProductCreate',
        component: ProductEditView,
        meta: { title: '新建产品' }
      },
      {
        path: 'products/:id/edit',
        name: 'ProductEdit',
        component: ProductEditView,
        meta: { title: '编辑产品' }
      },
      {
        path: 'commissions',
        name: 'CommissionList',
        component: CommissionListView,
        meta: { title: '积分管理' }
      },
      {
        path: 'profile',
        name: 'Profile',
        component: ProfileView,
        meta: { title: '个人中心' }
      }
    ]
  },
  {
    // 未匹配路由重定向到仪表盘
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard'
  }
]

const router = createRouter({
  history: createWebHistory('/manager/'),
  routes
})

// 全局前置守卫 - 检查渠道经理登录状态
router.beforeEach(async (to, _from, next) => {
  // 设置页面标题
  document.title = (to.meta.title as string) ? `${to.meta.title} - 渠道经理后台` : '渠道经理后台'

  // 检查是否需要认证
  if (to.matched.some(record => record.meta.requiresAuth)) {
    const token = localStorage.getItem('manager_token')
    if (!token) {
      next({ name: 'Login', query: { redirect: to.fullPath } })
      return
    }

    // 验证经理身份是否仍然有效
    try {
      const managerInfo = JSON.parse(localStorage.getItem('manager_info') || '{}')
      if (managerInfo.id) {
        const BASE_URL = import.meta.env?.VITE_API_BASE_URL || '/api'
        const res = await fetch(`${BASE_URL}/managers/${managerInfo.id}/verify`)
        const data = await res.json()
        if (data.code !== 0) {
          // 账号已被删除或禁用，强制退出
          localStorage.removeItem('manager_token')
          localStorage.removeItem('manager_info')
          next({ name: 'Login', query: { redirect: to.fullPath, expired: '1' } })
          return
        }
      }
    } catch {
      // 网络错误不阻止访问
    }
  }

  // 已登录用户访问登录页，重定向到仪表盘
  if (to.name === 'Login') {
    const token = localStorage.getItem('manager_token')
    if (token) {
      next({ name: 'Dashboard' })
      return
    }
  }

  next()
})

export default router
