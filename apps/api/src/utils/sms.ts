/**
 * 短信验证码存储（内存版）
 */
interface SmsCodeRecord {
  code: string
  expiresAt: number
}

const smsCodes = new Map<string, SmsCodeRecord>()

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
  })
}

/**
 * 验证验证码
 * @returns 验证是否通过
 */
export const verifySmsCode = (phone: string, code: string): boolean => {
  const record = smsCodes.get(phone)
  if (!record || Date.now() > record.expiresAt) {
    return false
  }
  return record.code === code
}

/**
 * 删除验证码
 */
export const deleteSmsCode = (phone: string): void => {
  smsCodes.delete(phone)
}
