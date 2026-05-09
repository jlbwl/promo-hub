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
  // 转换为北京时区（UTC+8）
  const utc = d.getTime() + d.getTimezoneOffset() * 60000
  const beijingTime = new Date(utc + 8 * 3600000)
  
  const map: Record<string, string> = {
    'YYYY': String(beijingTime.getFullYear()),
    'MM': String(beijingTime.getMonth() + 1).padStart(2, '0'),
    'DD': String(beijingTime.getDate()).padStart(2, '0'),
    'HH': String(beijingTime.getHours()).padStart(2, '0'),
    'mm': String(beijingTime.getMinutes()).padStart(2, '0'),
    'ss': String(beijingTime.getSeconds()).padStart(2, '0'),
  }
  let result = format
  for (const [key, val] of Object.entries(map)) {
    result = result.replace(key, val)
  }
  return result
}

/** 手机号脱敏 */
export function maskPhone(phone: string): string {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
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
