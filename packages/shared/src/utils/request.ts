/**
 * API 请求层封装
 */
import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import type { ApiResponse } from '../types'

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

  // 请求拦截器 — 自动携带 token（跳过登录相关接口）
  instance.interceptors.request.use(
    (config) => {
      // 跳过登录相关接口的Authorization头
      const isLoginOrRegister = 
        config.url?.includes('/login') || 
        config.url?.includes('/register') ||
        config.url?.includes('/sms/send')
      
      if (!isLoginOrRegister) {
        // 尝试从所有角色的token key中读取
        const token = 
          localStorage.getItem('admin_token') || 
          localStorage.getItem('manager_token') || 
          localStorage.getItem('user_token') || 
          localStorage.getItem('employee_token') ||
          localStorage.getItem('token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
      }
      return config
    },
    (error) => Promise.reject(error),
  )

  // 响应拦截器 — 统一错误处理
  instance.interceptors.response.use(
    (response: AxiosResponse<ApiResponse>) => {
      const { code, message } = response.data
      if (code === 0) {
        return response
      }
      // 401 未授权 — 仅在非登录页时跳转
      if (code === 401 && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('token')
        localStorage.removeItem('manager_token')
        localStorage.removeItem('admin_token')
        window.location.reload()
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
