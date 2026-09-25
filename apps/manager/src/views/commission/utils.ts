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

// 格式化时间（北京时区 UTC+8）
export const formatTime = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
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
  return `${year}-${pad(month)}-${pad(day)} ${pad(hours)}:${pad(d.getUTCMinutes())}`
}

// 手机号脱敏（接口冗余字段可能缺省）
export const maskPhone = (phone: string) => {
  if (!phone || phone.length < 7) return phone || '--'
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

// 姓名脱敏（接口冗余字段可能缺省）
export const maskName = (name: string) => {
  if (!name || name.length < 2) return name || '--'
  if (name.length === 2) return name[0] + '*'
  return name[0] + '*' + name.slice(-1)
}

// 获取当前经理 ID
export const getManagerId = () => {
  try {
    const info = JSON.parse(localStorage.getItem('manager_info') || '{}')
    return info.id || ''
  } catch { return '' }
}
