/**
 * 佣金管理页共享纯函数：脱敏、时间格式化、状态映射、经理身份读取
 */

// 订单状态对应的标签类型
export const statusTagType = (status: string) => {
  const map: Record<string, string> = {
    pending: 'warning',
    approved: 'success',
    pending_payment: '',
    settled: 'success',
    rejected: 'danger',
  }
  return map[status] || 'info'
}

// 订单状态中文文案
export const statusText = (status: string) => {
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

// 获取当前经理 ID
export const getManagerId = () => {
  try {
    const info = JSON.parse(localStorage.getItem('manager_info') || '{}')
    return info.id || ''
  } catch { return '' }
}
