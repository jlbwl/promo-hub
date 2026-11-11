/**
 * 手机号脱敏：保留前 3 位与后 4 位
 *
 * 独立于 logger，避免各处日志 mock 漏掉该工具函数；任何写日志的地方都必须先经过它。
 */
export const maskPhone = (phone?: string | null): string => {
  if (!phone) return ''
  const value = String(phone)
  if (value.length <= 7) return '***'
  return `${value.slice(0, 3)}****${value.slice(-4)}`
}
