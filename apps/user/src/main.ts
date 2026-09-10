import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
// 函数式组件（showToast/showConfirmDialog）的样式不会被 VantResolver 自动按需引入，需在入口显式引入
import 'vant/es/toast/style'
import 'vant/es/dialog/style'
import './styles/global.scss'

// 创建应用实例
const app = createApp(App)

// 注册 Pinia 状态管理
app.use(createPinia())

// 注册路由
app.use(router)

// 挂载到 DOM
app.mount('#app')
