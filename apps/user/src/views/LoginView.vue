<template>
  <div class="login-page">
    <!-- 顶部品牌区域 -->
    <div class="login-header">
      <div class="logo">
        <van-icon name="shop-o" size="64" color="#1989fa" />
      </div>
      <h2 class="app-name">推广联盟</h2>
      <p class="app-desc">分享好物，赚取佣金</p>
    </div>

    <!-- 登录方式 Tabs -->
    <div class="login-form">
      <van-tabs v-model:active="loginTab" animated shrink>
        <!-- Tab 1: 密码登录 -->
        <van-tab title="密码登录" name="password">
          <van-cell-group inset style="margin-top: 16px;">
            <van-field v-model="pwdForm.phone" type="tel" label="手机号" placeholder="请输入手机号" maxlength="11" clearable />
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
            <van-button type="primary" block round size="large" :loading="loading" loading-text="登录中..." @click="handlePasswordLogin">登录</van-button>
          </div>
          <div class="login-footer">
            <span class="link-text" @click="goRegister">没有账号？去注册</span>
          </div>
        </van-tab>

        <!-- Tab 2: 短信验证码登录 -->
        <van-tab title="短信登录" name="sms">
          <van-cell-group inset style="margin-top: 16px;">
            <van-field v-model="smsForm.phone" type="tel" label="手机号" placeholder="请输入手机号" maxlength="11" clearable />
            <van-field v-model="smsForm.code" type="digit" label="验证码" placeholder="请输入验证码" maxlength="6" clearable>
              <template #button>
                <van-button
                  size="small"
                  type="primary"
                  :disabled="smsCooldown > 0"
                  :text="smsCooldown > 0 ? `${smsCooldown}s` : '获取验证码'"
                  @click="handleSendSms"
                  style="min-width: 90px;"
                />
              </template>
            </van-field>
          </van-cell-group>
          <div class="login-btn-wrap">
            <van-button type="primary" block round size="large" :loading="loading" loading-text="登录中..." @click="handleSmsLogin">登录 / 注册</van-button>
          </div>
          <div class="sms-tip">未注册的手机号将自动创建账号</div>
        </van-tab>
      </van-tabs>

      <!-- 访客登录 -->
      <div class="guest-btn-wrap">
        <van-button block round size="large" color="rgba(255,255,255,0.25)" text-color="#ffffff" @click="handleGuestLogin">
          访客登录
        </van-button>
      </div>

      <!-- 员工登录入口 -->
      <div class="employee-login-wrap">
        <span class="employee-link" @click="goEmployeeLogin">员工入口</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast } from 'vant'
import { post } from '@promo/shared/utils/request'

const router = useRouter()
const route = useRoute()

const loginTab = ref('password')
const loading = ref(false)
const showPassword = ref(false)

// 密码登录
const pwdForm = reactive({ phone: '', password: '' })

// 短信登录
const smsForm = reactive({ phone: '', code: '' })
const smsCooldown = ref(0)
let smsTimer: ReturnType<typeof setInterval> | null = null

onUnmounted(() => {
  if (smsTimer) clearInterval(smsTimer)
})

// 通用登录成功处理
const onLoginSuccess = (data: any) => {
  localStorage.setItem('user_token', data.token)
  localStorage.setItem('user_info', JSON.stringify(data.user))
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
    const res = await post<any>('/users/login', { phone: pwdForm.phone, password: pwdForm.password })
    if (res.data?.token) onLoginSuccess(res.data)
  } catch (e: any) {
    showToast(e.message || '登录失败')
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
  } catch (e: any) {
    showToast(e.message || '发送失败')
  }
}

// 短信验证码登录
const handleSmsLogin = async () => {
  if (!smsForm.phone) return showToast('请输入手机号')
  if (!smsForm.code) return showToast('请输入验证码')

  loading.value = true
  try {
    const res = await post<any>('/users/sms/login', { phone: smsForm.phone, code: smsForm.code })
    if (res.data?.token) onLoginSuccess(res.data)
  } catch (e: any) {
    showToast(e.message || '登录失败')
  } finally {
    loading.value = false
  }
}

// 访客登录
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
  background: linear-gradient(135deg, #1989fa 0%, #4fc3f7 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 20px;
}

.login-header {
  padding-top: 60px;
  text-align: center;
  margin-bottom: 24px;

  .logo { margin-bottom: 12px; }
  .app-name { font-size: 22px; font-weight: 600; color: #ffffff; margin-bottom: 6px; }
  .app-desc { font-size: 13px; color: rgba(255, 255, 255, 0.8); }
}

.login-form {
  width: 100%;
  max-width: 400px;

  :deep(.van-tabs__nav) {
    background: transparent;
  }

  :deep(.van-tab) {
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
  }

  :deep(.van-tab--active) {
    color: #ffffff;
    font-weight: 600;
  }

  :deep(.van-tabs__line) {
    background: #ffffff;
  }

  :deep(.van-cell-group--inset) {
    border-radius: 12px;
    overflow: hidden;
    margin: 0;
  }
}

.login-btn-wrap { margin-top: 24px; padding: 0 16px; }
.guest-btn-wrap { margin-top: 12px; padding: 0 16px; }

.login-footer {
  display: flex;
  justify-content: center;
  padding: 12px 16px 0;

  .link-text {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    &:active { opacity: 0.7; }
  }
}

.sms-tip {
  text-align: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 8px;
}

.employee-login-wrap {
  text-align: center;
  margin-top: 24px;

  .employee-link {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    &:active { opacity: 0.7; }
  }
}
</style>
