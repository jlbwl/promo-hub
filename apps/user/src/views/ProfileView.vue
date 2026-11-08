<template>
  <div class="profile-page">
    <van-pull-refresh
      v-model="refreshing"
      @refresh="onRefresh"
    >
      <!-- 用户信息区域 -->
      <UserHeader :user-info="userInfo" />

      <!-- 数据统计 -->
      <StatsCard
        :employee-count="employeeCount"
        @show-employees="showEmployeeList = true"
      />

      <!-- 功能列表 -->
      <van-cell-group
        inset
        class="func-group"
      >
        <van-cell
          title="创建员工子账户"
          icon="user-o"
          is-link
          @click="openCreateEmployee"
        />
      </van-cell-group>

      <van-cell-group
        inset
        class="func-group"
      >
        <van-cell
          title="修改密码"
          icon="lock"
          is-link
          @click="handleChangePassword"
        />
        <van-cell
          title="关于我们"
          icon="info-o"
          is-link
          @click="handleAbout"
        />
        <van-cell
          title="联系客服"
          icon="service-o"
          is-link
          @click="handleContactService"
        />
      </van-cell-group>

      <!-- 退出登录按钮 -->
      <div class="logout-wrap">
        <van-button
          block
          round
          plain
          type="danger"
          size="large"
          @click="logoutDialogVisible = true"
        >
          退出登录
        </van-button>
      </div>
    </van-pull-refresh>

    <!-- 退出登录确认弹窗 -->
    <van-dialog
      v-model:show="logoutDialogVisible"
      title="提示"
      message="确定要退出登录吗？"
      show-cancel-button
      confirm-button-text="确定退出"
      cancel-button-text="取消"
      confirm-button-color="#9C382D"
      @confirm="doLogout"
    />

    <!-- 创建员工子账户弹窗 -->
    <EmployeeFormDialog
      ref="employeeFormDialogRef"
      :user-id="userInfo.id"
      @success="loadEmployees"
    />

    <!-- 员工列表弹窗 -->
    <EmployeeListDialog
      v-model:show="showEmployeeList"
      v-model:loading="loadingEmployees"
      :employees="employees"
      :finished="employeesFinished"
      @load="loadEmployees"
      @edit="handleEditEmployee"
      @add="handleAddEmployee"
      @refresh="loadEmployees"
    />

    <!-- 设置密码弹窗 -->
    <PasswordDialog
      ref="passwordDialogRef"
      :phone="userInfo.phone"
    />
  </div>
</template>

<script setup lang="ts">
import { logger } from '@promo/shared/utils/logger'
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showDialog, showToast } from 'vant'
import { post, clearAuthStorage } from '@promo/shared/utils/request'
import UserHeader from './profile/components/UserHeader.vue'
import StatsCard from './profile/components/StatsCard.vue'
import EmployeeFormDialog from './profile/components/EmployeeFormDialog.vue'
import EmployeeListDialog from './profile/components/EmployeeListDialog.vue'
import PasswordDialog from './profile/components/PasswordDialog.vue'
import { useUserInfo } from './profile/composables/useUserInfo'
import { useEmployees } from './profile/composables/useEmployees'
import type { Employee } from '@promo/shared/types'

// 路由实例
const router = useRouter()

// 用户信息
const { userInfo, loadUserInfo } = useUserInfo()

// 下拉刷新状态
const refreshing = ref(false)

// 员工子账户列表
const {
  showEmployeeList,
  employees,
  loadingEmployees,
  employeesFinished,
  employeeCount,
  loadEmployees,
} = useEmployees(() => userInfo.id)

// 弹窗引用
const employeeFormDialogRef = ref<{ open: (emp?: Employee) => void } | null>(null)
const passwordDialogRef = ref<{ open: () => void } | null>(null)

onMounted(() => {
  loadUserInfo()
})

// 下拉刷新：重新拉取用户信息，失败时保留已展示的数据
const onRefresh = async () => {
  const success = await loadUserInfo()
  if (!success) {
    showToast('刷新失败，请稍后重试')
  }
  refreshing.value = false
}

// 打开创建员工弹窗
const openCreateEmployee = () => {
  employeeFormDialogRef.value?.open()
}

// 从员工列表添加员工
const handleAddEmployee = () => {
  showEmployeeList.value = false
  employeeFormDialogRef.value?.open()
}

// 从员工列表编辑员工
const handleEditEmployee = (emp: Employee) => {
  showEmployeeList.value = false
  employeeFormDialogRef.value?.open(emp)
}

// 修改密码
const handleChangePassword = () => {
  passwordDialogRef.value?.open()
}

// 关于我们
const handleAbout = () => {
  showDialog({
    title: '关于我们',
    message: '产品展示系统 v1.0.0\n\n产品展示与管理平台。我们致力于为用户提供优质的产品展示服务。',
    confirmButtonText: '确定'
  })
}

// 联系客服
const handleContactService = () => {
  showDialog({
    title: '联系客服',
    message: '客服微信：jlyc415\n工作时间：周一至周五 9:00-18:00',
    confirmButtonText: '知道了'
  })
}

// 退出登录弹窗
const logoutDialogVisible = ref(false)

// 执行退出登录
const doLogout = async () => {
  try {
    // 调用后端登出接口（销毁 session、吊销 refresh token）
    await post('/users/logout')
  } catch (e) {
    // 即使后端调用失败，也继续清除本地数据
    logger.warn('后端登出失败:', e)
  } finally {
    // 统一清除所有角色的本地认证信息（含 user/employee 的 token、refresh token、login_type）
    clearAuthStorage()
    showToast('已退出登录')
    router.replace('/login')
  }
}
</script>

<style scoped lang="scss">
.profile-page {
  min-height: 100%;
  background-color: var(--paper);
  padding-bottom: calc(20px + env(safe-area-inset-bottom));
}

// 功能列表
.profile-page :deep(.func-group) {
  margin: 10px 14px 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--surface);

  .van-cell__left-icon {
    color: var(--brand);
    font-size: 19px;
    margin-right: 8px;
  }

  .van-cell {
    font-size: 13px;
    font-weight: 500;
  }
}

// 退出登录
.logout-wrap {
  margin: 20px 14px 0;

  :deep(.van-button) {
    height: 44px;
    font-size: 13px;
    border-color: var(--line);
    color: var(--danger);
    background: transparent;
  }
}
</style>
