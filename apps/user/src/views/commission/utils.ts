/**
 * 佣金页共享纯函数：身份读取、脱敏、时间格式化、状态映射
 */
import type { TagType } from 'vant'

// 获取当前用户 ID
export const getUserId = () => {
  try {
    const info = JSON.parse(localStorage.getItem('user_info') || '{}') as { id?: string }
    return info.id || ''
  } catch { return '' }
}

// 获取员工ID
export const getEmployeeId = () => {
  try {
    const info = JSON.parse(localStorage.getItem('employee_info') || '{}') as { id?: string }
    return info.id || ''
  } catch { return '' }
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

export const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending: '待审核',
    approved: '已通过',
    pending_payment: '待发放',
    settled: '已发放',
    rejected: '已驳回',
  }
  return map[status] || status
}

// 脱敏与时间格式化统一使用 shared 实现（北京时区，分钟级）
export { formatTime, maskPhone, maskName } from '@promo/shared/utils/helpers'
