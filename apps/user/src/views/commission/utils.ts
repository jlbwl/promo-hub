/**
 * 佣金页共享纯函数：身份读取、脱敏、时间格式化、状态映射
 */
import type { TagType } from 'vant'
import { orderStatusText } from '@promo/shared/utils/helpers'

// 获取当前用户 ID
export const getUserId = () => {
  try {
    const info = JSON.parse(localStorage.getItem('user_info') || '{}') as { id?: string }
    return info.id || ''
  } catch (error) {
    console.warn('Failed to parse user_info from localStorage', error)
    return ''
  }
}

// 获取员工ID
export const getEmployeeId = () => {
  try {
    const info = JSON.parse(localStorage.getItem('employee_info') || '{}') as { id?: string }
    return info.id || ''
  } catch (error) {
    console.warn('Failed to parse employee_info from localStorage', error)
    return ''
  }
}

// 是否为员工账户
export const isEmployee = () => {
  return localStorage.getItem('login_type') === 'employee'
}

// 状态映射
export const statusType = (status: string): TagType => {
  const map: Record<string, TagType> = {
    pending: 'warning',
    approved: 'success',
    pending_payment: 'primary',
    settled: 'success',
    rejected: 'danger',
  }
  return map[status] || 'default'
}

// 状态文案
export const statusLabel = orderStatusText

// 脱敏与时间格式化统一使用 shared 实现（北京时区，分钟级）
export { formatTime, maskPhone, maskName } from '@promo/shared/utils/helpers'
