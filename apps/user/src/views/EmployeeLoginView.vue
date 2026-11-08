<template>
  <div class="employee-login-page">
    <div class="login-container">
      <div class="logo-section">
        <div class="logo">
          <van-icon
            name="user-o"
            size="48"
            color="#8A5222"
          />
        </div>
        <h1 class="title">
          员工登录
        </h1>
        <p class="subtitle">
          登录员工账户，开始抢单
        </p>
      </div>

      <van-form @submit="handleSubmit">
        <van-cell-group inset>
          <van-field
            v-model="form.phone"
            type="tel"
            label="手机号"
            placeholder="请输入手机号"
            maxlength="11"
            :rules="[{ required: true, message: '请输入手机号' }, { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' }]"
          />
          <van-field
            v-model="form.password"
            type="password"
            label="密码"
            placeholder="请输入密码"
            :rules="[{ required: true, message: '请输入密码' }, { pattern: /.{6,}/, message: '密码至少6位' }]"
          />
        </van-cell-group>

        <div class="btn-area">
          <van-button
            type="primary"
            block
            native-type="submit"
            :loading="loading"
          >
            登录
          </van-button>
        </div>
      </van-form>

      <div class="tips">
        <p>登录有效期由主账户设置</p>
        <p>做单业绩将归属于主账户</p>
      </div>
    </div>

    <!-- 返回主登录入口 -->
    <div
      class="back-link"
      @click="goBack"
    >
      返回普通登录
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { post } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import type { Employee, User } from '@promo/shared/types'

/**
 * 员工登录接口返回数据
 */
interface EmployeeLoginResult {
  token: string
  refreshToken?: string
  user: User
  employee: Employee
}

const router = useRouter()

const loading = ref(false)

const form = reactive({
  phone: '',
  password: ''
})

const handleSubmit = async () => {
  loading.value = true

  try {
    const res = await post<EmployeeLoginResult>('/employees/login', {
      phone: form.phone,
      password: form.password
    })

    if (res.code === 0) {
      // 员工登录与普通登录互斥：清除普通用户 token，避免请求层优先读取旧用户态
      localStorage.removeItem('user_token')
      localStorage.removeItem('user_refresh_token')
      // 保存员工信息到 localStorage
      localStorage.setItem('employee_info', JSON.stringify(res.data.employee))
      localStorage.setItem('user_info', JSON.stringify(res.data.user))
      localStorage.setItem('employee_token', res.data.token)
      localStorage.setItem('login_type', 'employee')
      if (res.data.refreshToken) {
        localStorage.setItem('employee_refresh_token', res.data.refreshToken)
      }

      showToast('登录成功')
      setTimeout(() => {
        router.replace('/home')
      }, 1000)
    } else {
      showToast(res.message || '登录失败')
    }
  } catch (err) {
    showToast(getErrorMessage(err, '登录失败'))
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.replace('/login')
}
</script>

<style scoped lang="scss">
.employee-login-page {
  min-height: 100vh;
  background:
    radial-gradient(900px 480px at 18% -10%, #3e2a19 0%, rgba(62, 42, 25, 0) 62%),
    linear-gradient(168deg, #120d09 0%, #1d140d 52%, #0e0a07 100%);
  display: flex;
  flex-direction: column;
  padding: 60px 20px calc(40px + env(safe-area-inset-bottom));
}

.login-container {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 32px 24px;
  margin-bottom: 20px;
}

.logo-section {
  text-align: center;
  margin-bottom: 32px;
}

.logo {
  width: 88px;
  height: 88px;
  margin: 0 auto 16px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.title {
  font-size: 24px;
  font-weight: 650;
  color: var(--ink);
  margin: 0 0 8px;
}

.subtitle {
  font-size: 14px;
  color: var(--muted);
  margin: 0;
}

.btn-area {
  margin-top: 24px;

  :deep(.van-button) {
    border-radius: 8px;
    height: 48px;
    font-size: 16px;
  }
}

.tips {
  text-align: center;
  margin-top: 24px;

  p {
    font-size: 12px;
    color: #969799;
    margin: 4px 0;
  }
}

.back-link {
  text-align: center;
  color: rgba(247, 235, 216, 0.75);
  font-size: 14px;
  padding: 16px;
}
</style>