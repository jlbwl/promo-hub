import crypto from 'crypto'

const SMS_CONFIG = {
  accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '',
  signName: process.env.ALIBABA_CLOUD_SMS_SIGN_NAME || '金卢比网络',
  templateCode: process.env.ALIBABA_CLOUD_SMS_TEMPLATE_CODE || 'SMS_333916680',
}

function sign(accessKeySecret: string, parameters: Record<string, string>): string {
  const sorted = Object.keys(parameters).sort()
  const stringToSign = sorted.map(k => `${k}=${encodeURIComponent(parameters[k])}`).join('&')
  const hmac = crypto.createHmac('sha1', accessKeySecret + '&')
  return hmac.update(stringToSign).digest('base64')
}

export async function sendSmsCode(phone: string, code: string): Promise<{ success: boolean; message: string }> {
  if (!SMS_CONFIG.accessKeyId || !SMS_CONFIG.accessKeySecret) {
    console.log(`[SMS-DEV] 手机号 ${phone} 验证码: ${code}`)
    return { success: true, message: '开发模式：验证码仅打印到日志' }
  }

  try {
    const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '')
    const parameters: Record<string, string> = {
      AccessKeyId: SMS_CONFIG.accessKeyId,
      Action: 'SendSms',
      Format: 'JSON',
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      SignatureVersion: '1.0',
      TemplateCode: SMS_CONFIG.templateCode,
      Timestamp: timestamp,
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