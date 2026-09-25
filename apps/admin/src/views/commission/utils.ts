/**
 * 佣金管理页共享纯函数：脱敏、时间格式化、状态映射
 */
import type { Manager } from '@promo/shared/types'

// 订单状态对应的标签类型
export const statusTagType = (s: string) => ({ pending: 'warning', approved: 'success', pending_payment: '', settled: 'success', rejected: 'danger' }[s] || 'info')

// 订单状态中文文案
export const statusText = (s: string) => ({ pending: '待审核', approved: '已通过', pending_payment: '待发放', settled: '已发放', rejected: '已驳回' }[s] || s)

// 脱敏与时间格式化统一使用 shared 实现（北京时区，分钟级）
export { formatTime, maskPhone, maskName } from '@promo/shared/utils/helpers'

// 根据经理 ID 获取经理团队名称
export const getManagerTeamName = (managers: Manager[], managerId: string) => {
  if (!managerId) return '--'
  const manager = managers.find(m => m.id === managerId)
  if (manager) {
    return manager.teamName || manager.name || manager.username || '--'
  }
  return '--'
}
