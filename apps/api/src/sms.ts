import crypto from 'crypto'

const SMS_CONFIG = {
  accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '',
  signName: process.env.ALIBABA_CLOUD_SMS_SIGN_NAME || '金卢比网络',
  templateCode: process.env.ALIBABA_CLOUD_SMS_TEMPLATE_CODE || 'SMS_333916680',
}

function sign(accessKeySecret: string, parameters: Record<string, string>): string {
  const sorted = Object.keys(parameters).sort()
  let stringToSign = 'GET&%2F&'
  const encodedParams = sorted.map(k => {
    const encodedKey = encodeURIComponent(k).replace(/\+/g, '%20').replace(/\*/g, '%2A').replace(/%7E/g, '~')
    const encodedValue = encodeURIComponent(parameters[k]).replace(/\+/g, '%20').replace(/\*/g, '%2A').replace(/%7E/g, '~')
    return `${encodedKey}%3D${encodedValue}`
  }).join('%26')
  stringToSign += encodedParams
  const hmac = crypto.createHmac('sha1', accessKeySecret + '&')
  return hmac.update(stringToSign).digest('base64')
}

function getTimestamp(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`
}

export async function sendSmsCode(phone: string, code: string): Promise<{ success: boolean; message: string }> {
  if (!SMS_CONFIG.accessKeyId || !SMS_CONFIG.accessKeySecret) {
    console.log(`[SMS-DEV] 手机号 ${phone} 验证码: ${code}`)
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
    const queryString = sortedParams.map(k => `${k}=${encodeURIComponent(parameters[k])}`).join('&')
    const url = `https://dysmsapi.aliyuncs.com/?Signature=${encodeURIComponent(signature)}&${queryString}`

    const response = await fetch(url)
    const result = await response.json()

    if (result.Code === 'OK') {
      console.log(`[SMS] 发送成功 ${phone}: ${code}`)
      return { success: true, message: '发送成功' }
    } else {
      console.error(`[SMS] 发送失败 ${phone}:`, result.Message)
      return { success: false, message: result.Message || '发送失败' }
    }
  } catch (error: any) {
    console.error(`[SMS] 发送异常 ${phone}:`, error.message)
    return { success: false, message: error.message || '发送异常' }
  }
}