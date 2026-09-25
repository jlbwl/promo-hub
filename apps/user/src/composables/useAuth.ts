import { logger } from '@promo/shared/utils/logger'
import { ref } from 'vue'
import { refreshTokens } from '@promo/shared/utils/request'

/**
 * 认证状态管理
 */
export function useAuth() {
  const isAuthenticated = ref(false)

  /**
   * 检查是否已登录（本地快验证）
   *
   * 刷新页面时不主动调用后端接口验证 token：
   * - token 与用户信息齐全即视为已登录，真实有效性由请求层统一保障
   *   （任一接口 401 时自动用 refresh token 续期，续期失败才清除登录态）
   * - 避免刷新页面时因验证接口偶发失败（网络抖动、鉴权中间件变化）误清登录态
   */
  const checkAuth = async (): Promise<boolean> => {
    const token = localStorage.getItem('user_token')

    if (!token) {
      isAuthenticated.value = false
      return false
    }

    const userInfoStr = localStorage.getItem('user_info')
    if (!userInfoStr) {
      isAuthenticated.value = false
      return false
    }

    try {
      const userInfo = JSON.parse(userInfoStr) as { id?: string }
      if (!userInfo.id) {
        // 用户信息损坏（缺少 id）：仅清理该项，保留 token 供重新拉取
        localStorage.removeItem('user_info')
        isAuthenticated.value = false
        return false
      }

      isAuthenticated.value = true
      return true
    } catch {
      // JSON 解析失败：用户信息损坏，仅清理该项
      localStorage.removeItem('user_info')
      isAuthenticated.value = false
      return false
    }
  }

  /**
   * 刷新 Access Token（复用 shared 统一实现：读取各角色 refresh token 调用 /auth/refresh）
   */
  const refreshToken = async (): Promise<boolean> => {
    try {
      await refreshTokens()
      return true
    } catch (error) {
      logger.error('刷新 Token 失败:', error)
      return false
    }
  }

  /**
   * 清除认证信息
   */
  const clearAuth = () => {
    localStorage.removeItem('user_token')
    localStorage.removeItem('user_info')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user_refresh_token')
    isAuthenticated.value = false
  }

  /**
   * 获取当前 Token
   */
  const getToken = (): string | null => {
    return localStorage.getItem('user_token')
  }

  /**
   * 获取当前用户信息
   */
  const getUserInfo = () => {
    const userInfoStr = localStorage.getItem('user_info')
    if (!userInfoStr) return null
    try {
      return JSON.parse(userInfoStr) as { id?: string }
    } catch {
      return null
    }
  }

  return {
    isAuthenticated,
    checkAuth,
    refreshToken,
    clearAuth,
    getToken,
    getUserInfo
  }
}
