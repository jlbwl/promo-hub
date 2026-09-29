import { logger } from '@promo/shared/utils/logger'

/**
 * 本地存储操作的通用 composable
 * 提供类型安全的 localStorage 操作方法
 */

/**
 * 从 localStorage 获取数据
 */
export function useLocalStorage<T>(key: string, defaultValue: T) {
  const get = (): T => {
    try {
      const item = localStorage.getItem(key)
      if (!item) return defaultValue
      return JSON.parse(item) as T
    } catch {
      return defaultValue
    }
  }

  const set = (value: T) => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      logger.error(`[useLocalStorage] 设置失败:`, error)
    }
  }

  const remove = () => {
    localStorage.removeItem(key)
  }

  return {
    get,
    set,
    remove
  }
}

/**
 * user_info 在 localStorage 中的存储结构
 */
export interface StoredUserInfo {
  id?: string
  managerId?: string
  nickname?: string
  avatar?: string
  phone?: string
  teamName?: string
}

/**
 * 获取用户信息
 */
export function useUser() {
  const storage = useLocalStorage<StoredUserInfo>('user_info', {})

  const getUserId = (): string => {
    const info = storage.get()
    return info.id || ''
  }

  const getManagerId = (): string => {
    const info = storage.get()
    return info.managerId || ''
  }

  const getUserInfo = () => storage.get

  // login_type 全项目以原始字符串写入/比较（见 LoginView/EmployeeLoginView），不走 JSON 序列化
  const isEmployee = (): boolean => {
    return localStorage.getItem('login_type') === 'employee'
  }

  return {
    getUserId,
    getManagerId,
    getUserInfo,
    isEmployee
  }
}
