/**
 * 佣金管理页共享纯函数：脱敏、时间格式化、状态映射
 */
import type { Manager } from '@promo/shared/types'

// 订单状态对应的标签类型
export const statusTagType = (s: string) => ({ pending: 'warning', approved: 'success', pending_payment: '', settled: 'success', rejected: 'danger' }[s] || 'info')

// 订单状态中文文案
export const statusText = (s: string) => ({ pending: '待审核', approved: '已通过', pending_payment: '待发放', settled: '已发放', rejected: '已驳回' }[s] || s)

// 格式化时间为北京时区（UTC+8）字符串
export const formatTime = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  // 获取北京时区时间（UTC+8）
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth() + 1
  let day = d.getUTCDate()
  let hours = d.getUTCHours() + 8
  // 处理跨天情况
  if (hours >= 24) {
    hours -= 24
    day += 1
  }
  return `${year}-${p(month)}-${p(day)} ${p(hours)}:${p(d.getUTCMinutes())}`
}

// 手机号脱敏（接口冗余字段可能缺省）
export const maskPhone = (phone: string | undefined) => {
  if (!phone || phone.length < 7) return phone || '--'
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

// 姓名脱敏（接口冗余字段可能缺省）
export const maskName = (name: string | undefined) => {
  if (!name) return '--'
  if (name.length <= 1) return name
  if (name.length === 2) return name[0] + '*'
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
}

// 根据经理 ID 获取经理团队名称
export const getManagerTeamName = (managers: Manager[], managerId: string) => {
  if (!managerId) return '--'
  const manager = managers.find(m => m.id === managerId)
  if (manager) {
    return manager.teamName || manager.name || manager.username || '--'
  }
  return '--'
}
