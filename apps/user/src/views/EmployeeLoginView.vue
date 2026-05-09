<template>
  <div class="employee-login-page">
    <div class="login-container">
      <div class="logo-section">
        <div class="logo">
          <van-icon name="user-o" size="48" color="#1989fa" />
        </div>
        <h1 class="title">员工登录</h1>
        <p class="subtitle">登录员工账户，开始抢单</p>
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
          <van-button type="primary" block native-type="submit" :loading="loading">
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
    <div class="back-link" @click="goBack">
      返回普通登录
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { post } from '@promo/shared/utils/request'

const router = useRouter()

const loading = ref(false)

const form = reactive({
  phone: '',
  password: ''
})

const handleSubmit = async () => {
  loading.value = true
  
  try {
    const res: any = await post('/employees/login', {
      phone: form.phone,
      password: form.password
    })
    
    if (res.code === 0) {
      // 保存员工信息到 localStorage
      localStorage.setItem('employee_info', JSON.stringify(res.data.employee))
      localStorage.setItem('user_info', JSON.stringify(res.data.user))
      localStorage.setItem('user_token', `employee_${res.data.employee.id}`)
      localStorage.setItem('login_type', 'employee')
      
      showToast('登录成功')
      setTimeout(() => {
        router.replace('/home')
      }, 1000)
    } else {
      showToast(res.message || '登录失败')
    }
  } catch (err: any) {
    showToast(err.message || '登录失败')
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
  background: linear-gradient(180deg, #1989fa 0%, #4fc3f7 100%);
  display: flex;
  flex-direction: column;
  padding: 60px 20px 40px;
}

.login-container {
  background: #fff;
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
  background: rgba(25, 137, 250, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.title {
  font-size: 24px;
  font-weight: 600;
  color: #323233;
  margin: 0 0 8px;
}

.subtitle {
  font-size: 14px;
  color: #969799;
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
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  padding: 16px;
}
</style>