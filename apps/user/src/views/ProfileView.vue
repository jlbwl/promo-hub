<template>
  <div class="profile-page">
    <!-- 用户信息区域 -->
    <div class="user-header">
      <div class="user-info">
        <van-image
          round
          width="64"
          height="64"
          :src="userInfo.avatar"
          fit="cover"
        >
          <template #error>
            <div class="avatar-placeholder">
              <van-icon name="user-o" size="32" color="#fff" />
            </div>
          </template>
        </van-image>
        <div class="user-detail">
          <h3 class="user-name">{{ userInfo.nickname }}</h3>
          <p class="user-id">ID: {{ userInfo.id }}</p>
        </div>
      </div>
    </div>

    <!-- 数据统计 -->
    <div class="stats-card">
      <div class="stat-item" @click="goTo('/commissions')">
        <span class="stat-value">{{ stats.totalCommission }}</span>
        <span class="stat-label">累计佣金</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item" @click="showEmployeeList = true">
        <span class="stat-value">{{ employeeCount }}</span>
        <span class="stat-label">我的团队</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item" @click="goTo('/commissions')">
        <span class="stat-value">{{ stats.withdrawCount }}</span>
        <span class="stat-label">提现记录</span>
      </div>
    </div>

    <!-- 功能列表 -->
    <van-cell-group inset class="func-group">
      <van-cell
        title="创建员工子账户"
        icon="user-plus"
        is-link
        @click="showCreateEmployee = true"
      />
      <van-cell
        title="累计佣金"
        icon="balance-o"
        is-link
        :value="stats.totalCommission"
        @click="goTo('/commissions')"
      />
      <van-cell
        title="提现记录"
        icon="cash-back-record"
        is-link
        @click="goTo('/commissions')"
      />
    </van-cell-group>

    <van-cell-group inset class="func-group">
      <van-cell
        title="修改密码"
        icon="lock"
        is-link
        @click="handleChangePassword"
      />
      <van-cell
        title="关于我们"
        icon="info-o"
        is-link
        @click="handleAbout"
      />
      <van-cell
        title="联系客服"
        icon="service-o"
        is-link
        @click="handleContactService"
      />
    </van-cell-group>

    <!-- 退出登录确认弹窗 -->
    <van-dialog
      v-model:show="logoutDialogVisible"
      title="提示"
      message="确定要退出登录吗？"
      show-cancel-button
      confirm-button-text="确定退出"
      cancel-button-text="取消"
      confirm-button-color="#ee0a24"
      @confirm="doLogout"
    />

    <!-- 创建员工子账户弹窗 -->
    <van-popup v-model:show="showCreateEmployee" position="center" :style="{ width: '90%', maxWidth: '400px' }">
      <div class="employee-dialog">
        <div class="dialog-header">
          <h3>{{ editingEmployee ? '编辑员工' : '创建员工子账户' }}</h3>
          <van-icon name="cross" @click="closeCreateEmployee" />
        </div>
        <div class="dialog-content">
          <van-cell-group inset>
            <van-field
              v-model="employeeForm.phone"
              type="tel"
              label="员工手机号"
              placeholder="请输入员工手机号"
              maxlength="11"
            />
            <van-field
              v-model="employeeForm.password"
              type="password"
              label="登录密码"
              placeholder="请设置6位以上密码"
            />
            <van-field
              v-model="employeeForm.nickname"
              type="text"
              label="员工昵称"
              placeholder="默认为员工+手机号后四位"
            />
            <van-field
              v-model="employeeForm.expiresHours"
              type="digit"
              label="登录有效期(小时)"
              placeholder="请输入有效期，至少1小时"
            />
          </van-cell-group>
          <div class="expire-tips">
            <p>员工账户有效期到期后将自动失效</p>
            <p>员工做单业绩将归属于您的账户</p>
          </div>
        </div>
        <div class="dialog-footer">
          <van-button plain type="default" block @click="closeCreateEmployee">取消</van-button>
          <van-button type="primary" block @click="handleCreateEmployee">{{ editingEmployee ? '保存修改' : '创建账户' }}</van-button>
        </div>
      </div>
    </van-popup>

    <!-- 员工列表弹窗 -->
    <van-popup v-model:show="showEmployeeList" position="center" :style="{ width: '90%', maxWidth: '400px', height: '70%' }">
      <div class="employee-list-dialog">
        <div class="dialog-header">
          <h3>员工子账户列表</h3>
          <van-icon name="cross" @click="showEmployeeList = false" />
        </div>
        <div class="dialog-content">
          <van-list
            v-model:loading="loadingEmployees"
            :finished="employeesFinished"
            finished-text="没有更多了"
            @load="loadEmployees"
          >
            <van-cell v-for="emp in employees" :key="emp.id" clickable @click="editEmployee(emp)">
              <template #title>{{ emp.nickname }}</template>
              <template #value>{{ maskPhone(emp.phone) }}</template>
              <template #right-icon>
                <van-icon name="edit" size="18" color="#1989fa" />
              </template>
            </van-cell>
          </van-list>
          <div v-if="employees.length === 0" class="empty-tip">
            <van-icon name="user-o" size="48" color="#ccc" />
            <p>暂无员工子账户</p>
          </div>
        </div>
        <div class="dialog-footer">
          <van-button type="primary" block @click="showCreateEmployee = true; showEmployeeList = false">添加员工</van-button>
        </div>
      </div>
    </van-popup>

    <!-- 设置密码弹窗 -->
    <van-popup v-model:show="passwordDialogVisible" position="center" :style="{ width: '90%', maxWidth: '360px' }">
      <div class="password-dialog">
        <div class="dialog-header">
          <h3>设置登录密码</h3>
          <van-icon name="cross" @click="passwordDialogVisible = false" />
        </div>
        <div class="dialog-content">
          <van-cell-group inset>
            <van-cell title="当前手机号" :value="userInfo.phone" />
            <van-field
              v-model="passwordForm.code"
              type="digit"
              label="验证码"
              placeholder="请输入验证码"
              maxlength="6"
              clearable
            >
              <template #button>
                <van-button
                  size="small"
                  type="primary"
                  :disabled="smsCooldown > 0"
                  :text="smsCooldown > 0 ? `${smsCooldown}s` : '获取验证码'"
                  @click="handleSendPasswordSms"
                  style="min-width: 90px;"
                />
              </template>
            </van-field>
            <van-field
              v-model="passwordForm.password"
              type="password"
              label="新密码"
              placeholder="请设置6位以上密码"
              clearable
            />
            <van-field
              v-model="passwordForm.confirmPassword"
              type="password"
              label="确认密码"
              placeholder="请再次输入密码"
              clearable
            />
          </van-cell-group>
        </div>
        <div class="dialog-footer">
          <van-button plain type="default" block @click="passwordDialogVisible = false">稍后设置</van-button>
          <van-button type="primary" block @click="handleSetPassword">确认设置</van-button>
        </div>
      </div>
    </van-popup>

    <!-- 退出登录按钮 -->
    <div class="logout-wrap">
      <van-button
        block
        round
        plain
        type="danger"
        size="large"
        @click="logoutDialogVisible = true"
      >
        退出登录
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showDialog, showToast } from 'vant'
import { get, post } from '@promo/shared/utils/request'

// 路由实例
const router = useRouter()

// 退出登录弹窗
const logoutDialogVisible = ref(false)

// 设置密码弹窗
const passwordDialogVisible = ref(false)

// 创建员工弹窗
const showCreateEmployee = ref(false)
const showEmployeeList = ref(false)
const editingEmployee = ref<any>(null)

// 员工列表
const employees = ref<any[]>([])
const loadingEmployees = ref(false)
const employeesFinished = ref(false)
const employeeCount = ref(0)

// 用户信息（从 localStorage 读取真实数据）
const userInfo = reactive({
  id: '',
  nickname: '加载中...',
  avatar: '',
  phone: ''
})

// 统计数据
const stats = reactive({
  totalCommission: '¥0.00',
  promotionCount: '0',
  withdrawCount: '0'
})

// 员工表单
const employeeForm = reactive({
  phone: '',
  password: '',
  nickname: '',
  expiresHours: '24'
})

// 设置密码表单
const passwordForm = reactive({
  code: '',
  password: '',
  confirmPassword: ''
})

// 短信验证码倒计时
const smsCooldown = ref(0)
let smsTimer: ReturnType<typeof setInterval> | null = null

// 加载用户信息
onMounted(() => {
  try {
    const info = JSON.parse(localStorage.getItem('user_info') || '{}')
    userInfo.id = info.id || ''
    userInfo.nickname = info.nickname || info.phone || '用户'
    userInfo.avatar = info.avatar || ''
    userInfo.phone = info.phone || ''
  } catch {
    userInfo.nickname = '用户'
  }
})

// 页面跳转
const goTo = (path: string) => {
  router.push(path)
}

// 修改密码
const handleChangePassword = () => {
  passwordForm.code = ''
  passwordForm.password = ''
  passwordForm.confirmPassword = ''
  passwordDialogVisible.value = true
}

// 发送验证码（用于设置密码）
const handleSendPasswordSms = async () => {
  if (!userInfo.phone) return showToast('获取手机号失败')
  if (!/^1[3-9]\d{9}$/.test(userInfo.phone)) return showToast('手机号格式不正确')

  try {
    await post('/users/sms/send', { phone: userInfo.phone })
    showToast('验证码已发送')
    smsCooldown.value = 60
    smsTimer = setInterval(() => {
      smsCooldown.value--
      if (smsCooldown.value <= 0 && smsTimer) { clearInterval(smsTimer); smsTimer = null }
    }, 1000)
  } catch (e: any) {
    showToast(e.message || '发送失败')
  }
}

// 设置密码
const handleSetPassword = async () => {
  if (!passwordForm.code) return showToast('请输入验证码')
  if (!passwordForm.password) return showToast('请输入新密码')
  if (passwordForm.password.length < 6) return showToast('密码长度至少6位')
  if (passwordForm.password !== passwordForm.confirmPassword) return showToast('两次输入的密码不一致')

  try {
    await post('/users/password/set', {
      phone: userInfo.phone,
      code: passwordForm.code,
      password: passwordForm.password
    })
    showToast('密码设置成功')
    passwordDialogVisible.value = false
  } catch (e: any) {
    showToast(e.message || '设置失败')
  }
}

// 关于我们
const handleAbout = () => {
  showDialog({
    title: '关于我们',
    message: '推广联盟 v1.0.0\n\n分享好物，赚取佣金。我们致力于为用户提供优质的推广平台，让每一次分享都有价值。',
    confirmButtonText: '确定'
  })
}

// 联系客服
const handleContactService = () => {
  showDialog({
    title: '联系客服',
    message: '客服微信：jlyc415\n工作时间：周一至周五 9:00-18:00',
    confirmButtonText: '知道了'
  })
}

// 执行退出登录
const doLogout = () => {
  localStorage.removeItem('user_token')
  localStorage.removeItem('user_info')
  showToast('已退出登录')
  router.replace('/login')
}

// ============ 员工子账户相关方法 ============

// 关闭创建员工弹窗
const closeCreateEmployee = () => {
  showCreateEmployee.value = false
  editingEmployee.value = null
  employeeForm.phone = ''
  employeeForm.password = ''
  employeeForm.nickname = ''
  employeeForm.expiresHours = '24'
}

// 创建员工子账户
const handleCreateEmployee = async () => {
  if (!employeeForm.phone || !/^1[3-9]\d{9}$/.test(employeeForm.phone)) {
    return showToast('请输入正确的手机号')
  }
  if (!employeeForm.password || employeeForm.password.length < 6) {
    return showToast('密码至少6位')
  }
  if (!employeeForm.expiresHours || parseInt(employeeForm.expiresHours) < 1) {
    return showToast('有效期至少1小时')
  }

  try {
    const res: any = await post('/employees', {
      userId: userInfo.id,
      phone: employeeForm.phone,
      password: employeeForm.password,
      nickname: employeeForm.nickname,
      expiresHours: parseInt(employeeForm.expiresHours)
    })

    if (res.code === 0) {
      showToast('创建成功')
      closeCreateEmployee()
      loadEmployees()
    } else {
      showToast(res.message || '创建失败')
    }
  } catch (e: any) {
    showToast(e.message || '创建失败')
  }
}

// 编辑员工
const editEmployee = (emp: any) => {
  editingEmployee.value = emp
  employeeForm.phone = emp.phone
  employeeForm.nickname = emp.nickname
  showEmployeeList.value = false
  showCreateEmployee.value = true
}

// 加载员工列表
const loadEmployees = async () => {
  if (loadingEmployees.value) return
  
  loadingEmployees.value = true
  
  try {
    const res: any = await get(`/employees?userId=${userInfo.id}`)
    
    if (res.code === 0) {
      employees.value = res.data as any[]
      employeeCount.value = (res.data as any[]).length
    }
  } catch (e: any) {
    showToast(e.message || '获取员工列表失败')
  } finally {
    loadingEmployees.value = false
    employeesFinished.value = true
  }
}

// 手机号脱敏
const maskPhone = (phone: string) => {
  if (!phone) return '--'
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}
</script>

<style scoped lang="scss">
.profile-page {
  min-height: 100%;
  background-color: #f7f8fa;
  padding-bottom: 20px;
}

// 用户信息头部
.user-header {
  background: linear-gradient(135deg, #1989fa 0%, #4fc3f7 100%);
  padding: 40px 20px 30px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
}

.user-detail {
  .user-name {
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 4px;
  }

  .user-id {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.8);
  }
}

// 数据统计卡片
.stats-card {
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin: -20px 16px 12px;
  padding: 20px;
  background-color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  position: relative;
  z-index: 1;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;

  &:active {
    opacity: 0.7;
  }
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #323233;
}

.stat-label {
  font-size: 12px;
  color: #969799;
}

.stat-divider {
  width: 1px;
  height: 30px;
  background-color: #eee;
}

// 功能列表
.func-group {
  margin-top: 12px;
  border-radius: 12px;
  overflow: hidden;

  :deep(.van-cell__left-icon) {
    color: #1989fa;
    font-size: 20px;
    margin-right: 8px;
  }
}

// 退出登录
.logout-wrap {
  margin: 24px 16px 0;
}

// 设置密码弹窗
.password-dialog {
  background: #fff;
  border-radius: 16px;
  overflow: hidden;

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #f0f0f0;

    h3 {
      font-size: 16px;
      font-weight: 600;
      color: #323233;
      margin: 0;
    }

    :deep(.van-icon) {
      font-size: 20px;
      color: #969799;
      cursor: pointer;
    }
  }

  .dialog-content {
    padding: 16px 20px;
  }

  .dialog-footer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 16px 16px;

    :deep(.van-button) {
      border-radius: 8px;
    }
  }
}
</style>
