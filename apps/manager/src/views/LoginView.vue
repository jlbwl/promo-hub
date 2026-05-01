<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-header">
        <h2>推广经理后台</h2>
        <p>推广经理管理系统</p>
      </div>
      <el-form
        ref="loginFormRef"
        :model="loginForm"
        :rules="loginRules"
        class="login-form"
        @keyup.enter="handleLogin"
      >
        <el-form-item prop="username">
          <el-input
            v-model="loginForm.username"
            placeholder="请输入用户名"
            prefix-icon="User"
            size="large"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
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
            @click="handleLogin"
          >
            {{ loading ? '登录中...' : '登 录' }}
          </el-button>
        </el-form-item>
      </el-form>
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

// 检查是否因账号失效被踢出
if (route.query.expired === '1') {
  ElMessage.warning('账号已被删除或禁用，请重新登录')
}

// 表单引用
const loginFormRef = ref<FormInstance>()

// 加载状态
const loading = ref(false)

// 登录表单数据
const loginForm = reactive({
  username: '',
  password: ''
})

// 表单校验规则
const loginRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度在 3 到 20 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度在 6 到 20 个字符', trigger: 'blur' }
  ]
}

// 登录处理
const handleLogin = async () => {
  if (!loginFormRef.value) return

  try {
    // 表单校验
    await loginFormRef.value.validate()

    loading.value = true

    // 调用登录接口校验白名单
    const res = await post<any>('/managers/login', {
      username: loginForm.username,
      password: loginForm.password,
    })

    if (res.data && res.data.token) {
      // 登录成功，保存 token 和经理信息
      localStorage.setItem('manager_token', res.data.token)
      localStorage.setItem('manager_info', JSON.stringify(res.data.manager))

      ElMessage.success('登录成功')

      // 跳转到重定向地址或仪表盘
      const redirect = (route.query.redirect as string) || '/dashboard'
      router.push(redirect)
    }
  } catch (error: any) {
    // 登录失败（非白名单用户或密码错误）
    ElMessage.error(error.message || '登录失败，请检查用户名和密码')
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
}
</style>
