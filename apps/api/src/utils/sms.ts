/**
 * 短信验证码存储（内存版）- 安全增强版
 */
import crypto from 'crypto'
import { getErrorMessage } from '@promo/shared'
import logger from './logger.js'

interface SmsCodeRecord {
  code: string
  expiresAt: number
  used: boolean // 标记是否已使用
  failedAttempts?: number // 失败尝试次数（H9）
}

const smsCodes = new Map<string, SmsCodeRecord>()
// M12：used 记录带过期时间并设上限，避免只增不减常驻内存
const usedCodes = new Map<string, number>()
const USED_CODE_TTL_MS = 10 * 60 * 1000
const USED_CODES_MAX = 2000
const SMS_HTTP_TIMEOUT_MS = 5000
const isProd = process.env.NODE_ENV === 'production'

/** 清理过期验证码与超量 used 记录 */
function pruneSmsState(): void {
  const now = Date.now()
  for (const [phone, record] of smsCodes) {
    if (now > record.expiresAt) smsCodes.delete(phone)
  }
  for (const [key, expireAt] of usedCodes) {
    if (now > expireAt) usedCodes.delete(key)
  }
  if (usedCodes.size > USED_CODES_MAX) {
    const overflow = usedCodes.size - USED_CODES_MAX
    let removed = 0
    for (const key of usedCodes.keys()) {
      if (removed >= overflow) break
      usedCodes.delete(key)
      removed += 1
    }
  }
}

/**
 * 生成随机验证码（H9：使用密码学安全随机数，杜绝可预测性）
 */
export const generateSmsCode = (): string => {
  return crypto.randomInt(100000, 1000000).toString()
}

/**
 * 保存验证码
 */
export const saveSmsCode = (phone: string, code: string, expiresInSeconds = 300): void => {
  pruneSmsState()
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
    // H9：同一验证码连续失败 5 次立即作废，阻断无限试错
    record.failedAttempts = (record.failedAttempts || 0) + 1
    if (record.failedAttempts >= 5) {
      smsCodes.delete(phone)
    }
    return false
  }
  
  // 标记为已使用（原子操作）
  record.used = true
  const usedKey = `${phone}:${code}`
  usedCodes.set(usedKey, Date.now() + USED_CODE_TTL_MS)
  pruneSmsState()
  
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
  const expireAt = usedCodes.get(usedKey)
  if (!expireAt) return false
  if (Date.now() > expireAt) {
    usedCodes.delete(usedKey)
    return false
  }
  return true
}

const SMS_CONFIG = {
  accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '',
  signName: process.env.ALIBABA_CLOUD_SIGN_NAME || process.env.ALIBABA_CLOUD_SMS_SIGN_NAME || '金卢比',
  templateCode: process.env.ALIBABA_CLOUD_TEMPLATE_CODE || process.env.ALIBABA_CLOUD_SMS_TEMPLATE_CODE || 'SMS_333916680',
}

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~')
}

function sign(accessKeySecret: string, parameters: Record<string, string>): string {
  const sorted = Object.keys(parameters).sort()
  const paramString = sorted.map(k => `${percentEncode(k)}=${percentEncode(parameters[k])}`).join('&')
  const stringToSign = `GET&%2F&${percentEncode(paramString)}`
  const hmac = crypto.createHmac('sha1', `${accessKeySecret}&`)
  return hmac.update(stringToSign).digest('base64')
}

function getTimestamp(): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const day = String(now.getUTCDate()).padStart(2, '0')
  const hours = String(now.getUTCHours()).padStart(2, '0')
  const minutes = String(now.getUTCMinutes()).padStart(2, '0')
  const seconds = String(now.getUTCSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`
}

export async function sendSmsCode(phone: string, code: string): Promise<{ success: boolean; message: string }> {
  if (!SMS_CONFIG.accessKeyId || !SMS_CONFIG.accessKeySecret) {
    if (isProd) {
      // M12：生产未配置 AK 必须失败并告警，避免接口假成功、用户收不到验证码
      logger.error('[SMS] 生产环境未配置阿里云短信 AK，拒绝发送')
      return { success: false, message: '短信服务未配置' }
    }
    return { success: true, message: '开发模式：验证码仅打印到日志' }
  }

  try {
    const parameters: Record<string, string> = {
      AccessKeyId: SMS_CONFIG.accessKeyId,
      Action: 'SendSms',
      Format: 'JSON',
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      SignatureVersion: '1.0',
      TemplateCode: SMS_CONFIG.templateCode,
      Timestamp: getTimestamp(),
      Version: '2017-05-25',
      PhoneNumbers: phone,
      SignName: SMS_CONFIG.signName,
      TemplateParam: JSON.stringify({ code }),
    }

    const signature = sign(SMS_CONFIG.accessKeySecret, parameters)
    const sortedParams = Object.keys(parameters).sort()
    const queryString = sortedParams.map(k => `${percentEncode(k)}=${percentEncode(parameters[k])}`).join('&')
    const url = `https://dysmsapi.aliyuncs.com/?Signature=${percentEncode(signature)}&${queryString}`

    // M12：外部 HTTP 请求必须有超时，避免阿里云无响应时发码接口长时间悬挂
    const response = await fetch(url, { signal: AbortSignal.timeout(SMS_HTTP_TIMEOUT_MS) })
    const result = await response.json()

    if (result.Code === 'OK') {
      return { success: true, message: '发送成功' }
    } else {
      // 携带阿里云错误码，便于上层日志定位（如 InvalidAccessKeyId.Inactive、BUSINESS_LIMIT_CONTROL）
      return { success: false, message: `阿里云短信接口返回 ${result.Code}: ${result.Message || '未知错误'}` }
    }
  } catch (error) {
    return { success: false, message: getErrorMessage(error, '发送异常') }
  }
}
