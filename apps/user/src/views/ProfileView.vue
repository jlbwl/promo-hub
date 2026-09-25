<template>
  <div class="profile-page">
    <!-- 用户信息区域 -->
    <UserHeader :user-info="userInfo" />

    <!-- 数据统计 -->
    <StatsCard
      :stats="stats"
      :employee-count="employeeCount"
      @go="goTo"
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
      <van-cell
        title="累计佣金"
        icon="gold-coin"
        is-link
        :value="stats.totalCommission"
        @click="goTo('/commissions')"
      />
      <van-cell
        title="兑换记录"
        icon="gift-o"
        is-link
        @click="goTo('/commissions')"
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

    <!-- 退出登录确认弹窗 -->
    <van-dialog
      v-model:show="logoutDialogVisible"
      title="提示"
      message="确定要退出登录吗？"
      show-cancel-button
      confirm-button-text="确定退出"
      cancel-button-text="取消"
      confirm-button-color="#ee0a24"
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
  </div>
</template>

<script setup lang="ts">
import { logger } from '@promo/shared/utils/logger'
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showDialog, showToast } from 'vant'
import { post } from '@promo/shared/utils/request'
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

// 统计数据
const stats = reactive({
  totalCommission: '¥0.00',
  promotionCount: '0',
  withdrawCount: '0'
})

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

// 页面跳转
const goTo = (path: string) => {
  router.push(path)
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
    // 调用后端登出接口
    await post('/users/logout')
  } catch (e) {
    // 即使后端调用失败，也继续清除本地数据
    logger.warn('后端登出失败:', e)
  } finally {
    // 清除本地存储的认证信息
    localStorage.removeItem('user_token')
    localStorage.removeItem('user_info')
    localStorage.removeItem('refresh_token')
    showToast('已退出登录')
    router.replace('/login')
  }
}
</script>

<style scoped lang="scss">
.profile-page {
  min-height: 100%;
  background-color: #f7f8fa;
  padding-bottom: 20px;
}

// 功能列表
.func-group {
  margin-top: 12px;
  border-radius: 12px;
  overflow: hidden;

  :deep(.van-cell__left-icon) {
    color: #1989fa;
    font-size: 20px;
    margin-right: 8px;
  }
}

// 退出登录
.logout-wrap {
  margin: 24px 16px 0;
}
</style>
