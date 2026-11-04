/**
 * 佣金管理页共享纯函数：脱敏、时间格式化、状态映射
 */
import type { Manager } from '@promo/shared/types'
import { orderStatusTagType, orderStatusText } from '@promo/shared/utils/helpers'

// 订单状态对应的标签类型
export const statusTagType = orderStatusTagType

// 订单状态中文文案
export const statusText = orderStatusText

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
