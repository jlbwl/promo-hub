/**
 * 通用工具函数
 */

/** 格式化金额 */
export function formatMoney(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  }).format(value)
}

/** 格式化日期（北京时区 UTC+8） */
export function formatDate(date: string | Date, format = 'YYYY-MM-DD HH:mm:ss'): string {
  const d = new Date(date)
  const p = (n: number) => String(n).padStart(2, '0')
  
  // 获取北京时区时间（UTC+8）
  let year = d.getUTCFullYear()
  let month = d.getUTCMonth() + 1
  let day = d.getUTCDate()
  let hours = d.getUTCHours() + 8
  let minutes = d.getUTCMinutes()
  let seconds = d.getUTCSeconds()
  
  // 处理跨天、跨月、跨年情况
  if (hours >= 24) {
    hours -= 24
    day += 1
    
    const daysInMonth = new Date(year, month, 0).getDate()
    if (day > daysInMonth) {
      day = 1
      month += 1
      
      if (month > 12) {
        month = 1
        year += 1
      }
    }
  }
  
  const map: Record<string, string> = {
    'YYYY': String(year),
    'MM': p(month),
    'DD': p(day),
    'HH': p(hours),
    'mm': p(minutes),
    'ss': p(seconds),
  }
  let result = format
  for (const [key, val] of Object.entries(map)) {
    result = result.replace(key, val)
  }
  return result
}

/** 格式化时间（北京时区 UTC+8，分钟级 YYYY-MM-DD HH:mm；空值返回占位文本） */
export function formatTime(iso?: string, emptyText = ''): string {
  if (!iso) return emptyText
  return formatDate(iso, 'YYYY-MM-DD HH:mm')
}

/** 手机号脱敏（空值返回占位符，不足 7 位原样返回） */
export function maskPhone(phone: string | undefined): string {
  if (!phone || phone.length < 7) return phone || '--'
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

/** 姓名脱敏：保留首尾字符，中间以 * 代替（单字符原样，空值返回占位符） */
export function maskName(name: string | undefined): string {
  if (!name || name.length < 2) return name || '--'
  if (name.length === 2) return name[0] + '*'
  return name[0] + '*' + name.slice(-1)
}

/** 复制到剪贴板 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** 佣金状态映射 */
export const commissionStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: '#f59e0b' },
  approved: { label: '已通过', color: '#3b82f6' },
  paid: { label: '已发放', color: '#10b981' },
  rejected: { label: '已驳回', color: '#ef4444' },
}

/** 用户状态映射 */
export const userStatusMap: Record<string, { label: string; color: string }> = {
  active: { label: '正常', color: '#10b981' },
  inactive: { label: '未激活', color: '#9ca3af' },
  banned: { label: '已封禁', color: '#ef4444' },
}
