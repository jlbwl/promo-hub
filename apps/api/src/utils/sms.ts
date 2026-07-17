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

import crypto from 'crypto'

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

    const response = await fetch(url)
    const result = await response.json()

    if (result.Code === 'OK') {
      return { success: true, message: '发送成功' }
    } else {
      return { success: false, message: result.Message || '发送失败' }
    }
  } catch (error: any) {
    return { success: false, message: error.message || '发送异常' }
  }
}
