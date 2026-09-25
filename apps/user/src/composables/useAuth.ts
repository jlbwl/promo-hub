import { logger } from '@promo/shared/utils/logger'
import { ref } from 'vue'
import { get, refreshTokens } from '@promo/shared/utils/request'
import type { User } from '@promo/shared/types'

/**
 * 认证状态管理
 */
export function useAuth() {
  const isAuthenticated = ref(false)

  /**
   * 检查是否已登录（通过 Token）
   */
  const checkAuth = async (): Promise<boolean> => {
    const token = localStorage.getItem('user_token')
    
    if (!token) {
      isAuthenticated.value = false
      return false
    }

    try {
      // 尝试从本地存储获取用户信息
      const userInfoStr = localStorage.getItem('user_info')
      if (!userInfoStr) {
        isAuthenticated.value = false
        return false
      }

      const userInfo = JSON.parse(userInfoStr) as { id?: string }
      if (!userInfo.id) {
        isAuthenticated.value = false
        return false
      }

      // 验证 Token 是否有效（通过调用后端接口）
      const res = await get<User>(`/users/${userInfo.id}`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (res.code === 0) {
        // Token 有效，更新用户信息
        localStorage.setItem('user_info', JSON.stringify({
          ...userInfo,
          ...res.data
        }))
        isAuthenticated.value = true
        return true
      } else {
        // Token 无效，清除本地存储
        clearAuth()
        isAuthenticated.value = false
        return false
      }
    } catch (error) {
      logger.error('自动登录验证失败:', error)

      // 如果是 401 错误，说明 Token 已过期
      if ((error as { status?: number })?.status === 401 || (error as { statusCode?: number })?.statusCode === 401) {
        // 尝试使用 Refresh Token 刷新
        const refreshed = await refreshToken()
        if (refreshed) {
          isAuthenticated.value = true
          return true
        }
      }
      
      // 其他错误，清除本地存储
      clearAuth()
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
