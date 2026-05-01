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

        <!-- Tab 3: 支付宝扫码 -->
        <van-tab title="支付宝" name="alipay">
          <div class="qrcode-section">
            <div class="qrcode-placeholder alipay">
              <van-icon name="scan" size="48" color="#1677ff" />
              <p>支付宝扫码登录</p>
              <span class="qrcode-hint">当前为模拟模式，点击下方按钮模拟</span>
            </div>
            <van-button type="primary" block round size="large" :loading="loading" @click="handleAlipayLogin" style="margin-top: 20px;">
              模拟支付宝授权登录
            </van-button>
          </div>
        </van-tab>

        <!-- Tab 4: 微信扫码 -->
        <van-tab title="微信" name="wechat">
          <div class="qrcode-section">
            <div class="qrcode-placeholder wechat">
              <van-icon name="scan" size="48" color="#07c160" />
              <p>微信扫码登录</p>
              <span class="qrcode-hint">当前为模拟模式，点击下方按钮模拟</span>
            </div>
            <van-button type="primary" block round size="large" :loading="loading" color="#07c160" @click="handleWechatLogin" style="margin-top: 20px;">
              模拟微信授权登录
            </van-button>
          </div>
        </van-tab>
      </van-tabs>

      <!-- 访客登录 -->
      <div class="guest-btn-wrap">
        <van-button block round size="large" color="rgba(255,255,255,0.25)" text-color="#ffffff" @click="handleGuestLogin">
          访客登录
        </van-button>
      </div>
    </div>

    <!-- 绑定手机号弹窗（扫码登录后） -->
    <van-dialog
      v-model:show="bindPhoneVisible"
      title="绑定手机号"
      show-cancel-button
      :close-on-click-overlay="false"
      @confirm="handleBindPhone"
    >
      <div style="padding: 16px;">
        <p style="color: #969799; font-size: 13px; margin-bottom: 12px;">绑定手机号后，可通过手机号登录并同步数据</p>
        <van-field v-model="bindPhoneForm.phone" type="tel" label="手机号" placeholder="请输入手机号" maxlength="11" />
        <van-field v-model="bindPhoneForm.code" type="digit" label="验证码" placeholder="请输入验证码" maxlength="6">
          <template #button>
            <van-button size="small" type="primary" :disabled="bindCooldown > 0" :text="bindCooldown > 0 ? `${bindCooldown}s` : '获取验证码'" @click="handleSendBindSms" />
          </template>
        </van-field>
      </div>
    </van-dialog>
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

// 绑定手机号
const bindPhoneVisible = ref(false)
const bindPhoneForm = reactive({ phone: '', code: '' })
const bindCooldown = ref(0)
let bindTimer: ReturnType<typeof setInterval> | null = null
const pendingUser = reactive({ id: '', token: '' })

onUnmounted(() => {
  if (smsTimer) clearInterval(smsTimer)
  if (bindTimer) clearInterval(bindTimer)
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

// 去注册
const goRegister = () => {
  router.push({ name: 'Register', query: route.query })
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

// 模拟支付宝扫码登录
const handleAlipayLogin = async () => {
  loading.value = true
  try {
    const mockCode = `ali_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const res = await post<any>('/users/alipay/login', { authCode: mockCode })
    if (res.data?.token) {
      if (res.data.needBindPhone) {
        pendingUser.id = res.data.user.id
        pendingUser.token = res.data.token
        localStorage.setItem('user_token', res.data.token)
        localStorage.setItem('user_info', JSON.stringify(res.data.user))
        bindPhoneVisible.value = true
      } else {
        onLoginSuccess(res.data)
      }
    }
  } catch (e: any) {
    showToast(e.message || '登录失败')
  } finally {
    loading.value = false
  }
}

// 模拟微信扫码登录
const handleWechatLogin = async () => {
  loading.value = true
  try {
    const mockCode = `wx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const res = await post<any>('/users/wechat/login', { authCode: mockCode })
    if (res.data?.token) {
      if (res.data.needBindPhone) {
        pendingUser.id = res.data.user.id
        pendingUser.token = res.data.token
        localStorage.setItem('user_token', res.data.token)
        localStorage.setItem('user_info', JSON.stringify(res.data.user))
        bindPhoneVisible.value = true
      } else {
        onLoginSuccess(res.data)
      }
    }
  } catch (e: any) {
    showToast(e.message || '登录失败')
  } finally {
    loading.value = false
  }
}

// 发送绑定验证码
const handleSendBindSms = async () => {
  if (!bindPhoneForm.phone) return showToast('请输入手机号')
  if (!/^1[3-9]\d{9}$/.test(bindPhoneForm.phone)) return showToast('手机号格式不正确')

  try {
    await post('/users/sms/send', { phone: bindPhoneForm.phone })
    showToast('验证码已发送')
    bindCooldown.value = 60
    bindTimer = setInterval(() => {
      bindCooldown.value--
      if (bindCooldown.value <= 0 && bindTimer) { clearInterval(bindTimer); bindTimer = null }
    }, 1000)
  } catch (e: any) {
    showToast(e.message || '发送失败')
  }
}

// 绑定手机号
const handleBindPhone = async () => {
  if (!bindPhoneForm.phone || !bindPhoneForm.code) return showToast('请填写完整')

  try {
    const res = await post<any>('/users/bindPhone', {
      userId: pendingUser.id,
      phone: bindPhoneForm.phone,
      code: bindPhoneForm.code,
    })
    if (res.data?.token) {
      localStorage.setItem('user_token', res.data.token)
      localStorage.setItem('user_info', JSON.stringify(res.data.user))
    }
    bindPhoneVisible.value = false
    showToast(res.message || '绑定成功')
    const redirect = (route.query.redirect as string) || '/home'
    router.replace(redirect)
  } catch (e: any) {
    showToast(e.message || '绑定失败')
  }
}

// 访客登录
const handleGuestLogin = () => {
  showToast('已进入访客模式')
  router.replace('/home')
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

.qrcode-section {
  padding: 20px 16px;
  text-align: center;

  .qrcode-placeholder {
    width: 200px;
    height: 200px;
    margin: 0 auto;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;

    &.alipay { background: #e8f4ff; border: 2px dashed #1677ff; }
    &.wechat { background: #e8f8ee; border: 2px dashed #07c160; }

    p { font-size: 15px; font-weight: 500; color: #323233; margin: 0; }
    .qrcode-hint { font-size: 12px; color: #969799; }
  }
}
</style>
