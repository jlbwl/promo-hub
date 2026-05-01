<template>
  <div class="profile-page">
    <!-- 用户信息区域 -->
    <div class="user-header">
      <div class="user-info">
        <van-image
          round
          width="64"
          height="64"
          :src="userInfo.avatar"
          fit="cover"
        >
          <template #error>
            <div class="avatar-placeholder">
              <van-icon name="user-o" size="32" color="#fff" />
            </div>
          </template>
        </van-image>
        <div class="user-detail">
          <h3 class="user-name">{{ userInfo.nickname }}</h3>
          <p class="user-id">ID: {{ userInfo.id }}</p>
        </div>
      </div>
    </div>

    <!-- 数据统计 -->
    <div class="stats-card">
      <div class="stat-item" @click="goTo('/commissions')">
        <span class="stat-value">{{ stats.totalCommission }}</span>
        <span class="stat-label">累计佣金</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-value">{{ stats.promotionCount }}</span>
        <span class="stat-label">我的推广</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item" @click="goTo('/commissions')">
        <span class="stat-value">{{ stats.withdrawCount }}</span>
        <span class="stat-label">提现记录</span>
      </div>
    </div>

    <!-- 功能列表 -->
    <van-cell-group inset class="func-group">
      <van-cell
        title="我的推广"
        icon="chart-trending-o"
        is-link
        @click="goTo('/commissions')"
      />
      <van-cell
        title="累计佣金"
        icon="balance-o"
        is-link
        :value="stats.totalCommission"
        @click="goTo('/commissions')"
      />
      <van-cell
        title="提现记录"
        icon="cash-back-record"
        is-link
        @click="goTo('/commissions')"
      />
    </van-cell-group>

    <van-cell-group inset class="func-group">
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
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showDialog, showToast } from 'vant'

// 路由实例
const router = useRouter()

// 退出登录弹窗
const logoutDialogVisible = ref(false)

// 用户信息（从 localStorage 读取真实数据）
const userInfo = reactive({
  id: '',
  nickname: '加载中...',
  avatar: ''
})

// 统计数据
const stats = reactive({
  totalCommission: '¥0.00',
  promotionCount: '0',
  withdrawCount: '0'
})

// 加载用户信息
onMounted(() => {
  try {
    const info = JSON.parse(localStorage.getItem('user_info') || '{}')
    userInfo.id = info.id || ''
    userInfo.nickname = info.nickname || info.phone || '用户'
    userInfo.avatar = info.avatar || ''
  } catch {
    userInfo.nickname = '用户'
  }
})

// 页面跳转
const goTo = (path: string) => {
  router.push(path)
}

// 修改密码
const handleChangePassword = () => {
  showDialog({
    title: '修改密码',
    message: '请联系客服或通过短信验证修改密码',
    confirmButtonText: '知道了'
  })
}

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
  showToast('已退出登录')
  router.replace('/login')
}
</script>

<style scoped lang="scss">
.profile-page {
  min-height: 100%;
  background-color: #f7f8fa;
  padding-bottom: 20px;
}

// 用户信息头部
.user-header {
  background: linear-gradient(135deg, #1989fa 0%, #4fc3f7 100%);
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

// 数据统计卡片
.stats-card {
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin: -20px 16px 12px;
  padding: 20px;
  background-color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  position: relative;
  z-index: 1;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;

  &:active {
    opacity: 0.7;
  }
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #323233;
}

.stat-label {
  font-size: 12px;
  color: #969799;
}

.stat-divider {
  width: 1px;
  height: 30px;
  background-color: #eee;
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
