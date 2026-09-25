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

// 格式化时间
export const formatTime = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const maskPhone = (phone: string) => {
  if (!phone || phone.length < 7) return phone || '--'
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

export const maskName = (name: string) => {
  if (!name || name.length < 2) return name || '--'
  if (name.length === 2) return name[0] + '*'
  return name[0] + '*' + name.slice(-1)
}
