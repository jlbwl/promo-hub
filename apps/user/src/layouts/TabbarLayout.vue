<template>
  <div class="tabbar-layout">
    <!-- 主内容区域 -->
    <div class="tabbar-content">
      <router-view />
    </div>

    <!-- 底部 Tab 导航 -->
    <van-tabbar v-model="activeTab" route fixed placeholder>
      <van-tabbar-item
        to="/home"
        icon="home-o"
        name="home"
      >
        首页
      </van-tabbar-item>
      <van-tabbar-item
        to="/commissions"
        icon="balance-o"
        name="commissions"
      >
        佣金
      </van-tabbar-item>
      <van-tabbar-item
        to="/profile"
        icon="user-o"
        name="profile"
      >
        我的
      </van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

// 当前激活的 Tab
const activeTab = ref('home')

// 获取当前路由
const route = useRoute()

// 监听路由变化，同步更新 Tab 激活状态
watch(
  () => route.path,
  (newPath) => {
    if (newPath.startsWith('/home') || newPath.startsWith('/product')) {
      activeTab.value = 'home'
    } else if (newPath.startsWith('/commissions')) {
      activeTab.value = 'commissions'
    } else if (newPath.startsWith('/profile')) {
      activeTab.value = 'profile'
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
