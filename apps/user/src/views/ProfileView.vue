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
              <van-icon
                name="user-o"
                size="32"
                color="#fff"
              />
            </div>
          </template>
        </van-image>
        <div class="user-detail">
          <h3 class="user-name">
            {{ userInfo.teamName || userInfo.nickname }}
          </h3>
          <p class="user-id">
            ID: {{ userInfo.id }}
          </p>
        </div>
      </div>
    </div>

    <!-- 数据统计 -->
    <div class="stats-card">
      <div
        class="stat-item"
        @click="goTo('/commissions')"
      >
        <van-icon
          name="coins"
          size="20"
          color="#1989fa"
        />
        <span class="stat-value">{{ stats.totalCommission }}</span>
        <span class="stat-label">累计积分</span>
      </div>
      <div class="stat-divider" />
      <div
        class="stat-item"
        @click="showEmployeeList = true"
      >
        <van-icon
          name="users"
          size="20"
          color="#1989fa"
        />
        <span class="stat-value">{{ employeeCount }}</span>
        <span class="stat-label">我的团队</span>
      </div>
      <div class="stat-divider" />
      <div
        class="stat-item"
        @click="goTo('/commissions')"
      >
        <van-icon
          name="gift-o"
          size="20"
          color="#1989fa"
        />
        <span class="stat-value">{{ stats.withdrawCount }}</span>
        <span class="stat-label">兑换记录</span>
      </div>
    </div>

    <!-- 功能列表 -->
    <van-cell-group
      inset
      class="func-group"
    >
      <van-cell
        title="创建员工子账户"
        icon="user-o"
        is-link
        @click="showCreateEmployee = true"
      />
      <van-cell
        title="累计积分"
        icon="gold-coin"
        is-link
        :value="stats.totalCommission"
        @click="goTo('/commissions')"
      />
      <van-cell
        title="兑换记录"
        icon="gift-o"
        is-link
        @click="goTo('/commissions')"
      />
    </van-cell-group>

    <van-cell-group
      inset
      class="func-group"
    >
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
    <van-popup
      v-model:show="showCreateEmployee"
      position="center"
      :style="{ width: '90%', maxWidth: '420px', borderRadius: '16px', overflow: 'hidden' }"
    >
      <div class="employee-dialog">
        <div class="dialog-header">
          <div class="header-icon">
            <van-icon
              name="user-o"
              size="24"
            />
          </div>
          <h3>{{ editingEmployee ? '编辑员工' : '创建员工子账户' }}</h3>
          <van-icon
            name="cross"
            class="close-icon"
            @click="closeCreateEmployee"
          />
        </div>
        <div class="dialog-content">
          <van-cell-group
            inset
            class="form-group"
          >
            <van-field
              v-model="employeeForm.phone"
              type="tel"
              label="员工手机号"
              placeholder="请输入员工手机号"
              maxlength="11"
              class="form-field"
              :readonly="!!editingEmployee"
              :disabled="!!editingEmployee"
            >
              <template #left-icon>
                <van-icon
                  name="phone"
                  size="16"
                  color="#1989fa"
                />
              </template>
              <template
                v-if="editingEmployee"
                #right-icon
              >
                <span class="readonly-tip">不可修改</span>
              </template>
            </van-field>
            <van-field
              v-model="employeeForm.password"
              type="password"
              label="登录密码"
              placeholder="请设置6位以上密码"
              class="form-field"
            >
              <template #left-icon>
                <van-icon
                  name="lock"
                  size="16"
                  color="#1989fa"
                />
              </template>
            </van-field>
            <van-field
              v-model="employeeForm.nickname"
              type="text"
              label="员工昵称"
              placeholder="默认为员工+手机号后四位"
              class="form-field"
            >
              <template #left-icon>
                <van-icon
                  name="user-o"
                  size="16"
                  color="#1989fa"
                />
              </template>
            </van-field>
            <van-field
              v-model="employeeForm.expiresHours"
              type="digit"
              label="登录有效期"
              placeholder="请输入有效期，至少1小时"
              class="form-field"
            >
              <template #left-icon>
                <van-icon
                  name="clock-o"
                  size="16"
                  color="#1989fa"
                />
              </template>
              <template #right-icon>
                <span class="unit">小时</span>
              </template>
            </van-field>
          </van-cell-group>
          <div class="expire-tips">
            <van-icon
              name="info-o"
              size="16"
              color="#1989fa"
            />
            <div class="tips-content">
              <p>员工账户有效期到期后将自动失效</p>
              <p>员工做单业绩将归属于您的账户</p>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <van-button
            plain
            type="default"
            block
            class="btn-cancel"
            @click="closeCreateEmployee"
          >
            取消
          </van-button>
          <van-button
            type="primary"
            block
            class="btn-confirm"
            @click="handleCreateEmployee"
          >
            {{ editingEmployee ? '保存修改' : '创建账户' }}
          </van-button>
        </div>
      </div>
    </van-popup>

    <!-- 员工列表弹窗 -->
    <van-popup
      v-model:show="showEmployeeList"
      position="center"
      :style="{ width: '90%', maxWidth: '420px', height: '75%', borderRadius: '16px', overflow: 'hidden' }"
    >
      <div class="employee-list-dialog">
        <div class="dialog-header">
          <div class="header-icon">
            <van-icon
              name="users"
              size="24"
            />
          </div>
          <h3>员工子账户列表</h3>
          <van-icon
            name="cross"
            class="close-icon"
            @click="showEmployeeList = false"
          />
        </div>
        <div class="dialog-content">
          <van-loading
            v-if="loadingEmployees && employees.length === 0"
            class="loading-center"
          />
          <van-list
            v-model:loading="loadingEmployees"
            :finished="employeesFinished"
            finished-text="没有更多了"
            class="employee-list"
            @load="loadEmployees"
          >
            <van-cell
              v-for="emp in employees"
              :key="emp.id"
              class="employee-item"
            >
              <template #icon>
                <div class="employee-avatar">
                  <van-icon
                    name="user-o"
                    size="20"
                  />
                </div>
              </template>
              <template #title>
                <div class="employee-name">
                  {{ emp.nickname }}
                </div>
                <div class="employee-phone">
                  {{ maskPhone(emp.phone) }}
                </div>
              </template>
              <template #right-icon>
                <div class="employee-actions">
                  <van-icon
                    name="edit"
                    size="18"
                    color="#1989fa"
                    @click="editEmployee(emp)"
                  />
                  <van-icon
                    name="delete"
                    size="18"
                    color="#ee0a24"
                    @click="handleDeleteEmployee(emp)"
                  />
                </div>
              </template>
            </van-cell>
          </van-list>
          <div
            v-if="!loadingEmployees && employees.length === 0"
            class="empty-tip"
          >
            <div class="empty-icon">
              <van-icon
                name="user-o"
                size="56"
              />
            </div>
            <p class="empty-text">
              暂无员工子账户
            </p>
            <p class="empty-hint">
              点击下方按钮添加员工
            </p>
          </div>
        </div>
        <div class="dialog-footer">
          <van-button
            type="primary"
            block
            class="add-employee-btn"
            @click="showCreateEmployee = true; showEmployeeList = false"
          >
            添加员工
          </van-button>
        </div>
      </div>
    </van-popup>

    <!-- 设置密码弹窗 -->
    <van-popup
      v-model:show="passwordDialogVisible"
      position="center"
      :style="{ width: '90%', maxWidth: '360px' }"
    >
      <div class="password-dialog">
        <div class="dialog-header">
          <h3>设置登录密码</h3>
          <van-icon
            name="cross"
            @click="passwordDialogVisible = false"
          />
        </div>
        <div class="dialog-content">
          <van-cell-group inset>
            <van-cell
              title="当前手机号"
              :value="userInfo.phone"
            />
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
                  style="min-width: 90px;"
                  @click="handleSendPasswordSms"
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
          <van-button
            plain
            type="default"
            block
            @click="passwordDialogVisible = false"
          >
            稍后设置
          </van-button>
          <van-button
            type="primary"
            block
            @click="handleSetPassword"
          >
            确认设置
          </van-button>
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
import { reactive, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showDialog, showToast } from 'vant'
import { get, post, put, del } from '@promo/shared/utils/request'

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
  phone: '',
  teamName: ''
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
const loadUserInfo = async () => {
  try {
    const infoStr = localStorage.getItem('user_info')
    if (!infoStr) {
      console.warn('localStorage 中没有用户信息')
      return
    }
    
    const info = JSON.parse(infoStr)
    if (!info.id) {
      console.warn('localStorage 中的用户信息不完整，缺少 id')
      return
    }
    
    userInfo.id = info.id
    userInfo.nickname = info.nickname || info.phone || '用户'
    userInfo.avatar = info.avatar || ''
    userInfo.phone = info.phone || ''
    userInfo.teamName = info.teamName || ''

    // 从后端获取最新的用户信息
    if (userInfo.id) {
      const res: any = await get(`/users/${userInfo.id}`)
      if (res.code === 0 && res.data) {
        userInfo.nickname = res.data.name || userInfo.nickname
        userInfo.phone = res.data.phone || userInfo.phone
        userInfo.teamName = res.data.teamName || userInfo.teamName
        
        // 更新 localStorage
        localStorage.setItem('user_info', JSON.stringify({
          ...info,
          teamName: userInfo.teamName
        }))
      } else {
        console.warn('获取用户信息失败，API 返回错误:', res.message)
      }
    }
  } catch (e) {
    console.error('获取用户信息失败:', e)
    userInfo.nickname = '用户'
  }
}

onMounted(() => {
  loadUserInfo()
})

// 监听员工列表弹窗打开
watch(showEmployeeList, (val) => {
  if (val) {
    console.log('[员工列表] 弹窗打开，开始加载数据')
    // 弹窗打开时重置状态并加载数据
    employeesFinished.value = false
    employees.value = []
    // 直接加载，不延迟
    loadEmployees()
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
    message: '产品展示系统 v1.0.0\n\n产品展示与管理平台。我们致力于为用户提供优质的产品展示服务。',
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

// 创建或更新员工子账户
const handleCreateEmployee = async () => {
  // 创建时验证手机号
  if (!editingEmployee.value) {
    if (!employeeForm.phone || !/^1[3-9]\d{9}$/.test(employeeForm.phone)) {
      return showToast('请输入正确的手机号')
    }
    if (!employeeForm.password || employeeForm.password.length < 6) {
      return showToast('密码至少6位')
    }
  }
  
  // 编辑时密码可选，但如果填写了必须至少6位
  if (editingEmployee.value && employeeForm.password && employeeForm.password.length < 6) {
    return showToast('密码至少6位')
  }

  if (!employeeForm.expiresHours || parseInt(employeeForm.expiresHours) < 1) {
    return showToast('有效期至少1小时')
  }

  try {
    let res: any
    
    if (editingEmployee.value) {
      // 编辑模式：调用PUT更新，不包含手机号
      res = await put(`/employees/${editingEmployee.value.id}`, {
        password: employeeForm.password,
        nickname: employeeForm.nickname,
        expiresHours: parseInt(employeeForm.expiresHours)
      })
    } else {
      // 创建模式：调用POST
      res = await post('/employees', {
        userId: userInfo.id,
        phone: employeeForm.phone,
        password: employeeForm.password,
        nickname: employeeForm.nickname,
        expiresHours: parseInt(employeeForm.expiresHours)
      })
    }

    if (res.code === 0) {
      showToast(editingEmployee.value ? '更新成功' : '创建成功')
      closeCreateEmployee()
      loadEmployees()
    } else {
      showToast(res.message || (editingEmployee.value ? '更新失败' : '创建失败'))
    }
  } catch (e: any) {
    showToast(e.message || (editingEmployee.value ? '更新失败' : '创建失败'))
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

// 删除员工
const handleDeleteEmployee = async (emp: any) => {
  try {
    await showDialog({
      title: '确认删除',
      message: `确定要删除员工「${emp.nickname}」吗？`,
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      confirmButtonColor: '#ee0a24'
    })
    
    const res: any = await del(`/employees/${emp.id}`)
    if (res.code === 0) {
      showToast('删除成功')
      loadEmployees()
    } else {
      showToast(res.message || '删除失败')
    }
  } catch (e: any) {
    if (e.message !== 'cancel') {
      showToast(e.message || '删除失败')
    }
  }
}

// 加载员工列表
const loadEmployees = async () => {
  console.log('[员工列表] loadEmployees 被调用，当前 loading 状态:', loadingEmployees.value)
  
  if (loadingEmployees.value) {
    console.log('[员工列表] 正在加载中，跳过本次请求')
    return
  }
  
  loadingEmployees.value = true
  employeesFinished.value = false
  
  try {
    // 直接从 localStorage 获取用户ID，不依赖 userInfo 状态
    let userId = userInfo.id
    if (!userId) {
      const infoStr = localStorage.getItem('user_info')
      if (infoStr) {
        try {
          const info = JSON.parse(infoStr)
          userId = info.id
          console.log('[员工列表] 从 localStorage 获取到 userId:', userId)
        } catch (e) {
          console.error('[员工列表] 解析 localStorage 中的用户信息失败:', e)
        }
      }
    }
    
    console.log('[员工列表] 最终使用的 userId:', userId)
    
    if (!userId) {
      console.warn('[员工列表] 用户ID为空，无法加载员工列表')
      showToast('请先登录')
      employees.value = []
      employeeCount.value = 0
      return
    }
    
    console.log('[员工列表] 开始请求 API，userId:', userId)
    const res: any = await get('/employees', { userId })
    console.log('[员工列表] API 返回结果:', res)
    
    if (res.code === 0) {
      employees.value = Array.isArray(res.data) ? res.data : []
      employeeCount.value = employees.value.length
      console.log('[员工列表] 加载成功，共', employeeCount.value, '条记录')
    } else {
      console.error('[员工列表] API 返回错误:', res.message)
      showToast(res.message || '获取员工列表失败')
      employees.value = []
      employeeCount.value = 0
    }
  } catch (e: any) {
    console.error('[员工列表] 加载失败:', e)
    showToast(e.message || '获取员工列表失败')
    employees.value = []
    employeeCount.value = 0
  } finally {
    loadingEmployees.value = false
    employeesFinished.value = true
    console.log('[员工列表] 加载完成，loading 状态已重置')
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

// 创建员工子账户弹窗
.employee-dialog {
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);

  .dialog-header {
    display: flex;
    align-items: center;
    padding: 20px 24px;
    background: linear-gradient(135deg, #1989fa 0%, #4fc3f7 100%);

    .header-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      margin-right: 12px;
      color: #fff;
    }

    h3 {
      flex: 1;
      font-size: 18px;
      font-weight: 600;
      color: #fff;
      margin: 0;
    }

    .close-icon {
      font-size: 20px;
      color: rgba(255, 255, 255, 0.8);
      cursor: pointer;
      padding: 4px;
      transition: all 0.2s;

      &:hover {
        color: #fff;
        transform: rotate(90deg);
      }
    }
  }

  .dialog-content {
    padding: 24px;
  }

  .form-group {
    background: #f8f9fa;
    border-radius: 12px;
    padding: 8px 0;
    margin-bottom: 16px;

    .form-field {
      border-bottom: 1px solid #e8e8e8;

      &:last-child {
        border-bottom: none;
      }

      :deep(.van-field__label) {
        font-size: 14px;
        color: #646566;
        width: 72px;
      }

      :deep(.van-field__value) {
        font-size: 14px;
      }

      :deep(.van-field__control) {
        font-size: 14px;
      }
    }
  }

  .expire-tips {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 12px 16px;
    background: #e8f4fd;
    border-radius: 8px;
    border-left: 4px solid #1989fa;

    .tips-content {
      flex: 1;

      p {
        font-size: 12px;
        color: #646566;
        margin: 4px 0;
        line-height: 1.5;
      }
    }
  }

  .unit {
    font-size: 13px;
    color: #969799;
  }

  .readonly-tip {
    font-size: 12px;
    color: #969799;
  }

  .dialog-footer {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0 24px 24px;

    .btn-cancel {
      border-radius: 10px;
      height: 44px;
      font-size: 15px;
      color: #646566;
      background: #f5f5f5;
      border: none;

      &:active {
        background: #e8e8e8;
      }
    }

    .btn-confirm {
      border-radius: 10px;
      height: 44px;
      font-size: 15px;
      font-weight: 500;
      background: linear-gradient(135deg, #1989fa 0%, #4fc3f7 100%);
      border: none;
      box-shadow: 0 4px 12px rgba(25, 137, 250, 0.3);

      &:active {
        transform: scale(0.98);
      }
    }
  }
}

// 员工列表弹窗
.employee-list-dialog {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);

  .dialog-header {
    display: flex;
    align-items: center;
    padding: 20px 24px;
    background: linear-gradient(135deg, #1989fa 0%, #4fc3f7 100%);

    .header-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      margin-right: 12px;
      color: #fff;
    }

    h3 {
      flex: 1;
      font-size: 18px;
      font-weight: 600;
      color: #fff;
      margin: 0;
    }

    .close-icon {
      font-size: 20px;
      color: rgba(255, 255, 255, 0.8);
      cursor: pointer;
      padding: 4px;
      transition: all 0.2s;

      &:hover {
        color: #fff;
        transform: rotate(90deg);
      }
    }
  }

  .dialog-content {
    flex: 1;
    overflow: hidden;
    padding: 16px;
    position: relative;

    .loading-center {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }

    .employee-list {
      height: 100%;
      padding-bottom: 16px;
    }

    .employee-item {
      margin-bottom: 12px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      background: #fff;

      .employee-avatar {
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #e8f4fd 0%, #f0f7ff 100%);
        border-radius: 50%;
        color: #1989fa;
        font-size: 18px;
      }

      .employee-name {
        font-size: 15px;
        font-weight: 600;
        color: #323233;
        margin-bottom: 4px;
      }

      .employee-phone {
        font-size: 13px;
        color: #969799;
      }

      .employee-actions {
        display: flex;
        gap: 16px;
        
        :deep(.van-icon) {
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          transition: all 0.2s;
          
          &:active {
            transform: scale(0.95);
            background: rgba(0, 0, 0, 0.05);
          }
        }
      }
    }

    .empty-tip {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 40px 20px;

      .empty-icon {
        width: 100px;
        height: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #f5f7fa 0%, #e8eaed 100%);
        border-radius: 50%;
        color: #c8c9cc;
        margin-bottom: 20px;
      }

      .empty-text {
        font-size: 16px;
        color: #646566;
        margin: 0 0 8px 0;
      }

      .empty-hint {
        font-size: 13px;
        color: #969799;
        margin: 0;
      }
    }
  }

  .dialog-footer {
    padding: 0 24px 24px;

    .add-employee-btn {
      border-radius: 12px;
      height: 46px;
      font-size: 16px;
      font-weight: 500;
      background: linear-gradient(135deg, #1989fa 0%, #4fc3f7 100%);
      border: none;
      box-shadow: 0 4px 16px rgba(25, 137, 250, 0.35);

      &:active {
        transform: scale(0.98);
      }
    }
  }
}

// 设置密码弹窗
.password-dialog {
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    background: linear-gradient(135deg, #1989fa 0%, #4fc3f7 100%);

    h3 {
      font-size: 18px;
      font-weight: 600;
      color: #fff;
      margin: 0;
    }

    :deep(.van-icon) {
      font-size: 20px;
      color: rgba(255, 255, 255, 0.8);
      cursor: pointer;
      padding: 4px;
      transition: all 0.2s;

      &:hover {
        color: #fff;
        transform: rotate(90deg);
      }
    }
  }

  .dialog-content {
    padding: 24px;
  }

  .dialog-footer {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0 24px 24px;

    :deep(.van-button) {
      border-radius: 10px;
      height: 44px;
      font-size: 15px;
    }
  }
}
</style>
