/**
 * API 请求层封装
 */
import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import type { ApiResponse, RefreshTokenResult } from '../types/index.js'

const BASE_URL = import.meta.env?.VITE_API_BASE_URL || '/api'

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

  const refreshToken = async (): Promise<string> => {
    const refreshToken = 
      localStorage.getItem('admin_refresh_token') ||
      localStorage.getItem('manager_refresh_token') ||
      localStorage.getItem('user_refresh_token') ||
      localStorage.getItem('employee_refresh_token') ||
      localStorage.getItem('refresh_token')
    
    if (!refreshToken) {
      throw new Error('没有可用的刷新令牌')
    }

    const res = await axios.post<ApiResponse<RefreshTokenResult>>(`${BASE_URL}/auth/refresh`, { refreshToken }, { withCredentials: true })
    if (res.data.code === 0 && res.data.data) {
      const data = res.data.data as RefreshTokenResult
      const newToken = data.token
      const newRefreshToken = data.refreshToken
      
      const tokenKey = 
        localStorage.getItem('admin_token') ? 'admin_token' :
        localStorage.getItem('manager_token') ? 'manager_token' :
        localStorage.getItem('user_token') ? 'user_token' :
        localStorage.getItem('employee_token') ? 'employee_token' : 'token'
      
      const refreshTokenKey = tokenKey.replace('_token', '_refresh_token')
      
      localStorage.setItem(tokenKey, newToken)
      localStorage.setItem(refreshTokenKey, newRefreshToken)
      
      return newToken
    } else {
      throw new Error('刷新令牌失败')
    }
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
        const token = 
          localStorage.getItem('admin_token') || 
          localStorage.getItem('manager_token') || 
          localStorage.getItem('user_token') || 
          localStorage.getItem('employee_token') ||
          localStorage.getItem('token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        
        const refreshToken = 
          localStorage.getItem('admin_refresh_token') ||
          localStorage.getItem('manager_refresh_token') ||
          localStorage.getItem('user_refresh_token') ||
          localStorage.getItem('employee_refresh_token') ||
          localStorage.getItem('refresh_token')
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
        const tokenKey = 
          localStorage.getItem('admin_token') ? 'admin_token' :
          localStorage.getItem('manager_token') ? 'manager_token' :
          localStorage.getItem('user_token') ? 'user_token' :
          localStorage.getItem('employee_token') ? 'employee_token' : 'token'
        
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
        const hasRefreshToken = 
          localStorage.getItem('admin_refresh_token') ||
          localStorage.getItem('manager_refresh_token') ||
          localStorage.getItem('user_refresh_token') ||
          localStorage.getItem('employee_refresh_token') ||
          localStorage.getItem('refresh_token')

        if (!hasRefreshToken) {
          localStorage.removeItem('token')
          localStorage.removeItem('manager_token')
          localStorage.removeItem('admin_token')
          localStorage.removeItem('user_token')
          localStorage.removeItem('employee_token')
          localStorage.removeItem('refresh_token')
          localStorage.removeItem('admin_refresh_token')
          localStorage.removeItem('manager_refresh_token')
          localStorage.removeItem('user_refresh_token')
          localStorage.removeItem('employee_refresh_token')
          window.location.reload()
          return Promise.reject(new Error(message || '未登录或会话已过期'))
        }

        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject })
          }).then((token) => {
            response.config.headers.Authorization = `Bearer ${token}`
            return instance(response.config)
          }).catch((error) => {
            localStorage.removeItem('token')
            localStorage.removeItem('manager_token')
            localStorage.removeItem('admin_token')
            localStorage.removeItem('user_token')
            localStorage.removeItem('employee_token')
            localStorage.removeItem('refresh_token')
            localStorage.removeItem('admin_refresh_token')
            localStorage.removeItem('manager_refresh_token')
            localStorage.removeItem('user_refresh_token')
            localStorage.removeItem('employee_refresh_token')
            window.location.reload()
            return Promise.reject(error)
          })
        }

        isRefreshing = true
        return refreshToken().then((token) => {
          processQueue(token)
          response.config.headers.Authorization = `Bearer ${token}`
          return instance(response.config)
        }).catch((error) => {
          processQueue('', error)
          localStorage.removeItem('token')
          localStorage.removeItem('manager_token')
          localStorage.removeItem('admin_token')
          localStorage.removeItem('user_token')
          localStorage.removeItem('employee_token')
          localStorage.removeItem('refresh_token')
          localStorage.removeItem('admin_refresh_token')
          localStorage.removeItem('manager_refresh_token')
          localStorage.removeItem('user_refresh_token')
          localStorage.removeItem('employee_refresh_token')
          window.location.reload()
          return Promise.reject(error)
        }).finally(() => {
          isRefreshing = false
        })
      }
      return Promise.reject(new Error(message || '请求失败'))
    },
    (error) => {
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
