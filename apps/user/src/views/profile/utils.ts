/**
 * 个人中心页共享纯函数：手机号脱敏
 */

// 手机号脱敏
export const maskPhone = (phone: string) => {
  if (!phone) return '--'
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}
