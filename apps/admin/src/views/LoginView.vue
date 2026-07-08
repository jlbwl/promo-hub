<template>
  <div class="login-container">
    <el-card
      class="login-card"
      shadow="always"
    >
      <template #header>
        <div class="login-header">
          <h2>管理后台登录</h2>
        </div>
      </template>

      <el-tabs
        v-model="loginTab"
        class="login-tabs"
      >
        <!-- 密码登录 -->
        <el-tab-pane
          label="密码登录"
          name="password"
        >
          <el-form
            ref="pwdFormRef"
            :model="pwdForm"
            :rules="pwdRules"
            label-width="0"
            size="large"
          >
            <el-form-item prop="phone">
              <el-input
                v-model="pwdForm.phone"
                placeholder="请输入手机号"
                prefix-icon="Phone"
                clearable
              />
            </el-form-item>
            <el-form-item prop="password">
              <el-input
                v-model="pwdForm.password"
                type="password"
                placeholder="请输入密码"
                prefix-icon="Lock"
                show-password
                @keyup.enter="handlePasswordLogin"
              />
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
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
        <el-tab-pane
          label="短信登录"
          name="sms"
        >
          <el-form
            ref="smsFormRef"
            :model="smsForm"
            :rules="smsRules"
            label-width="0"
            size="large"
          >
            <el-form-item prop="phone">
              <el-input
                v-model="smsForm.phone"
                placeholder="请输入手机号"
                prefix-icon="Phone"
                clearable
                maxlength="11"
              />
            </el-form-item>
            <el-form-item prop="code">
              <el-input
                v-model="smsForm.code"
                placeholder="请输入验证码"
                prefix-icon="Lock"
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
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { post } from '@promo/shared/utils/request'

const router = useRouter()
const route = useRoute()

const loginTab = ref('password')
const loading = ref(false)

const pwdFormRef = ref<FormInstance>()
const pwdForm = reactive({ phone: '', password: '' })
const pwdRules: FormRules = {
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ]
}

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

  await pwdFormRef.value.validate(async (valid) => {
    if (!valid) return

    loading.value = true
    try {
      const res = await post<any>('/admin/login', {
        phone: pwdForm.phone,
        password: pwdForm.password,
      })

      if (res.data && res.data.token) {
        localStorage.setItem('token', res.data.token)
        localStorage.setItem('admin_token', res.data.token)
        localStorage.setItem('admin_info', JSON.stringify(res.data.admin))
        ElMessage.success('登录成功')
        const redirect = (route.query.redirect as string) || '/dashboard'
        router.push(redirect)
      }
    } catch (error: any) {
      ElMessage.error(error.message || '登录失败，请重试')
    } finally {
      loading.value = false
    }
  })
}

const handleSendSms = async () => {
  if (!smsForm.phone) return ElMessage.warning('请输入手机号')
  if (!/^1[3-9]\d{9}$/.test(smsForm.phone)) return ElMessage.warning('请输入正确的手机号')

  try {
    await post('/admin/sms/send', { phone: smsForm.phone })
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

  await smsFormRef.value.validate(async (valid) => {
    if (!valid) return

    loading.value = true
    try {
      const res = await post<any>('/admin/sms/login', {
        phone: smsForm.phone,
        code: smsForm.code,
      })

      if (res.data && res.data.token) {
        localStorage.setItem('token', res.data.token)
        localStorage.setItem('admin_token', res.data.token)
        localStorage.setItem('admin_info', JSON.stringify(res.data.admin))
        ElMessage.success('登录成功')
        const redirect = (route.query.redirect as string) || '/dashboard'
        router.push(redirect)
      }
    } catch (error: any) {
      ElMessage.error(error.message || '登录失败')
    } finally {
      loading.value = false
    }
  })
}
</script>

<style lang="scss" scoped>
.login-container {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;

  .login-card {
    width: 100%;
    max-width: 420px;
    border-radius: 8px;

    .login-header {
      text-align: center;

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

@media (max-width: 768px) {
  .login-container {
    padding: 15px;
  }

  .login-card {
    .login-header {
      h2 {
        font-size: 20px;
      }
    }
  }

  .login-tabs {
    :deep(.el-tabs__item) {
      font-size: 13px;
    }
  }
}
</style>
