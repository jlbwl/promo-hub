<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-header">
        <h2>渠道经理后台</h2>
        <p>渠道经理管理系统</p>
      </div>

      <el-tabs v-model="loginTab" class="login-tabs">
        <!-- 密码登录 -->
        <el-tab-pane label="密码登录" name="password">
          <el-form
            ref="pwdFormRef"
            :model="pwdForm"
            :rules="pwdRules"
            class="login-form"
            @keyup.enter="handlePasswordLogin"
          >
            <el-form-item prop="phone">
              <el-input
                v-model="pwdForm.phone"
                placeholder="请输入手机号"
                prefix-icon="Phone"
                size="large"
                maxlength="11"
              />
            </el-form-item>
            <el-form-item prop="password">
              <el-input
                v-model="pwdForm.password"
                type="password"
                placeholder="请输入密码"
                prefix-icon="Lock"
                size="large"
                show-password
              />
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
                size="large"
                :loading="loading"
                class="login-btn"
                @click="handlePasswordLogin"
              >
                {{ loading ? '登录中...' : '登 录' }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 短信登录 -->
        <el-tab-pane label="短信登录" name="sms">
          <el-form
            ref="smsFormRef"
            :model="smsForm"
            :rules="smsRules"
            class="login-form"
            @keyup.enter="handleSmsLogin"
          >
            <el-form-item prop="phone">
              <el-input
                v-model="smsForm.phone"
                placeholder="请输入手机号"
                prefix-icon="Phone"
                size="large"
                maxlength="11"
              />
            </el-form-item>
            <el-form-item prop="code">
              <el-input
                v-model="smsForm.code"
                placeholder="请输入验证码"
                prefix-icon="Lock"
                size="large"
                maxlength="6"
              >
                <template #append>
                  <el-button
                    :disabled="smsCooldown > 0"
                    @click="handleSendSms"
                  >
                    {{ smsCooldown > 0 ? `${smsCooldown}s` : '获取验证码' }}
                  </el-button>
                </template>
              </el-input>
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
                size="large"
                :loading="loading"
                class="login-btn"
                @click="handleSmsLogin"
              >
                {{ loading ? '登录中...' : '登 录' }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { post } from '@promo/shared/utils/request'

const router = useRouter()
const route = useRoute()

if (route.query.expired === '1') {
  ElMessage.warning('账号已被删除或禁用，请重新登录')
}

const loginTab = ref('password')
const loading = ref(false)

// 密码登录
const pwdFormRef = ref<FormInstance>()
const pwdForm = reactive({ phone: '', password: '' })
const pwdRules: FormRules = {
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度在 6 到 20 个字符', trigger: 'blur' }
  ]
}

// 短信登录
const smsFormRef = ref<FormInstance>()
const smsForm = reactive({ phone: '', code: '' })
const smsRules: FormRules = {
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ],
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { len: 6, message: '验证码为6位数字', trigger: 'blur' }
  ]
}

const smsCooldown = ref(0)
let smsTimer: ReturnType<typeof setInterval> | null = null

const handlePasswordLogin = async () => {
  if (!pwdFormRef.value) return

  try {
    await pwdFormRef.value.validate()
    loading.value = true

    const res = await post<any>('/managers/login', {
      phone: pwdForm.phone,
      password: pwdForm.password,
    })

    if (res.data && res.data.token) {
      localStorage.setItem('manager_token', res.data.token)
      localStorage.setItem('manager_info', JSON.stringify(res.data.manager))
      ElMessage.success('登录成功')
      const redirect = (route.query.redirect as string) || '/dashboard'
      router.push(redirect)
    }
  } catch (error: any) {
    ElMessage.error(error.message || '登录失败，请检查手机号和密码')
  } finally {
    loading.value = false
  }
}

const handleSendSms = async () => {
  if (!smsForm.phone) return ElMessage.warning('请输入手机号')
  if (!/^1[3-9]\d{9}$/.test(smsForm.phone)) return ElMessage.warning('请输入正确的手机号')

  try {
    await post('/managers/sms/send', { phone: smsForm.phone })
    ElMessage.success('验证码已发送')
    smsCooldown.value = 60
    smsTimer = setInterval(() => {
      smsCooldown.value--
      if (smsCooldown.value <= 0 && smsTimer) {
        clearInterval(smsTimer)
        smsTimer = null
      }
    }, 1000)
  } catch (e: any) {
    ElMessage.error(e.message || '发送失败')
  }
}

const handleSmsLogin = async () => {
  if (!smsFormRef.value) return

  try {
    await smsFormRef.value.validate()
    loading.value = true

    const res = await post<any>('/managers/sms/login', {
      phone: smsForm.phone,
      code: smsForm.code,
    })

    if (res.data && res.data.token) {
      localStorage.setItem('manager_token', res.data.token)
      localStorage.setItem('manager_info', JSON.stringify(res.data.manager))
      ElMessage.success('登录成功')
      const redirect = (route.query.redirect as string) || '/dashboard'
      router.push(redirect)
    }
  } catch (error: any) {
    ElMessage.error(error.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-container {
  width: 400px;
  padding: 40px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);

  .login-header {
    text-align: center;
    margin-bottom: 30px;

    h2 {
      font-size: 24px;
      color: #303133;
      margin-bottom: 8px;
    }

    p {
      font-size: 14px;
      color: #909399;
    }
  }

  .login-form {
    .login-btn {
      width: 100%;
    }
  }

  .login-tabs {
    :deep(.el-tabs__header) {
      margin-bottom: 20px;
    }
    :deep(.el-tabs__nav) {
      width: 100%;
    }
    :deep(.el-tabs__item) {
      width: 50%;
      text-align: center;
      font-size: 15px;
    }
  }
}
</style>
