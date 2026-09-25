/**
 * API 请求层封装
 */
import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import type { ApiResponse, RefreshTokenResult } from '../types/index.js'

const BASE_URL = import.meta.env?.VITE_API_BASE_URL || '/api'

// 按角色优先级读取 refresh token（与登录时各端存储的 key 对应）
function readRefreshToken(): string | null {
  return (
    localStorage.getItem('admin_refresh_token') ||
    localStorage.getItem('manager_refresh_token') ||
    localStorage.getItem('user_refresh_token') ||
    localStorage.getItem('employee_refresh_token') ||
    localStorage.getItem('refresh_token')
  )
}

// 按角色优先级确定 token 存储 key
function readTokenKey(): string {
  return (
    localStorage.getItem('admin_token') ? 'admin_token' :
    localStorage.getItem('manager_token') ? 'manager_token' :
    localStorage.getItem('user_token') ? 'user_token' :
    localStorage.getItem('employee_token') ? 'employee_token' : 'token'
  )
}

// 所有角色的 token / refresh token 存储 key
const AUTH_STORAGE_KEYS = [
  'token', 'manager_token', 'admin_token', 'user_token', 'employee_token',
  'refresh_token', 'admin_refresh_token', 'manager_refresh_token',
  'user_refresh_token', 'employee_refresh_token',
]

function clearAllTokens(): void {
  AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
}

/**
 * 刷新 token（公共实现，供拦截器与各应用 useAuth 复用）
 * @returns 新的 access token
 */
export async function refreshTokens(): Promise<string> {
  const refreshToken = readRefreshToken()
  if (!refreshToken) {
    throw new Error('没有可用的刷新令牌')
  }

  const res = await axios.post<ApiResponse<RefreshTokenResult>>(`${BASE_URL}/auth/refresh`, { refreshToken }, { withCredentials: true })
  if (res.data.code === 0 && res.data.data) {
    const data = res.data.data as RefreshTokenResult
    const newToken = data.token
    const newRefreshToken = data.refreshToken

    const tokenKey = readTokenKey()
    const refreshTokenKey = tokenKey.replace('_token', '_refresh_token')

    localStorage.setItem(tokenKey, newToken)
    localStorage.setItem(refreshTokenKey, newRefreshToken)

    return newToken
  } else {
    throw new Error('刷新令牌失败')
  }
}

function createRequest(): AxiosInstance {
  const instance = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: true,
  })

  let isRefreshing = false
  let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: Error) => void }> = []

  const processQueue = (token: string, error?: Error) => {
    failedQueue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error)
      } else {
        resolve(token)
      }
    })
    failedQueue = []
  }

  // 登录/刷新类接口自身失败时不触发续期，避免死循环
  const isAuthEndpoint = (url?: string): boolean =>
    !!url && (
      url.includes('/login') ||
      url.includes('/register') ||
      url.includes('/sms/send') ||
      url.includes('/auth/refresh') ||
      url.includes('/users/refresh')
    )

  /**
   * 统一处理 401（HTTP 状态码 401 或业务 code 401）：
   * 有 refresh token 则刷新后重放原请求；否则清除登录态并刷新页面。
   */
  const handleUnauthorized = (config: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse>> => {
    const headers = (config.headers ?? {}) as Record<string, string>
    config.headers = headers
    const canRefresh = !!readRefreshToken() && !isAuthEndpoint(config?.url) && !(config as { _retryAuth?: boolean })?._retryAuth

    if (!canRefresh) {
      clearAllTokens()
      window.location.reload()
      return Promise.reject(new Error('未登录或会话已过期'))
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        headers.Authorization = `Bearer ${token}`
        return instance(config)
      }).catch((error: Error) => {
        clearAllTokens()
        window.location.reload()
        return Promise.reject(error)
      })
    }

    isRefreshing = true
    return refreshTokens().then((token) => {
      processQueue(token)
      headers.Authorization = `Bearer ${token}`
      return instance(config)
    }).catch((error: Error) => {
      processQueue('', error)
      clearAllTokens()
      window.location.reload()
      return Promise.reject(error)
    }).finally(() => {
      isRefreshing = false
    })
  }

  // 请求拦截器 — 自动携带 token（跳过登录相关接口）
  instance.interceptors.request.use(
    (config) => {
      const isLoginOrRegister =
        config.url?.includes('/login') ||
        config.url?.includes('/register') ||
        config.url?.includes('/sms/send') ||
        config.url?.includes('/auth/refresh')

      if (!isLoginOrRegister) {
        const token = localStorage.getItem(readTokenKey())
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }

        const refreshToken = readRefreshToken()
        if (refreshToken) {
          config.headers['X-Refresh-Token'] = refreshToken
        }
      }

      // 自动携带 CSRF token（从 cookie 中读取）
      if (typeof document !== 'undefined') {
        const csrfToken = document.cookie
          .split('; ')
          .find(row => row.startsWith('csrfToken='))
          ?.split('=')[1]
        if (csrfToken) {
          config.headers['X-CSRF-Token'] = csrfToken
        }
      }
      
      return config
    },
    (error) => Promise.reject(error),
  )

  // 响应拦截器 — 统一错误处理
  instance.interceptors.response.use(
    (response: AxiosResponse<ApiResponse>) => {
      const headers = response.headers || {}
      const newToken = headers['x-new-token'] as string
      const newRefreshToken = headers['x-new-refresh-token'] as string
      
      if (newToken) {
        const tokenKey = readTokenKey()
        const refreshTokenKey = tokenKey.replace('_token', '_refresh_token')

        localStorage.setItem(tokenKey, newToken)
        if (newRefreshToken) {
          localStorage.setItem(refreshTokenKey, newRefreshToken)
        }
      }

      const { code, message } = response.data
      if (code === 0) {
        return response
      }
      if (code === 401 && !window.location.pathname.includes('/login')) {
        ;(response.config as AxiosRequestConfig & { _retryAuth?: boolean })._retryAuth = true
        return handleUnauthorized(response.config)
      }
      return Promise.reject(new Error(message || '请求失败'))
    },
    (error) => {
      // HTTP 层 401（access token 过期）：同样走统一续期流程，避免误清登录态
      if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
        const config = error.config as (AxiosRequestConfig & { _retryAuth?: boolean }) | undefined
        if (config) {
          config._retryAuth = true
          return handleUnauthorized(config)
        }
      }
      const msg = error.response?.data?.message || error.message || '网络错误'
      return Promise.reject(new Error(msg))
    },
  )

  return instance
}

const request = createRequest()

/**
 * 通用请求方法
 */
export async function get<T>(url: string, params?: object, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  const res = await request.get<ApiResponse<T>>(url, { 
    ...config,
    params: params as Record<string, unknown> 
  })
  return res.data
}

export async function post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  const res = await request.post<ApiResponse<T>>(url, data, config)
  return res.data
}

export async function put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  const res = await request.put<ApiResponse<T>>(url, data, config)
  return res.data
}

export async function del<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  const res = await request.delete<ApiResponse<T>>(url, { 
    ...config,
    data 
  })
  return res.data
}

export default request
