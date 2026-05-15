<template>
  <div class="settings-view">
    <el-card shadow="never" class="settings-card">
      <template #header>
        <span>账户安全</span>
      </template>

      <el-form
        ref="securityFormRef"
        :model="securityForm"
        :rules="securityRules"
        label-width="140px"
        style="max-width: 600px;"
      >
        <el-form-item label="当前手机号">
          <span>{{ currentPhone }}</span>
        </el-form-item>

        <el-divider />

        <el-form-item label="验证码" prop="phoneCode">
          <el-input
            v-model="securityForm.phoneCode"
            placeholder="请输入验证码"
            maxlength="6"
            style="width: 200px;"
          >
            <template #append>
              <el-button
                :disabled="phoneCooldown > 0"
                @click="handleSendPhoneCode"
              >
                {{ phoneCooldown > 0 ? `${phoneCooldown}s` : '获取验证码' }}
              </el-button>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label="旧密码" prop="oldPassword">
          <el-input
            v-model="securityForm.oldPassword"
            type="password"
            placeholder="请输入旧密码"
            show-password
            clearable
          />
        </el-form-item>

        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="securityForm.newPassword"
            type="password"
            placeholder="请输入新密码（6-20位）"
            show-password
            clearable
          />
        </el-form-item>

        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input
            v-model="securityForm.confirmPassword"
            type="password"
            placeholder="请再次输入新密码"
            show-password
            clearable
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="securitySaving" @click="handleSecuritySave">
            修改密码
          </el-button>
          <el-button @click="handleSecurityReset">
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { post } from '@promo/shared/utils/request'

const securityFormRef = ref<FormInstance>()
const securitySaving = ref(false)

// 当前登录的手机号
const currentPhone = ref('')

// 账户安全表单
const securityForm = reactive({
  phoneCode: '',
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

// 账户安全表单校验规则
const validateConfirmPassword = (_rule: any, value: string, callback: any) => {
  if (value !== securityForm.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const securityRules: FormRules = {
  phoneCode: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { len: 6, message: '验证码为6位数字', trigger: 'blur' }
  ],
  oldPassword: [
    { required: true, message: '请输入旧密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度为6-20位', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度为6-20位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

const phoneCooldown = ref(0)
let phoneTimer: ReturnType<typeof setInterval> | null = null

const handleSendPhoneCode = async () => {
  if (!currentPhone.value) return ElMessage.warning('获取当前手机号失败')
  if (!/^1[3-9]\d{9}$/.test(currentPhone.value)) return ElMessage.warning('当前手机号格式不正确')

  try {
    await post('/admin/sms/send', { phone: currentPhone.value })
    ElMessage.success('验证码已发送')
    phoneCooldown.value = 60
    phoneTimer = setInterval(() => {
      phoneCooldown.value--
      if (phoneCooldown.value <= 0 && phoneTimer) {
        clearInterval(phoneTimer)
        phoneTimer = null
      }
    }, 1000)
  } catch (e: any) {
    ElMessage.error(e.message || '发送失败')
  }
}

const handleSecuritySave = async () => {
  if (!securityFormRef.value) return

  await securityFormRef.value.validate(async (valid) => {
    if (!valid) return

    securitySaving.value = true
    try {
      await post('/admin/password/update', {
        phone: currentPhone.value,
        code: securityForm.phoneCode,
        oldPassword: securityForm.oldPassword,
        newPassword: securityForm.newPassword
      })
      ElMessage.success('密码修改成功，请重新登录')
      handleSecurityReset()
      setTimeout(() => {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_info')
        window.location.href = '/login'
      }, 1500)
    } catch (error: any) {
      ElMessage.error(error.message || '修改失败')
    } finally {
      securitySaving.value = false
    }
  })
}

const handleSecurityReset = () => {
  if (!securityFormRef.value) return
  securityFormRef.value.resetFields()
}

onMounted(() => {
  const adminInfo = localStorage.getItem('admin_info')
  if (adminInfo) {
    try {
      const info = JSON.parse(adminInfo)
      currentPhone.value = info.phone || ''
    } catch {
    }
  }
})
</script>

<style lang="scss" scoped>
.settings-view {
  max-width: 800px;
}
</style>
