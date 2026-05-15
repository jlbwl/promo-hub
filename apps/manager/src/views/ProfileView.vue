<template>
  <div class="profile-page">
    <el-row :gutter="20">
      <!-- 左侧：经理信息 -->
      <el-col :xs="24" :md="12">
        <el-card shadow="hover">
          <template #header>
            <span>经理信息</span>
          </template>
          <div class="profile-info">
            <div class="avatar-section">
              <el-avatar :size="80" class="avatar">
                {{ (managerInfo.teamName || managerInfo.name).charAt(0) }}
              </el-avatar>
              <div class="info-text">
                <h3>{{ managerInfo.teamName || managerInfo.name }}</h3>
                <p class="info-label">渠道经理</p>
              </div>
            </div>
            <el-descriptions :column="1" border class="info-descriptions">
              <el-descriptions-item label="渠道名称">
                {{ managerInfo.teamName || managerInfo.name }}
              </el-descriptions-item>
              <el-descriptions-item label="手机号">
                {{ managerInfo.phone }}
              </el-descriptions-item>
              <el-descriptions-item label="累计积分">
                <span style="color: #f56c6c; font-weight: 600; font-size: 16px;">
                  {{ managerInfo.totalCommission.toFixed(2) }}
                </span>
              </el-descriptions-item>
              <el-descriptions-item label="注册时间">
                {{ managerInfo.createdAt }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-card>
      </el-col>

      <!-- 右侧：修改密码 -->
      <el-col :xs="24" :md="12">
        <el-card shadow="hover">
          <template #header>
            <span>修改密码</span>
          </template>
          <el-form
            ref="passwordFormRef"
            :model="passwordForm"
            :rules="passwordRules"
            label-width="100px"
            style="max-width: 400px;"
          >
            <el-form-item label="验证码" prop="code">
              <div style="display: flex; gap: 12px;">
                <el-input
                  v-model="passwordForm.code"
                  placeholder="请输入验证码"
                  maxlength="6"
                  style="flex: 1;"
                />
                <el-button
                  type="primary"
                  :disabled="smsCooldown > 0"
                  @click="handleSendSms"
                  style="min-width: 120px;"
                >
                  {{ smsCooldown > 0 ? `${smsCooldown}s` : '获取验证码' }}
                </el-button>
              </div>
            </el-form-item>
            <el-form-item label="新密码" prop="newPassword">
              <el-input
                v-model="passwordForm.newPassword"
                type="password"
                placeholder="请输入新密码"
                show-password
              />
            </el-form-item>
            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input
                v-model="passwordForm.confirmPassword"
                type="password"
                placeholder="请再次输入新密码"
                show-password
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="passwordSaving" @click="handleChangePassword">
                {{ passwordSaving ? '提交中...' : '修改密码' }}
              </el-button>
              <el-button @click="handleResetPassword">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { get, post } from '@promo/shared/utils/request'

// 密码表单引用
const passwordFormRef = ref<FormInstance>()

// 密码保存状态
const passwordSaving = ref(false)

// 短信验证码倒计时
const smsCooldown = ref(0)
let smsTimer: ReturnType<typeof setInterval> | null = null

// 经理信息（模拟数据，实际从接口获取）
const managerInfo = reactive({
  name: '',
  teamName: '',
  phone: '',
  totalCommission: 0,
  createdAt: ''
})

// 修改密码表单
const passwordForm = reactive({
  code: '',
  newPassword: '',
  confirmPassword: ''
})

// 确认密码校验器
const validateConfirmPassword = (_rule: any, value: string, callback: Function) => {
  if (value !== passwordForm.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

// 密码表单校验规则
const passwordRules: FormRules = {
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { len: 6, message: '验证码为6位数字', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度在 6 到 20 个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

onUnmounted(() => {
  if (smsTimer) clearInterval(smsTimer)
})

// 获取经理信息
const fetchManagerInfo = async () => {
  try {
    const storedInfo = localStorage.getItem('manager_info')
    if (storedInfo) {
      const info = JSON.parse(storedInfo)
      managerInfo.name = info.name || '张经理'
      managerInfo.phone = info.phone || '13800138000'
      managerInfo.teamName = info.teamName || ''
    }

    // 从后端获取最新的经理信息
    const managerId = getManagerId()
    if (managerId) {
      const res = await get<any>(`/managers/${managerId}`)
      if (res.data) {
        managerInfo.name = res.data.name || managerInfo.name
        managerInfo.phone = res.data.phone || managerInfo.phone
        managerInfo.teamName = res.data.teamName || managerInfo.name
        managerInfo.createdAt = res.data.createdAt ? formatTime(res.data.createdAt) : '2025-06-15 10:00:00'
      }

      // 获取审核通过的订单金额总和
      const orderRes = await get<any>('/orders', {
        managerId,
        status: 'approved',
        pageSize: 9999
      })
      const orders = orderRes.data?.list || []
      // 累计佣金 = 审核通过的订单金额总和
      managerInfo.totalCommission = orders.reduce((sum: number, o: any) => sum + (Number(o.productPrice) || 0), 0)
    }

    if (!managerInfo.createdAt) {
      managerInfo.createdAt = '2025-06-15 10:00:00'
    }
  } catch (error) {
    console.error('获取经理信息失败:', error)
    ElMessage.error('获取经理信息失败')
  }
}

// 格式化时间
const formatTime = (iso: string) => {
  if (!iso) return '--'
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hours = d.getHours()
  const minutes = d.getMinutes()
  const seconds = d.getSeconds()
  return `${year}-${p(month)}-${p(day)} ${p(hours)}:${p(minutes)}:${p(seconds)}`
}

// 获取当前经理 ID
const getManagerId = () => {
  try {
    const info = JSON.parse(localStorage.getItem('manager_info') || '{}')
    return info.id || ''
  } catch { return '' }
}

// 发送短信验证码
const handleSendSms = async () => {
  if (!managerInfo.phone) return ElMessage.error('获取手机号失败')
  if (!/^1[3-9]\d{9}$/.test(managerInfo.phone)) return ElMessage.error('手机号格式不正确')

  try {
    await post('/managers/sms/send', { phone: managerInfo.phone })
    ElMessage.success('验证码已发送')
    smsCooldown.value = 60
    smsTimer = setInterval(() => {
      smsCooldown.value--
      if (smsCooldown.value <= 0 && smsTimer) { clearInterval(smsTimer); smsTimer = null }
    }, 1000)
  } catch (e: any) {
    ElMessage.error(e.message || '发送失败')
  }
}

// 修改密码
const handleChangePassword = async () => {
  if (!passwordFormRef.value) return

  try {
    await passwordFormRef.value.validate()

    passwordSaving.value = true

    await post('/managers/password/set', {
      phone: managerInfo.phone,
      code: passwordForm.code,
      password: passwordForm.newPassword
    })

    ElMessage.success('密码修改成功，请重新登录')

    // 清除登录凭证，跳转到登录页
    localStorage.removeItem('manager_token')
    localStorage.removeItem('manager_info')
    setTimeout(() => {
      window.location.href = '/login'
    }, 1500)
  } catch (error: any) {
    ElMessage.error(error.message || '密码修改失败')
  } finally {
    passwordSaving.value = false
  }
}

// 重置密码表单
const handleResetPassword = () => {
  if (passwordFormRef.value) {
    passwordFormRef.value.resetFields()
  }
}

onMounted(() => {
  fetchManagerInfo()
})
</script>

<style lang="scss" scoped>
.profile-page {
  .profile-info {
    .avatar-section {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;

      .avatar {
        font-size: 32px;
        background-color: #409eff;
        color: #fff;
      }

      .info-text {
        h3 {
          font-size: 20px;
          color: #303133;
          margin-bottom: 4px;
        }

        .info-label {
          font-size: 13px;
          color: #909399;
        }
      }
    }

    .info-descriptions {
      :deep(.el-descriptions__label) {
        width: 100px;
      }
    }
  }
}
</style>
