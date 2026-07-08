<template>
  <div class="admin-layout-wrapper">
    <!-- 移动端侧边栏遮罩 -->
    <div
      v-if="sidebarVisible"
      class="sidebar-mask"
      @click="sidebarVisible = false"
    />

    <el-container class="admin-layout">
      <!-- 左侧导航栏 -->
      <el-aside
        :width="isMobile ? (sidebarVisible ? '220px' : '0px') : '220px'"
        class="admin-aside"
        :class="{ 'aside-visible': sidebarVisible && isMobile }"
      >
        <div class="logo">
          <h2>管理后台</h2>
        </div>
        <el-menu
          :default-active="activeMenu"
          class="admin-menu"
          background-color="#304156"
          text-color="#bfcbd9"
          active-text-color="#409eff"
          router
          @select="handleMenuSelect"
        >
          <el-menu-item index="/dashboard">
            <el-icon><Odometer /></el-icon>
            <span>仪表盘</span>
          </el-menu-item>
          <el-menu-item index="/managers">
            <el-icon><User /></el-icon>
            <span>渠道管理</span>
          </el-menu-item>
          <el-menu-item index="/users">
            <el-icon><UserFilled /></el-icon>
            <span>团队管理</span>
          </el-menu-item>
          <el-menu-item index="/commissions">
            <el-icon><Wallet /></el-icon>
            <span>积分管理</span>
          </el-menu-item>
          <el-menu-item index="/categories">
            <el-icon><Grid /></el-icon>
            <span>分类管理</span>
          </el-menu-item>
          <el-menu-item index="/settings">
            <el-icon><Setting /></el-icon>
            <span>系统设置</span>
          </el-menu-item>
          <el-menu-item index="/operation-logs">
            <el-icon><Files /></el-icon>
            <span>操作日志</span>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <el-container>
        <!-- 顶部栏 -->
        <el-header class="admin-header">
          <div class="header-left">
            <el-button
              v-if="isMobile"
              icon="Menu"
              class="menu-btn"
              @click="sidebarVisible = !sidebarVisible"
            />
            <span class="page-title">{{ pageTitle }}</span>
          </div>
          <div class="header-right">
            <span class="admin-name">管理员</span>
            <el-button
              type="danger"
              text
              @click="handleLogout"
            >
              退出登录
            </el-button>
          </div>
        </el-header>

        <!-- 主内容区（可滚动） -->
        <el-main class="admin-main">
          <router-view />
        </el-main>

        <!-- ICP 备案信息 -->
        <IcpFooter :icp-number="icpNumber" />
      </el-container>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Odometer, User, UserFilled, Setting, Wallet, Files, Grid } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import IcpFooter from '../components/IcpFooter.vue'

const route = useRoute()
const router = useRouter()

// 从环境变量读取 ICP 备案号
const icpNumber = import.meta.env.VITE_ICP_NUMBER || ''

// 当前激活的菜单项
const activeMenu = computed(() => route.path)

// 页面标题
const pageTitle = computed(() => (route.meta.title as string) || '管理后台')

// 是否是移动端
const isMobile = ref(false)
const sidebarVisible = ref(false)

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
  if (!isMobile.value) {
    sidebarVisible.value = false
  }
}

const handleMenuSelect = () => {
  if (isMobile.value) {
    sidebarVisible.value = false
  }
}

const handleLogout = async () => {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    localStorage.removeItem('admin_token')
    router.push('/login')
  } catch {
    // 用户取消退出
  }
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<style lang="scss" scoped>
.admin-layout-wrapper {
  height: 100%;
  position: relative;
}

.admin-layout {
  height: 100%;
}

.sidebar-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 100;
}

.admin-aside {
  background-color: #304156;
  overflow-y: auto;
  transition: width 0.3s ease;
  flex-shrink: 0;

  .logo {
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #263445;

    h2 {
      color: #fff;
      font-size: 18px;
      font-weight: 600;
      letter-spacing: 2px;
    }
  }

  .admin-menu {
    border-right: none;
  }
}

.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  padding: 0 20px;
  height: 60px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .menu-btn {
      display: none;
    }

    .page-title {
      font-size: 16px;
      font-weight: 600;
      color: #303133;
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;

    .admin-name {
      font-size: 14px;
      color: #606266;
    }
  }
}

.admin-main {
  background-color: #f5f7fa;
  padding: 20px;
  overflow-y: auto;
}

@media (max-width: 768px) {
  .admin-aside {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 101;
    width: 0;
    overflow: hidden;

    &.aside-visible {
      width: 220px;
    }
  }

  .admin-header {
    padding: 0 15px;

    .header-left {
      .menu-btn {
        display: block;
      }

      .page-title {
        font-size: 14px;
      }
    }

    .header-right {
      gap: 10px;

      .admin-name {
        display: none;
      }
    }
  }

  .admin-main {
    padding: 15px;
  }
}
</style>
