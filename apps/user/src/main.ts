import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
// 函数式组件（showToast/showConfirmDialog）的样式不会被 VantResolver 自动按需引入，需在入口显式引入
import 'vant/es/toast/style'
import 'vant/es/dialog/style'
import 'vant/es/image-preview/style'
// 图片懒加载指令：van-image 的 lazy-load 依赖全局注册的 v-lazy，VantResolver 不会自动注册指令
import Lazyload from 'vant/es/lazyload'
import { setSessionExpiredHandler } from '@promo/shared/utils/request'
import './styles/theme.scss'
import './styles/global.scss'

// 创建应用实例
const app = createApp(App)

// 注册 Pinia 状态管理
app.use(createPinia())

// 注册路由
app.use(router)

// 注册图片懒加载（默认 preLoad 1.3，提前视口约 30% 预加载，滚动时无明显闪烁）
app.use(Lazyload)

// 会话彻底失效时走路由跳转登录页，避免整页刷新丢失正在填写的内容
setSessionExpiredHandler(() => {
  const current = router.currentRoute.value
  if (current.path === '/login' || current.path === '/employee/login') return
  router.replace({ path: '/login', query: { redirect: current.fullPath } })
})

// 挂载到 DOM
app.mount('#app')
