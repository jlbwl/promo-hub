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

    <!-- 登录/注册表单 -->
    <div class="login-form">
      <van-cell-group inset>
        <!-- 手机号输入 -->
        <van-field
          v-model="form.phone"
          type="tel"
          label="手机号"
          placeholder="请输入手机号"
          maxlength="11"
          clearable
        />
        <!-- 昵称（仅注册时显示） -->
        <van-field
          v-if="isRegister"
          v-model="form.nickname"
          label="昵称"
          placeholder="请输入昵称（选填）"
          clearable
        />
        <!-- 密码输入 -->
        <van-field
          v-model="form.password"
          :type="showPassword ? 'text' : 'password'"
          label="密码"
          :placeholder="isRegister ? '请设置密码（至少6位）' : '请输入密码'"
          clearable
          :right-icon="showPassword ? 'eye-o' : 'closed-eye'"
          @click-right-icon="showPassword = !showPassword"
        />
        <!-- 确认密码（仅注册时显示） -->
        <van-field
          v-if="isRegister"
          v-model="form.confirmPassword"
          :type="showPassword ? 'text' : 'password'"
          label="确认密码"
          placeholder="请再次输入密码"
          clearable
        />
      </van-cell-group>

      <!-- 登录/注册按钮 -->
      <div class="login-btn-wrap">
        <van-button
          type="primary"
          block
          round
          size="large"
          :loading="loading"
          :loading-text="isRegister ? '注册中...' : '登录中...'"
          @click="handleSubmit"
        >
          {{ isRegister ? '注册' : '登录' }}
        </van-button>
      </div>

      <!-- 切换登录/注册 -->
      <div class="login-footer">
        <span v-if="!isRegister" class="link-text" @click="isRegister = true">
          没有账号？去注册
        </span>
        <span v-else class="link-text" @click="isRegister = false">
          已有账号？去登录
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast } from 'vant'
import { post } from '@promo/shared/utils/request'

// 路由实例
const router = useRouter()
const route = useRoute()

// 是否注册模式
const isRegister = ref(false)

// 是否显示密码
const showPassword = ref(false)

// 加载状态
const loading = ref(false)

// 表单数据
const form = reactive({
  phone: '',
  password: '',
  confirmPassword: '',
  nickname: ''
})

// 表单校验
const validate = () => {
  if (!form.phone) {
    showToast('请输入手机号')
    return false
  }
  if (!/^1[3-9]\d{9}$/.test(form.phone)) {
    showToast('手机号格式不正确')
    return false
  }
  if (!form.password) {
    showToast('请输入密码')
    return false
  }
  if (isRegister.value && form.password.length < 6) {
    showToast('密码长度不能少于6位')
    return false
  }
  if (isRegister.value && form.password !== form.confirmPassword) {
    showToast('两次密码输入不一致')
    return false
  }
  return true
}

// 提交（登录或注册）
const handleSubmit = async () => {
  if (!validate()) return

  loading.value = true

  try {
    if (isRegister.value) {
      // 注册
      const res = await post<any>('/users/register', {
        phone: form.phone,
        password: form.password,
        nickname: form.nickname || undefined,
      })
      if (res.data && res.data.token) {
        localStorage.setItem('user_token', res.data.token)
        localStorage.setItem('user_info', JSON.stringify(res.data.user))
        showToast('注册成功')
        const redirect = (route.query.redirect as string) || '/home'
        router.replace(redirect)
      }
    } else {
      // 登录
      const res = await post<any>('/users/login', {
        phone: form.phone,
        password: form.password,
      })
      if (res.data && res.data.token) {
        localStorage.setItem('user_token', res.data.token)
        localStorage.setItem('user_info', JSON.stringify(res.data.user))
        showToast('登录成功')
        const redirect = (route.query.redirect as string) || '/home'
        router.replace(redirect)
      }
    }
  } catch (error: any) {
    showToast(error.message || (isRegister.value ? '注册失败' : '登录失败'))
  } finally {
    loading.value = false
  }
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
  padding-top: 80px;
  text-align: center;
  margin-bottom: 40px;

  .logo {
    margin-bottom: 16px;
  }

  .app-name {
    font-size: 24px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 8px;
  }

  .app-desc {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.8);
  }
}

.login-form {
  width: 100%;
  max-width: 400px;

  :deep(.van-cell-group--inset) {
    border-radius: 12px;
    overflow: hidden;
    margin: 0;
  }

  :deep(.van-field__label) {
    width: 72px;
  }
}

.login-btn-wrap {
  margin-top: 32px;
  padding: 0 16px;
}

.login-footer {
  display: flex;
  justify-content: center;
  padding: 16px 16px 0;

  .link-text {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;

    &:active {
      opacity: 0.7;
    }
  }
}
</style>
