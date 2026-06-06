/**
 * 用户认证 Store - 支持多角色（admin/manager/user/employee）
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, LoginParams, LoginResult } from '../types/index.js'
import { post } from '../utils/request.js'

// 角色配置 - 各角色的 API 路径和 localStorage key
type RoleType = 'admin' | 'manager' | 'user' | 'employee'

const ROLE_CONFIG: Record<RoleType, {
  loginPath: string
  smsLoginPath: string
  smsSendPath?: string
  tokenKey: string
  userKey: string
}> = {
  admin: {
    loginPath: '/admin/login',
    smsLoginPath: '/admin/sms-login',
    tokenKey: 'admin_token',
    userKey: 'admin_info',
  },
  manager: {
    loginPath: '/managers/login',
    smsLoginPath: '/managers/sms/login',
    smsSendPath: '/managers/sms/send',
    tokenKey: 'manager_token',
    userKey: 'manager_info',
  },
  user: {
    loginPath: '/users/login',
    smsLoginPath: '/users/sms/login',
    smsSendPath: '/users/sms/send',
    tokenKey: 'user_token',
    userKey: 'user_info',
  },
  employee: {
    loginPath: '/employees/login',
    smsLoginPath: '/employees/login', // 员工暂不支持短信登录
    tokenKey: 'employee_token',
    userKey: 'employee_info',
  },
}

export const useAuthStore = defineStore('auth', () => {
  // 当前角色 - 默认 user
  const currentRole = ref<RoleType>('user')
  const token = ref<string>('')
  const user = ref<User | null>(null)

  // 初始化时从 localStorage 加载数据
  const initFromStorage = () => {
    // 尝试从各角色的 key 中查找已登录的信息
    for (const [role, config] of Object.entries(ROLE_CONFIG)) {
      const storedToken = localStorage.getItem(config.tokenKey)
      const storedUser = localStorage.getItem(config.userKey)
      
      if (storedToken && storedUser) {
        currentRole.value = role as RoleType
        token.value = storedToken
        user.value = JSON.parse(storedUser) as User
        return
      }
    }
  }
  initFromStorage()

  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const userRole = computed(() => user.value?.role)
  const config = computed(() => ROLE_CONFIG[currentRole.value])

  const setRole = (role: RoleType) => {
    currentRole.value = role
  }

  // 通用登录成功处理
  const handleLoginSuccess = (data: any) => {
    token.value = data.token || ''
    // 根据不同角色获取用户信息
    user.value = data.admin || data.manager || data.user || data.employee || null
    
    if (user.value) {
      // 保存到 localStorage
      localStorage.setItem(config.value.tokenKey, token.value)
      localStorage.setItem(config.value.userKey, JSON.stringify(user.value))
      // 兼容性：也设置通用的 token key（便于某些代码使用）
      localStorage.setItem('token', token.value)
    }
  }

  // 密码登录
  const login = async (params: LoginParams, role?: RoleType) => {
    if (role) {
      setRole(role)
    }
    
    const res = await post<LoginResult>(config.value.loginPath, params)
    handleLoginSuccess(res.data)
    
    return res.data
  }

  // 短信验证码登录
  const smsLogin = async (params: { phone: string; code: string; teamName?: string }, role?: RoleType) => {
    if (role) {
      setRole(role)
    }
    
    const res = await post<LoginResult>(config.value.smsLoginPath, params)
    handleLoginSuccess(res.data)
    
    return res.data
  }

  // 发送短信验证码
  const sendSmsCode = async (phone: string, role?: RoleType) => {
    if (role) {
      setRole(role)
    }
    
    if (!config.value.smsSendPath) {
      throw new Error('该角色不支持短信验证码功能')
    }
    
    await post(config.value.smsSendPath, { phone })
  }

  // 登出
  const logout = () => {
    // 清除当前角色的存储
    localStorage.removeItem(config.value.tokenKey)
    localStorage.removeItem(config.value.userKey)
    localStorage.removeItem('token') // 同时清除通用 token
    
    token.value = ''
    user.value = null
  }

  // 切换用户/更新用户信息
  const updateUser = (newUser: User | null) => {
    user.value = newUser
    
    if (newUser) {
      localStorage.setItem(config.value.userKey, JSON.stringify(newUser))
    } else {
      localStorage.removeItem(config.value.userKey)
    }
  }

  return {
    currentRole,
    token,
    user,
    isLoggedIn,
    userRole,
    setRole,
    login,
    smsLogin,
    sendSmsCode,
    logout,
    updateUser,
  }
})
