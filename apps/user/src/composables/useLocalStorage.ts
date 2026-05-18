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
      console.error(`[useLocalStorage] 设置失败:`, error)
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
 * 获取用户信息
 */
export function useUser() {
  const storage = useLocalStorage<any>('user_info', {})
  const loginType = useLocalStorage<string>('login_type', '')

  const getUserId = (): string => {
    const info = storage.get()
    return info.id || ''
  }

  const getManagerId = (): string => {
    const info = storage.get()
    return info.managerId || ''
  }

  const getUserInfo = () => storage.get

  const isEmployee = (): boolean => {
    return loginType.get() === 'employee'
  }

  return {
    getUserId,
    getManagerId,
    getUserInfo,
    isEmployee
  }
}
