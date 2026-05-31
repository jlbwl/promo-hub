/**
 * 短信验证码存储（内存版）- 安全增强版
 */
interface SmsCodeRecord {
  code: string
  expiresAt: number
  used: boolean // 标记是否已使用
}

const smsCodes = new Map<string, SmsCodeRecord>()
const usedCodes = new Set<string>() // 记录已使用的验证码，防止重放攻击

/**
 * 生成随机验证码
 */
export const generateSmsCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * 保存验证码
 */
export const saveSmsCode = (phone: string, code: string, expiresInSeconds = 300): void => {
  smsCodes.set(phone, {
    code,
    expiresAt: Date.now() + expiresInSeconds * 1000,
    used: false,
  })
}

/**
 * 验证并消费验证码（原子操作，确保只能用一次）
 * @returns 验证是否通过，验证后验证码自动失效
 */
export const consumeSmsCode = (phone: string, code: string): boolean => {
  const record = smsCodes.get(phone)
  
  // 检查验证码是否存在
  if (!record) {
    return false
  }
  
  // 检查是否已过期
  if (Date.now() > record.expiresAt) {
    smsCodes.delete(phone)
    return false
  }
  
  // 检查是否已使用（防止重放攻击）
  if (record.used) {
    return false
  }
  
  // 验证验证码是否匹配
  if (record.code !== code) {
    return false
  }
  
  // 标记为已使用（原子操作）
  record.used = true
  const usedKey = `${phone}:${code}`
  usedCodes.add(usedKey)
  
  // 立即删除验证码，防止再次使用
  smsCodes.delete(phone)
  
  return true
}

/**
 * 验证验证码（旧方法，保留兼容性）
 * @returns 验证是否通过
 */
export const verifySmsCode = (phone: string, code: string): boolean => {
  return consumeSmsCode(phone, code)
}

/**
 * 删除验证码
 */
export const deleteSmsCode = (phone: string): void => {
  smsCodes.delete(phone)
}

/**
 * 检查验证码是否已使用
 */
export const isSmsCodeUsed = (phone: string, code: string): boolean => {
  const usedKey = `${phone}:${code}`
  return usedCodes.has(usedKey)
}
