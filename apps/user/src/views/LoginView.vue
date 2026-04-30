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

    <!-- 登录表单 -->
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
          :rules="[
            { required: true, message: '请输入手机号' },
            { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' }
          ]"
        />
        <!-- 密码输入 -->
        <van-field
          v-model="form.password"
          :type="showPassword ? 'text' : 'password'"
          label="密码"
          placeholder="请输入密码"
          clearable
          :right-icon="showPassword ? 'eye-o' : 'closed-eye'"
          @click-right-icon="showPassword = !showPassword"
        />
      </van-cell-group>

      <!-- 登录按钮 -->
      <div class="login-btn-wrap">
        <van-button
          type="primary"
          block
          round
          size="large"
          :loading="loading"
          loading-text="登录中..."
          @click="handleLogin"
        >
          登录
        </van-button>
      </div>

      <!-- 其他操作 -->
      <div class="login-footer">
        <span class="link-text">忘记密码？</span>
        <span class="link-text">注册账号</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast } from 'vant'

// 路由实例
const router = useRouter()
const route = useRoute()

// 是否显示密码
const showPassword = ref(false)

// 加载状态
const loading = ref(false)

// 表单数据
const form = reactive({
  phone: '',
  password: ''
})

// 处理登录
const handleLogin = async () => {
  // 表单验证
  if (!form.phone) {
    showToast('请输入手机号')
    return
  }
  if (!/^1[3-9]\d{9}$/.test(form.phone)) {
    showToast('手机号格式不正确')
    return
  }
  if (!form.password) {
    showToast('请输入密码')
    return
  }

  loading.value = true

  try {
    // TODO: 调用登录接口
    // 模拟登录成功
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 存储用户 Token
    localStorage.setItem('user_token', 'mock_token_' + Date.now())

    showToast('登录成功')

    // 跳转到之前的页面或首页
    const redirect = (route.query.redirect as string) || '/home'
    router.replace(redirect)
  } catch (error) {
    showToast('登录失败，请重试')
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
    width: 60px;
  }
}

.login-btn-wrap {
  margin-top: 32px;
  padding: 0 16px;
}

.login-footer {
  display: flex;
  justify-content: space-between;
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
