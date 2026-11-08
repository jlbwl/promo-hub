<template>
  <div class="employee-profile-page">
    <!-- 用户信息区域 -->
    <div class="user-header">
      <div class="user-info">
        <UserAvatar
          :src="employeeInfo.avatar"
          :name="employeeInfo.nickname"
        />
        <div class="user-detail">
          <h3 class="user-name">
            {{ employeeInfo.nickname }}
          </h3>
          <p class="user-id">
            员工ID: {{ employeeInfo.id }}
          </p>
        </div>
      </div>
    </div>

    <!-- 隶属主账户信息 -->
    <van-cell-group
      inset
      class="main-account-card"
    >
      <van-cell
        title="隶属主账户"
        :value="userInfo.nickname || userInfo.phone"
      />
      <van-cell
        title="主账户手机号"
        :value="maskPhone(userInfo.phone)"
      />
    </van-cell-group>

    <!-- 有效期信息 -->
    <van-cell-group
      inset
      class="expire-card"
    >
      <van-cell
        title="登录有效期"
        :value="formatExpireTime"
      />
      <van-cell
        title="账户状态"
        :value="isExpired ? '已过期' : '正常'"
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
import { showToast } from 'vant'
import { formatTime, maskPhone } from '@promo/shared/utils/helpers'
import { clearAuthStorage, post } from '@promo/shared/utils/request'
import UserAvatar from '@/components/UserAvatar.vue'

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

// 格式化过期时间（shared 统一北京时区实现）
const formatExpireTime = computed(() => formatTime(employeeInfo.expiresAt, '--'))

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

// 执行退出登录
const doLogout = async () => {
  try {
    // 调用后端登出：销毁 session、吊销 refresh token（员工也走 /users/logout）
    await post('/users/logout')
  } catch (e) {
    // 后端失败也继续清理本地
  } finally {
    // 统一清理用户端全部登录态（含 employee_token/refresh_token）
    clearAuthStorage()
    showToast('已退出登录')
    router.replace('/login')
  }
}
</script>

<style scoped lang="scss">
.employee-profile-page {
  min-height: 100%;
  background-color: var(--paper);
  padding-bottom: calc(20px + env(safe-area-inset-bottom));
}

// 用户信息头部
.user-header {
  position: relative;
  overflow: hidden;
  padding: 34px 18px 40px;
  background: var(--mast);
  color: var(--on-dark);

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      96deg,
      rgba(255, 235, 205, 0.045) 0 1px,
      transparent 1px 7px
    );
  }
}

.user-info {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 14px;
}

.user-detail {
  min-width: 0;

  .user-name {
    font-size: 18px;
    font-weight: 650;
    color: var(--on-dark);
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-id {
    font-size: 10.5px;
    letter-spacing: 0.04em;
    color: var(--on-dark-muted);
  }
}

// 主账户信息卡片
.main-account-card,
.expire-card {
  margin: 10px 14px 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--surface);
}

.main-account-card {
  margin-top: -26px;
  position: relative;
  z-index: 2;
  box-shadow: 0 10px 26px -20px rgba(31, 24, 17, 0.5);

  :deep(.van-cell__left-icon) {
    color: var(--brand);
    font-size: 19px;
    margin-right: 8px;
  }
}

.expire-card {
  margin-top: 10px;
}

.employee-profile-page :deep(.van-cell) {
  font-size: 13px;
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