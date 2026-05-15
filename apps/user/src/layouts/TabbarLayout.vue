<template>
  <div class="tabbar-layout">
    <!-- 主内容区域 -->
    <div class="tabbar-content">
      <router-view />
    </div>

    <!-- 底部 Tab 导航（产品详情页隐藏） -->
    <van-tabbar v-model="activeTab" route fixed placeholder v-show="!isProductDetail">
      <van-tabbar-item
        to="/home"
        icon="home-o"
        name="home"
      >
        抢单大厅
      </van-tabbar-item>
      <!-- 收藏（仅主账户显示） -->
      <van-tabbar-item
        v-if="!isEmployee"
        to="/cart"
        icon="star-o"
        name="cart"
        :badge="cartCount > 0 ? cartCount : ''"
      >
        收藏
      </van-tabbar-item>
      <!-- 主账户显示积分页面 -->
      <van-tabbar-item
        v-if="!isEmployee"
        to="/commissions"
        icon="coins"
        name="commissions"
      >
        积分
      </van-tabbar-item>
      <van-tabbar-item
        :to="isEmployee ? '/employee-profile' : '/profile'"
        icon="user-o"
        :name="isEmployee ? 'employee-profile' : 'profile'"
      >
        {{ isEmployee ? '员工中心' : '我的' }}
      </van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { get } from '@promo/shared/utils/request'

// 当前激活的 Tab
const activeTab = ref('home')

// 购物车数量
const cartCount = ref(0)

// 获取当前用户ID
const getUserId = () => {
  try {
    const info = JSON.parse(localStorage.getItem('user_info') || '{}')
    return info.id || ''
  } catch { return '' }
}

// 获取购物车数量
const fetchCartCount = async () => {
  const userId = getUserId()
  if (!userId) return
  try {
    const res = await get<any[]>('/cart', { userId })
    if (res.code === 0) {
      cartCount.value = res.data?.length || 0
    }
  } catch (error) {
    console.error('获取购物车数量失败:', error)
  }
}

onMounted(() => {
  fetchCartCount()
})

// 获取当前路由
const route = useRoute()

// 是否为产品详情页
const isProductDetail = computed(() => route.path.startsWith('/product'))

// 是否为员工账户
const isEmployee = computed(() => {
  return localStorage.getItem('login_type') === 'employee'
})

// 监听路由变化，同步更新 Tab 激活状态
watch(
  () => route.path,
  (newPath) => {
    if (newPath.startsWith('/home') || newPath.startsWith('/product')) {
      activeTab.value = 'home'
    } else if (newPath.startsWith('/commissions')) {
      activeTab.value = 'commissions'
    } else if (newPath.startsWith('/profile') || newPath.startsWith('/employee-profile')) {
      activeTab.value = isEmployee.value ? 'employee-profile' : 'profile'
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.tabbar-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.tabbar-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
