/**
 * 佣金管理页共享纯函数：脱敏、时间格式化、状态映射、经理身份读取
 */
import { orderStatusTagType, orderStatusText } from '@promo/shared/utils/helpers'

// 订单状态对应的标签类型
export const statusTagType = orderStatusTagType

// 订单状态中文文案
export const statusText = orderStatusText

// 脱敏与时间格式化统一使用 shared 实现（北京时区，分钟级）
export { formatTime, maskPhone, maskName } from '@promo/shared/utils/helpers'

// 获取当前经理 ID
export const getManagerId = () => {
  try {
    const info = JSON.parse(localStorage.getItem('manager_info') || '{}')
    return info.id || ''
  } catch (error) {
    console.warn('Failed to parse manager_info from localStorage', error)
    return ''
  }
}
