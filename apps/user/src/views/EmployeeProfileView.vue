<template>
  <div class="employee-profile-page">
    <!-- 用户信息区域 -->
    <div class="user-header">
      <div class="user-info">
        <van-image
          round
          width="64"
          height="64"
          :src="employeeInfo.avatar"
          fit="cover"
        >
          <template #error>
            <div class="avatar-placeholder">
              <van-icon name="user-o" size="32" color="#fff" />
            </div>
          </template>
        </van-image>
        <div class="user-detail">
          <h3 class="user-name">{{ employeeInfo.nickname }}</h3>
          <p class="user-id">员工ID: {{ employeeInfo.id }}</p>
        </div>
      </div>
    </div>

    <!-- 隶属主账户信息 -->
    <van-cell-group inset class="main-account-card">
      <van-cell title="隶属主账户" :value="userInfo.nickname || userInfo.phone" />
      <van-cell title="主账户手机号" :value="maskPhone(userInfo.phone)" />
    </van-cell-group>

    <!-- 有效期信息 -->
    <van-cell-group inset class="expire-card">
      <van-cell title="登录有效期" :value="formatExpireTime" />
      <van-cell title="账户状态" :value="isExpired ? '已过期' : '正常'" />
    </van-cell-group>

    <!-- 功能列表 -->
    <van-cell-group inset class="func-group">
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
        @click="doLogout"
      >
        退出登录
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showDialog, showToast } from 'vant'

const router = useRouter()

// 员工信息
const employeeInfo = reactive({
  id: '',
  nickname: '加载中...',
  avatar: '',
  phone: '',
  expiresAt: '',
  userId: ''
})

// 主账户信息
const userInfo = reactive({
  id: '',
  nickname: '',
  phone: ''
})

// 检查是否过期
const isExpired = computed(() => {
  if (!employeeInfo.expiresAt) return true
  const now = new Date()
  const expiresAt = new Date(employeeInfo.expiresAt)
  return expiresAt < now
})

// 格式化过期时间
const formatExpireTime = computed(() => {
  if (!employeeInfo.expiresAt) return '--'
  const date = new Date(employeeInfo.expiresAt)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
})

// 手机号脱敏
const maskPhone = (phone: string) => {
  if (!phone) return '--'
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

// 加载员工信息
onMounted(() => {
  try {
    const info = JSON.parse(localStorage.getItem('employee_info') || '{}')
    employeeInfo.id = info.id || ''
    employeeInfo.nickname = info.nickname || info.phone || '员工'
    employeeInfo.avatar = info.avatar || ''
    employeeInfo.phone = info.phone || ''
    employeeInfo.expiresAt = info.expiresAt || ''
    employeeInfo.userId = info.userId || ''

    const user = JSON.parse(localStorage.getItem('user_info') || '{}')
    userInfo.id = user.id || ''
    userInfo.nickname = user.nickname || ''
    userInfo.phone = user.phone || ''
  } catch {
    employeeInfo.nickname = '员工'
  }
})

// 关于我们
const handleAbout = () => {
  showDialog({
    title: '关于我们',
    message: '推广联盟 v1.0.0\n\n分享好物，赚取佣金。我们致力于为用户提供优质的推广平台，让每一次分享都有价值。',
    confirmButtonText: '确定'
  })
}

// 联系客服
const handleContactService = () => {
  showDialog({
    title: '联系客服',
    message: '客服微信：service_distributor\n客服电话：400-888-8888\n工作时间：周一至周五 9:00-18:00',
    confirmButtonText: '知道了'
  })
}

// 执行退出登录
const doLogout = () => {
  localStorage.removeItem('user_token')
  localStorage.removeItem('user_info')
  localStorage.removeItem('employee_info')
  localStorage.removeItem('login_type')
  showToast('已退出登录')
  router.replace('/login')
}
</script>

<style scoped lang="scss">
.employee-profile-page {
  min-height: 100%;
  background-color: #f7f8fa;
  padding-bottom: 20px;
}

// 用户信息头部
.user-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40px 20px 30px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
}

.user-detail {
  .user-name {
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 4px;
  }

  .user-id {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.8);
  }
}

// 主账户信息卡片
.main-account-card {
  margin-top: -20px;
  position: relative;
  z-index: 1;
  border-radius: 12px;
  overflow: hidden;

  :deep(.van-cell__left-icon) {
    color: #667eea;
    font-size: 20px;
    margin-right: 8px;
  }
}

// 有效期卡片
.expire-card {
  margin-top: 12px;
  border-radius: 12px;
  overflow: hidden;
}

// 功能列表
.func-group {
  margin-top: 12px;
  border-radius: 12px;
  overflow: hidden;

  :deep(.van-cell__left-icon) {
    color: #667eea;
    font-size: 20px;
    margin-right: 8px;
  }
}

// 退出登录
.logout-wrap {
  margin: 24px 16px 0;
}
</style>