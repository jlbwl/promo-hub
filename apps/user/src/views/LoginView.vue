<template>
  <div class="login-page">
    <!-- 顶部品牌区域 -->
    <div class="login-header">
      <div class="logo">
        <van-icon
          name="shop-o"
          size="64"
          color="#E2C48E"
        />
      </div>
      <h2 class="app-name">
        产品展示系统
      </h2>
      <p class="app-desc">
        产品展示与管理平台
      </p>
    </div>

    <!-- 登录方式选择 -->
    <div class="login-form">
      <!-- 第一步：选择登录方式 -->
      <div
        v-if="currentStep === 'select'"
        class="login-options"
      >
        <div
          class="option-item"
          @click="selectLoginType('normal')"
        >
          <div class="option-icon">
            <van-icon
              name="user-o"
              size="32"
            />
          </div>
          <div class="option-content">
            <div class="option-title">
              普通登录
            </div>
            <div class="option-desc">
              使用手机号密码或验证码登录
            </div>
          </div>
          <van-icon name="arrow" />
        </div>

        <div
          class="option-item"
          @click="handleGuestLogin"
        >
          <div class="option-icon">
            <van-icon
              name="eye-o"
              size="32"
            />
          </div>
          <div class="option-content">
            <div class="option-title">
              访客模式
            </div>
            <div class="option-desc">
              无需注册，快速浏览产品
            </div>
          </div>
          <van-icon name="arrow" />
        </div>

        <div
          class="option-item"
          @click="goEmployeeLogin"
        >
          <div class="option-icon">
            <van-icon
              name="friends-o"
              size="32"
            />
          </div>
          <div class="option-content">
            <div class="option-title">
              员工专属登录
            </div>
            <div class="option-desc">
              企业员工专属登录入口
            </div>
          </div>
          <van-icon name="arrow" />
        </div>
      </div>

      <!-- 第二步：普通登录表单 -->
      <div
        v-else
        class="normal-login-form"
      >
        <div
          class="back-btn"
          @click="backToSelect"
        >
          <van-icon name="arrow-left" /> 返回
        </div>

        <van-tabs
          v-model:active="loginTab"
          animated
          shrink
        >
          <!-- Tab 1: 密码登录 -->
          <van-tab
            title="密码登录"
            name="password"
          >
            <van-cell-group
              inset
              style="margin-top: 16px;"
            >
              <van-field
                v-model="pwdForm.phone"
                type="tel"
                label="手机号"
                placeholder="请输入手机号"
                maxlength="11"
                clearable
              />
              <van-field
                v-model="pwdForm.password"
                :type="showPassword ? 'text' : 'password'"
                label="密码"
                placeholder="请输入密码"
                clearable
                :right-icon="showPassword ? 'eye-o' : 'closed-eye'"
                @click-right-icon="showPassword = !showPassword"
              />
            </van-cell-group>
            <div class="login-btn-wrap">
              <van-button
                type="primary"
                block
                round
                size="large"
                :loading="loading"
                loading-text="登录中..."
                @click="handlePasswordLogin"
              >
                登录
              </van-button>
            </div>
            <div class="login-footer">
              <span
                class="link-text"
                @click="goRegister"
              >没有账号？去注册</span>
            </div>
          </van-tab>

          <!-- Tab 2: 短信验证码登录 -->
          <van-tab
            title="短信登录"
            name="sms"
          >
            <van-cell-group
              inset
              style="margin-top: 16px;"
            >
              <van-field
                v-model="smsForm.phone"
                type="tel"
                label="手机号"
                placeholder="请输入手机号"
                maxlength="11"
                clearable
              />
              <van-field
                v-model="smsForm.code"
                type="digit"
                label="验证码"
                placeholder="请输入验证码"
                maxlength="6"
                clearable
              >
                <template #button>
                  <van-button
                    size="small"
                    type="primary"
                    :disabled="smsCooldown > 0"
                    :text="smsCooldown > 0 ? `${smsCooldown}s` : '获取验证码'"
                    style="min-width: 90px;"
                    @click="handleSendSms"
                  />
                </template>
              </van-field>
              <van-field
                v-model="smsForm.teamName"
                label="团队名称"
                placeholder="选填，用于区分不同团队"
                clearable
              />
            </van-cell-group>
            <div class="login-btn-wrap">
              <van-button
                type="primary"
                block
                round
                size="large"
                :loading="loading"
                loading-text="登录中..."
                @click="handleSmsLogin"
              >
                登录 / 注册
              </van-button>
            </div>
            <div class="sms-tip">
              未注册的手机号将自动创建账号
            </div>
          </van-tab>
        </van-tabs>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast } from 'vant'
import { post } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import type { Employee, User } from '@promo/shared/types'

const router = useRouter()
const route = useRoute()

const currentStep = ref<'select' | 'login'>('select')
const loginTab = ref('password')
const loading = ref(false)
const showPassword = ref(false)

// 选择登录方式
const selectLoginType = (type: string) => {
  if (type === 'normal') {
    currentStep.value = 'login'
  }
}

// 返回选择页面
const backToSelect = () => {
  currentStep.value = 'select'
}

// 密码登录
const pwdForm = reactive({ phone: '', password: '' })

// 短信登录
const smsForm = reactive({ phone: '', code: '', teamName: '' })
const smsCooldown = ref(0)
let smsTimer: ReturnType<typeof setInterval> | null = null

onUnmounted(() => {
  if (smsTimer) clearInterval(smsTimer)
})

/**
 * 用户登录接口返回数据
 */
interface UserLoginResult {
  token: string
  refreshToken?: string
  user: User
}

/**
 * 员工登录接口返回数据
 */
interface EmployeeLoginResult {
  token: string
  refreshToken?: string
  user: User
  employee: Employee
}

// 通用登录成功处理
const onLoginSuccess = (data: UserLoginResult) => {
  // 普通登录与员工登录互斥：清除员工态，避免请求层继续携带旧员工 token
  localStorage.removeItem('employee_token')
  localStorage.removeItem('employee_refresh_token')
  localStorage.removeItem('employee_info')
  localStorage.removeItem('login_type')
  localStorage.setItem('user_token', data.token)
  localStorage.setItem('user_info', JSON.stringify(data.user))
  if (data.refreshToken) {
    localStorage.setItem('user_refresh_token', data.refreshToken)
  }
  showToast('登录成功')
  const redirect = (route.query.redirect as string) || '/home'
  router.replace(redirect)
}

// 密码登录
const handlePasswordLogin = async () => {
  if (!pwdForm.phone) return showToast('请输入手机号')
  if (!/^1[3-9]\d{9}$/.test(pwdForm.phone)) return showToast('手机号格式不正确')
  if (!pwdForm.password) return showToast('请输入密码')

  loading.value = true
  try {
    const res = await post<UserLoginResult>('/users/login', { phone: pwdForm.phone, password: pwdForm.password })
    onLoginSuccess(res.data)
  } catch (e) {
    // 普通登录失败，尝试员工登录
    try {
      const employeeRes = await post<EmployeeLoginResult>('/employees/login', { phone: pwdForm.phone, password: pwdForm.password })

      // 员工登录与普通登录互斥：清除普通用户 token，使用 employee_token 承载员工身份
      // （request 层 user 作用域优先读 employee_token）
      localStorage.removeItem('user_token')
      localStorage.removeItem('user_refresh_token')
      localStorage.setItem('employee_info', JSON.stringify(employeeRes.data.employee))
      localStorage.setItem('user_info', JSON.stringify(employeeRes.data.user))
      localStorage.setItem('employee_token', employeeRes.data.token)
      localStorage.setItem('login_type', 'employee')
      if (employeeRes.data.refreshToken) {
        localStorage.setItem('employee_refresh_token', employeeRes.data.refreshToken)
      }

      showToast('员工登录成功')
      setTimeout(() => {
        router.replace('/home')
      }, 1000)
    } catch (ee) {
      showToast(getErrorMessage(e, '登录失败，请确认登录方式'))
    }
  } finally {
    loading.value = false
  }
}

// 去注册 - 改为跳转短信登录
const goRegister = () => {
  loginTab.value = 'sms'
}

// 发送短信验证码
const handleSendSms = async () => {
  if (!smsForm.phone) return showToast('请输入手机号')
  if (!/^1[3-9]\d{9}$/.test(smsForm.phone)) return showToast('手机号格式不正确')

  try {
    await post('/users/sms/send', { phone: smsForm.phone })
    showToast('验证码已发送')
    smsCooldown.value = 60
    smsTimer = setInterval(() => {
      smsCooldown.value--
      if (smsCooldown.value <= 0 && smsTimer) { clearInterval(smsTimer); smsTimer = null }
    }, 1000)
  } catch (e) {
    showToast(getErrorMessage(e, '发送失败'))
  }
}

// 短信验证码登录
const handleSmsLogin = async () => {
  if (!smsForm.phone) return showToast('请输入手机号')
  if (!smsForm.code) return showToast('请输入验证码')

  loading.value = true
  try {
    const res = await post<UserLoginResult>('/users/sms/login', { phone: smsForm.phone, code: smsForm.code, teamName: smsForm.teamName })
    onLoginSuccess(res.data)
  } catch (e) {
    showToast(getErrorMessage(e, '登录失败'))
  } finally {
    loading.value = false
  }
}

// 访客模式
const handleGuestLogin = () => {
  showToast('已进入访客模式')
  router.replace('/home')
}

// 员工登录入口
const goEmployeeLogin = () => {
  router.replace('/employee/login')
}
</script>

<style scoped lang="scss">
.login-page {
  min-height: 100vh;
  background:
    radial-gradient(900px 480px at 18% -10%, #3e2a19 0%, rgba(62, 42, 25, 0) 62%),
    linear-gradient(168deg, #120d09 0%, #1d140d 52%, #0e0a07 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 20px calc(24px + env(safe-area-inset-bottom));
}

.login-header {
  padding-top: 60px;
  text-align: center;
  margin-bottom: 24px;

  .logo { margin-bottom: 12px; }
  .app-name {
    font-size: 22px;
    font-weight: 650;
    letter-spacing: 0.02em;
    color: var(--on-dark);
    margin-bottom: 6px;
  }
  .app-desc {
    font-size: 12px;
    color: rgba(247, 235, 216, 0.6);
  }
}

.login-form {
  width: 100%;
  max-width: 400px;

  :deep(.van-tabs__nav) {
    background: transparent;
  }

  :deep(.van-tab) {
    color: rgba(247, 235, 216, 0.65);
    font-size: 14px;
  }

  :deep(.van-tab--active) {
    color: var(--tabbar-active);
    font-weight: 650;
  }

  :deep(.van-tabs__line) {
    background: var(--gold);
  }

  :deep(.van-cell-group--inset) {
    border-radius: 12px;
    overflow: hidden;
    margin: 0;
  }
}

/* 登录选项样式 */
.login-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 8px;
}

.option-item {
  display: flex;
  align-items: center;
  background: rgba(255, 248, 236, 0.06);
  border: 1px solid rgba(216, 176, 122, 0.18);
  border-radius: 16px;
  padding: 20px 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);

  &:active {
    background: rgba(255, 248, 236, 0.12);
    transform: scale(0.98);
  }

  :deep(.van-icon) {
    color: var(--on-dark-muted);
  }
}

.option-icon {
  width: 56px;
  height: 56px;
  background: rgba(216, 176, 122, 0.18);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--tabbar-active);
  margin-right: 16px;
  flex-shrink: 0;

  :deep(.van-icon) {
    color: var(--tabbar-active);
  }
}

.option-content {
  flex: 1;
}

.option-title {
  font-size: 16px;
  font-weight: 650;
  color: var(--on-dark);
  margin-bottom: 4px;
}

.option-desc {
  font-size: 12px;
  color: rgba(247, 235, 216, 0.6);
}

/* 返回按钮 */
.back-btn {
  display: flex;
  align-items: center;
  color: var(--on-dark);
  font-size: 15px;
  padding: 8px 0 16px;
  cursor: pointer;

  &:active {
    opacity: 0.7;
  }
}

/* 普通登录表单样式 */
.normal-login-form {
  :deep(.van-tabs__nav) {
    background: transparent;
  }

  :deep(.van-tab) {
    color: rgba(247, 235, 216, 0.65);
    font-size: 14px;
  }

  :deep(.van-tab--active) {
    color: var(--tabbar-active);
    font-weight: 650;
  }

  :deep(.van-tabs__line) {
    background: var(--gold);
  }
}

.login-btn-wrap { margin-top: 24px; padding: 0 16px; }

.login-footer {
  display: flex;
  justify-content: center;
  padding: 12px 16px 0;

  .link-text {
    font-size: 13px;
    color: rgba(247, 235, 216, 0.75);
    cursor: pointer;
    &:active { opacity: 0.7; }
  }
}

.sms-tip {
  text-align: center;
  font-size: 12px;
  color: rgba(247, 235, 216, 0.55);
  margin-top: 8px;
}
</style>
