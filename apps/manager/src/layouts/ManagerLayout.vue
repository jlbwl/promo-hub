<template>
  <!-- 移动端骨架：顶部栏 + 内容区 + 底部 Tabbar + 抽屉菜单 -->
  <div
    v-if="isMobile"
    class="manager-mobile"
  >
    <header class="mobile-header">
      <button
        type="button"
        class="mobile-icon-btn"
        aria-label="打开菜单"
        @click="drawerVisible = true"
      >
        <el-icon :size="22">
          <Expand />
        </el-icon>
      </button>
      <span class="mobile-page-title">{{ currentTitle }}</span>
      <span class="mobile-manager-name">{{ managerName }}</span>
    </header>

    <main class="mobile-main">
      <router-view />
      <IcpFooter :icp-number="icpNumber" />
    </main>

    <nav class="mobile-tabbar">
      <router-link
        v-for="item in menuItems"
        :key="item.path"
        :to="item.path"
        class="mobile-tab"
        :class="{ 'is-active': isActiveMenu(item.path) }"
      >
        <el-icon :size="20">
          <component :is="item.icon" />
        </el-icon>
        <span class="mobile-tab-label">{{ item.label }}</span>
      </router-link>
    </nav>

    <!-- 抽屉导航：顶栏菜单按钮与底部导航之外的入口 -->
    <el-drawer
      v-model="drawerVisible"
      direction="ltr"
      size="72%"
      :with-header="false"
      body-class="mobile-drawer-body"
      class="mobile-drawer"
    >
      <div class="drawer-brand">
        <h2>渠道经理后台</h2>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        class="drawer-menu"
        @select="drawerVisible = false"
      >
        <el-menu-item
          v-for="item in menuItems"
          :key="item.path"
          :index="item.path"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>
            {{ item.label }}
          </template>
        </el-menu-item>
      </el-menu>
      <div class="drawer-footer">
        <span class="drawer-manager">{{ managerName }}</span>
        <el-button
          type="danger"
          plain
          @click="handleLogout"
        >
          退出登录
        </el-button>
      </div>
    </el-drawer>
  </div>

  <!-- 桌面端骨架：保持原有左侧栏 + 顶栏 + 主内容区 -->
  <el-container
    v-else
    class="manager-layout"
  >
    <el-aside
      :width="isCollapse ? '64px' : '220px'"
      class="layout-aside"
    >
      <div class="logo-container">
        <h2 v-if="!isCollapse">
          渠道经理后台
        </h2>
        <h2 v-if="isCollapse">
          渠道
        </h2>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapse"
        :collapse-transition="false"
        router
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409eff"
      >
        <el-menu-item
          v-for="item in menuItems"
          :key="item.path"
          :index="item.path"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>
            {{ item.label }}
          </template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container class="layout-main-container">
      <el-header class="layout-header">
        <div class="header-left">
          <el-icon
            class="collapse-btn"
            @click="isCollapse = !isCollapse"
          >
            <Fold v-if="!isCollapse" />
            <Expand v-else />
          </el-icon>
          <span class="page-title">{{ currentTitle }}</span>
        </div>
        <div class="header-right">
          <span class="manager-name">{{ managerName }}</span>
          <el-button
            type="danger"
            text
            @click="handleLogout"
          >
            <el-icon><SwitchButton /></el-icon>
            退出登录
          </el-button>
        </div>
      </el-header>

      <el-main class="layout-main">
        <router-view />
      </el-main>

      <IcpFooter :icp-number="icpNumber" />
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { post, clearAuthStorage } from '@promo/shared/utils/request'
import {
  Odometer,
  Goods,
  Money,
  User,
  Fold,
  Expand,
  SwitchButton
} from '@element-plus/icons-vue'
import IcpFooter from '../components/IcpFooter.vue'
import { useIsMobile } from '../composables/useIsMobile'
import { useSwipeBack } from '../composables/useSwipeBack'

const route = useRoute()
const router = useRouter()
const { isMobile } = useIsMobile()

// 从环境变量读取 ICP 备案号
const icpNumber = import.meta.env.VITE_ICP_NUMBER || ''

// 侧边栏折叠状态（仅桌面端）
const isCollapse = ref(false)
// 移动端抽屉菜单
const drawerVisible = ref(false)

// 移动端左缘右滑返回上一页；抽屉打开时让位给抽屉手势
useSwipeBack(() => !drawerVisible.value)

// 菜单配置：桌面侧栏、移动端抽屉与 Tabbar 共用
const menuItems = [
  { path: '/dashboard', label: '仪表盘', icon: Odometer },
  { path: '/products', label: '产品管理', icon: Goods },
  { path: '/commissions', label: '佣金管理', icon: Money },
  { path: '/profile', label: '个人中心', icon: User },
]

// 经理姓名（从登录信息获取）
const managerName = ref('')

// 页面加载时读取经理信息
onMounted(() => {
  try {
    const info = JSON.parse(localStorage.getItem('manager_info') || '{}')
    managerName.value = info.teamName || info.name || info.username || '经理'
  } catch {
    managerName.value = '经理'
  }
})

// 当前激活菜单
const activeMenu = computed(() => route.path)

// 移动端高亮：子路由（如 /products/create）归属父级菜单
const isActiveMenu = (path: string) => route.path === path || route.path.startsWith(`${path}/`)

// 当前页面标题
const currentTitle = computed(() => {
  return (route.meta.title as string) || '渠道经理后台'
})

// 退出登录
const handleLogout = async () => {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    // 服务端吊销 refresh token，并清除本端全部登录态
    const refreshToken = localStorage.getItem('manager_refresh_token')
    try {
      await post('/auth/logout', refreshToken ? { refreshToken } : {})
    } catch {
      // 网络异常不阻塞本地登出
    }
    clearAuthStorage()
    ElMessage.success('已退出登录')
    router.push('/login')
  } catch {
    // 用户取消操作
  }
}
</script>

<style lang="scss" scoped>
.manager-layout {
  height: 100vh;
  overflow: hidden;
}

.layout-aside {
  background-color: #304156;
  transition: width 0.3s;
  overflow: hidden;

  .logo-container {
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #263445;

    h2 {
      color: #fff;
      font-size: 16px;
      white-space: nowrap;
      overflow: hidden;
    }
  }

  .el-menu {
    border-right: none;
    height: calc(100vh - 60px);
    overflow-y: auto;
  }
}

.layout-main-container {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  padding: 0 20px;
  height: 60px;
  z-index: 1;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .collapse-btn {
      font-size: 20px;
      cursor: pointer;
      color: #606266;

      &:hover {
        color: #409eff;
      }
    }

    .page-title {
      font-size: 16px;
      font-weight: 500;
      color: #303133;
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;

    .manager-name {
      font-size: 14px;
      color: #606266;
    }
  }
}

.layout-main {
  background-color: #f5f7fa;
  overflow-y: auto;
  padding: 20px;
}

/* ===== 移动端骨架（≤768px，由 isMobile 分支控制渲染） ===== */
.manager-mobile {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background-color: #f5f7fa;
}

.mobile-header {
  flex: none;
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 52px;
  padding: env(safe-area-inset-top) 12px 0 4px;
  background-color: #ffffff;
  border-bottom: 1px solid #e4e7ed;
  position: relative;
  z-index: 10;
}

.mobile-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #606266;
  -webkit-tap-highlight-color: transparent;

  &:active {
    background-color: #f0f2f5;
  }
}

.mobile-page-title {
  flex: 1;
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-manager-name {
  flex: none;
  max-width: 96px;
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-main {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 12px 12px 16px;
}

.mobile-tabbar {
  flex: none;
  display: flex;
  background-color: #ffffff;
  border-top: 1px solid #e4e7ed;
  padding-bottom: env(safe-area-inset-bottom);
}

.mobile-tab {
  flex: 1;
  min-height: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: #909399;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;

  &:hover,
  &:focus {
    color: #909399;
    text-decoration: none;
  }

  &.is-active {
    color: #409eff;
  }
}

.mobile-tab-label {
  font-size: 11px;
  line-height: 1.2;
}

.drawer-brand {
  display: flex;
  align-items: center;
  height: 60px;
  padding: 0 16px;
  background-color: #263445;

  h2 {
    color: #ffffff;
    font-size: 16px;
    font-weight: 600;
  }
}

.drawer-menu {
  flex: 1;
  border-right: none;
  overflow-y: auto;
}

.drawer-footer {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  border-top: 1px solid #e4e7ed;

  .drawer-manager {
    font-size: 13px;
    color: #606266;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>

<style lang="scss">
/* 抽屉内部为 teleport 渲染，改用全局样式保证生效 */
.mobile-drawer {
  .mobile-drawer-body {
    display: flex;
    flex-direction: column;
    padding: 0;
  }
}
</style>
