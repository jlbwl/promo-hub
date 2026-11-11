/**
 * API 请求层封装
 */
import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import type { ApiResponse, RefreshTokenResult } from '../types/index.js'

const BASE_URL = import.meta.env?.VITE_API_BASE_URL || '/api'

// 当前应用作用域：三端同域部署（/admin、/manager、/user）
// 必须只读取本端登录态，否则管理端的 admin_token 会被用户端/经理端复用造成越权
function getAuthScope(): 'admin' | 'manager' | 'user' {
  if (typeof window === 'undefined') return 'user'
  const path = window.location.pathname
  if (path.startsWith('/admin')) return 'admin'
  if (path.startsWith('/manager')) return 'manager'
  return 'user'
}

// 按应用作用域读取 refresh token（根路径视为用户端）
function readRefreshToken(): string | null {
  const scope = getAuthScope()
  if (scope === 'admin') return localStorage.getItem('admin_refresh_token')
  if (scope === 'manager') return localStorage.getItem('manager_refresh_token')
  return localStorage.getItem('employee_refresh_token') || localStorage.getItem('user_refresh_token')
}

// 按应用作用域确定 token 存储 key
function readTokenKey(): string {
  const scope = getAuthScope()
  if (scope === 'admin') return 'admin_token'
  if (scope === 'manager') return 'manager_token'
  return localStorage.getItem('employee_token') ? 'employee_token' : 'user_token'
}

// 各端登录态 key：只清理当前应用，避免一端 401/登出误清其他端会话
// 同时清理历史遗留的通用 key（token/refresh_token）
const SCOPE_STORAGE_KEYS: Record<'admin' | 'manager' | 'user', string[]> = {
  admin: ['admin_token', 'admin_refresh_token', 'admin_info', 'token', 'refresh_token'],
  manager: ['manager_token', 'manager_refresh_token', 'manager_info', 'token', 'refresh_token'],
  user: [
    'user_token', 'user_refresh_token', 'user_info',
    'employee_token', 'employee_refresh_token', 'employee_info',
    'login_type', 'token', 'refresh_token',
  ],
}

/**
 * 清除当前应用的登录态（不误伤同域其他端）
 */
export function clearAuthStorage(): void {
  SCOPE_STORAGE_KEYS[getAuthScope()].forEach((key) => localStorage.removeItem(key))
}

type SessionExpiredHandler = () => void

// 会话彻底失效时的引导登录处理器，由各端入口注入（可复用路由跳转）
let sessionExpiredHandler: SessionExpiredHandler | null = null
// 并发请求同时失效时只提示一次，避免重复跳转
let lastSessionExpiredAt = 0

/**
 * 注册会话失效处理器；未注册时回退为跳转当前端登录页
 */
export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  sessionExpiredHandler = handler
  lastSessionExpiredAt = 0
}

function getLoginPath(pathname: string): string {
  if (pathname.startsWith('/admin')) return '/admin/login'
  if (pathname.startsWith('/manager')) return '/manager/login'
  if (pathname.startsWith('/user')) return '/user/login'
  return '/login'
}

/**
 * 会话彻底失效：清理登录态并引导登录，不再整页刷新（避免丢失表单与刷新循环）
 */
function handleSessionExpired(): void {
  clearAuthStorage()
  const now = Date.now()
  if (now - lastSessionExpiredAt < 2000) return
  lastSessionExpiredAt = now
  if (sessionExpiredHandler) {
    sessionExpiredHandler()
    return
  }
  if (typeof window === 'undefined') return
  const { pathname, search } = window.location
  if (pathname.includes('/login')) return
  window.location.replace(`${getLoginPath(pathname)}?redirect=${encodeURIComponent(pathname + search)}`)
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

/**
 * 需要实时的 GET 前缀：交易、购物车、个人数据必须绕过 WebView 与中间代理的启发式缓存；
 * 产品/分类等公开目录保持可缓存，减少弱网首屏开销与流量
 */
const REALTIME_GET_PREFIXES = ['/orders', '/cart', '/user/', '/users/', '/employees']

const needsCacheBust = (url?: string): boolean =>
  !!url && REALTIME_GET_PREFIXES.some((prefix) => url.startsWith(prefix))

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
   * 有 refresh token 则刷新后重放原请求；否则清除登录态并引导登录（不整页刷新）。
   */
  const handleUnauthorized = (config: AxiosRequestConfig): Promise<AxiosResponse<ApiResponse>> => {
    const headers = (config.headers ?? {}) as Record<string, string>
    config.headers = headers
    const canRefresh = !!readRefreshToken() && !isAuthEndpoint(config?.url) && !(config as { _retryAuth?: boolean })?._retryAuth

    if (!canRefresh) {
      handleSessionExpired()
      return Promise.reject(new Error('未登录或会话已过期'))
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        headers.Authorization = `Bearer ${token}`
        // 重放前标记，防止重放结果再次 401 时无限续期循环
        ;(config as AxiosRequestConfig & { _retryAuth?: boolean })._retryAuth = true
        return instance(config)
      }).catch((error: Error) => {
        handleSessionExpired()
        return Promise.reject(error)
      })
    }

    isRefreshing = true
    return refreshTokens().then((token) => {
      processQueue(token)
      headers.Authorization = `Bearer ${token}`
      // 重放前标记，防止重放结果再次 401 时无限续期循环
      ;(config as AxiosRequestConfig & { _retryAuth?: boolean })._retryAuth = true
      return instance(config)
    }).catch((error: Error) => {
      processQueue('', error)
      handleSessionExpired()
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

      // 仅实时性接口附加时间戳，绕过微信 X5/XWeb 等 WebView 与中间代理的启发式缓存；
      // 产品/分类等公开目录不加 _t，允许浏览器与 CDN 正常缓存
      if ((config.method || 'get').toLowerCase() === 'get' && needsCacheBust(config.url)) {
        config.params = { ...(config.params ?? {}), _t: Date.now() }
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

      // 文件下载（如 CSV 导出）响应体不是 ApiResponse，直接放行
      if (response.config?.responseType === 'blob') {
        return response
      }
      const { code, message } = response.data
      if (code === 0) {
        return response
      }
      if (code === 401 && !window.location.pathname.includes('/login')) {
        return handleUnauthorized(response.config)
      }
      // M1：保留业务码与附加数据（如重单冲突摘要），供页面做二次确认
      const businessError = new Error(message || '请求失败') as Error & { code?: number; data?: unknown }
      businessError.code = code
      businessError.data = response.data?.data
      return Promise.reject(businessError)
    },
    (error) => {
      // HTTP 层 401（access token 过期）：同样走统一续期流程，避免误清登录态
      if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
        const config = error.config as (AxiosRequestConfig & { _retryAuth?: boolean }) | undefined
        if (config) {
          return handleUnauthorized(config)
        }
      }
      const responseData = error.response?.data
      // 下载类请求失败时响应体是 Blob，尝试解析其中的 JSON 错误信息
      if (responseData instanceof Blob) {
        return responseData.text().then((text) => {
          let message = error.message || '网络错误'
          try {
            const payload = JSON.parse(text) as { message?: string }
            if (payload?.message) message = payload.message
          } catch {
            // 非 JSON 响应保持原始错误信息
          }
          return Promise.reject(new Error(message))
        })
      }
      const msg = responseData?.message || error.message || '网络错误'
      const httpError = new Error(msg) as Error & { code?: number; data?: unknown }
      httpError.code = responseData?.code ?? error.response?.status
      httpError.data = responseData?.data
      return Promise.reject(httpError)
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

/**
 * 下载文件（Blob 响应，如 CSV 导出）
 * 响应拦截器已对 responseType === 'blob' 放行，不按 ApiResponse 解析
 */
export async function getBlob(url: string, params?: object, config?: AxiosRequestConfig): Promise<Blob> {
  const res = await request.get<Blob>(url, {
    ...config,
    params: params as Record<string, unknown>,
    responseType: 'blob',
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
