import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

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
    name: 'TabbarLayout',
    component: () => import('../layouts/TabbarLayout.vue'),
    redirect: '/home',
    children: [
      {
        path: 'home',
        name: 'Home',
        component: () => import('../views/HomeView.vue'),
        meta: { title: '抢单大厅', requiresAuth: false }
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
        meta: { title: '我的佣金', requiresAuth: true }
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('../views/ProfileView.vue'),
        meta: { title: '个人中心', requiresAuth: true }
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

// 全局前置守卫
router.beforeEach((to, _from, next) => {
  // 设置页面标题
  if (to.meta.title) {
    document.title = to.meta.title as string
  }

  // 检查是否需要登录
  if (to.meta.requiresAuth === true) {
    const token = localStorage.getItem('user_token')
    if (!token) {
      next({ name: 'Login', query: { redirect: to.fullPath } })
      return
    }
  }

  next()
})

export default router
