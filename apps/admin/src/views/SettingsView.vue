<template>
  <div class="settings-view">
    <el-card shadow="never" class="settings-card">
      <template #header>
        <span>基本设置</span>
      </template>

      <el-form
        ref="settingsFormRef"
        :model="settingsForm"
        :rules="settingsRules"
        label-width="140px"
        style="max-width: 600px;"
      >
        <!-- 系统名称 -->
        <el-form-item label="系统名称" prop="systemName">
          <el-input
            v-model="settingsForm.systemName"
            placeholder="请输入系统名称"
            clearable
          />
        </el-form-item>

        <!-- 默认佣金比例 -->
        <el-form-item label="默认佣金比例" prop="defaultCommissionRate">
          <el-input-number
            v-model="settingsForm.defaultCommissionRate"
            :min="0"
            :max="100"
            :precision="1"
            :step="0.5"
          />
          <span style="margin-left: 8px; color: #909399;">%</span>
        </el-form-item>

        <!-- 最低提现金额 -->
        <el-form-item label="最低提现金额" prop="minWithdrawAmount">
          <el-input-number
            v-model="settingsForm.minWithdrawAmount"
            :min="0"
            :precision="2"
            :step="100"
          />
          <span style="margin-left: 8px; color: #909399;">元</span>
        </el-form-item>

        <!-- 每页显示条数 -->
        <el-form-item label="每页显示条数" prop="pageSize">
          <el-select v-model="settingsForm.pageSize" placeholder="请选择">
            <el-option label="10 条/页" :value="10" />
            <el-option label="20 条/页" :value="20" />
            <el-option label="50 条/页" :value="50" />
            <el-option label="100 条/页" :value="100" />
          </el-select>
        </el-form-item>

        <!-- 系统公告 -->
        <el-form-item label="系统公告" prop="announcement">
          <el-input
            v-model="settingsForm.announcement"
            type="textarea"
            :rows="4"
            placeholder="请输入系统公告内容"
          />
        </el-form-item>

        <!-- 操作按钮 -->
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="handleSave">
            保存设置
          </el-button>
          <el-button @click="handleReset">
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="settings-card" style="margin-top: 20px;">
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

        <el-form-item label="新手机号" prop="newPhone">
          <el-input
            v-model="securityForm.newPhone"
            placeholder="请输入新手机号"
            maxlength="11"
            clearable
          />
        </el-form-item>

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

        <el-divider />

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

        <el-form-item label="旧密码" prop="oldPassword">
          <el-input
            v-model="securityForm.oldPassword"
            type="password"
            placeholder="请输入旧密码以确认身份"
            show-password
            clearable
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="securitySaving" @click="handleSecuritySave">
            保存修改
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

const settingsFormRef = ref<FormInstance>()
const securityFormRef = ref<FormInstance>()
const saving = ref(false)
const securitySaving = ref(false)

// 当前登录的手机号
const currentPhone = ref('')

// 设置表单数据
const settingsForm = reactive({
  systemName: '',
  defaultCommissionRate: 10,
  minWithdrawAmount: 100,
  pageSize: 20,
  announcement: ''
})

// 账户安全表单
const securityForm = reactive({
  newPhone: '',
  phoneCode: '',
  newPassword: '',
  confirmPassword: '',
  oldPassword: ''
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
  newPhone: [
    { required: true, message: '请输入新手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ],
  phoneCode: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { len: 6, message: '验证码为6位数字', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度为6-20位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ],
  oldPassword: [
    { required: true, message: '请输入旧密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度为6-20位', trigger: 'blur' }
  ]
}

// 表单校验规则
const settingsRules: FormRules = {
  systemName: [
    { required: true, message: '请输入系统名称', trigger: 'blur' },
    { min: 2, max: 50, message: '系统名称长度为 2 到 50 个字符', trigger: 'blur' }
  ],
  defaultCommissionRate: [
    { required: true, message: '请设置默认佣金比例', trigger: 'change' }
  ],
  minWithdrawAmount: [
    { required: true, message: '请设置最低提现金额', trigger: 'change' }
  ]
}

const phoneCooldown = ref(0)
let phoneTimer: ReturnType<typeof setInterval> | null = null

const handleSendPhoneCode = async () => {
  if (!securityForm.newPhone) return ElMessage.warning('请输入新手机号')
  if (!/^1[3-9]\d{9}$/.test(securityForm.newPhone)) return ElMessage.warning('请输入正确的新手机号')

  try {
    await post('/admin/sms/send', { phone: securityForm.newPhone })
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
      await post('/admin/update', {
        oldPassword: securityForm.oldPassword,
        newPhone: securityForm.newPhone,
        phoneCode: securityForm.phoneCode,
        newPassword: securityForm.newPassword
      })
      ElMessage.success('账户信息修改成功')
      handleSecurityReset()
      const adminInfo = localStorage.getItem('admin_info')
      if (adminInfo) {
        const info = JSON.parse(adminInfo)
        currentPhone.value = info.phone
      }
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

// 保存设置
const handleSave = async () => {
  if (!settingsFormRef.value) return

  await settingsFormRef.value.validate(async (valid) => {
    if (!valid) return

    saving.value = true
    try {
      localStorage.setItem('admin_settings', JSON.stringify(settingsForm))
      ElMessage.success('设置保存成功')
    } catch (error: any) {
      ElMessage.error(error.message || '保存失败，请重试')
    } finally {
      saving.value = false
    }
  })
}

// 重置表单
const handleReset = () => {
  if (!settingsFormRef.value) return
  settingsFormRef.value.resetFields()
  ElMessage.info('已重置为默认值')
}

// 页面加载时读取设置
onMounted(() => {
  const saved = localStorage.getItem('admin_settings')
  if (saved) {
    try {
      const data = JSON.parse(saved)
      Object.assign(settingsForm, data)
    } catch {
    }
  } else {
    settingsForm.systemName = '推广管理系统'
    settingsForm.defaultCommissionRate = 10
    settingsForm.minWithdrawAmount = 100
    settingsForm.pageSize = 20
    settingsForm.announcement = '欢迎使用推广管理系统！'
  }

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
