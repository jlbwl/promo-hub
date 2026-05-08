import Dysmsapi20170525, * as Dysmsapi20170525Module from '@alicloud/dysmsapi20170525'
import * as OpenApi from '@alicloud/openapi-client'
import * as Util from '@alicloud/tea-util'

const SMS_CONFIG = {
  accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || '',
  signName: process.env.ALIBABA_CLOUD_SMS_SIGN_NAME || '金卢比网络',
  templateCode: process.env.ALIBABA_CLOUD_SMS_TEMPLATE_CODE || 'SMS_333916680',
}

let smsClient: Dysmsapi20170525 | null = null

function getSmsClient(): Dysmsapi20170525 {
  if (!smsClient) {
    const config = new OpenApi.Config({
      accessKeyId: SMS_CONFIG.accessKeyId,
      accessKeySecret: SMS_CONFIG.accessKeySecret,
    })
    config.endpoint = 'dysmsapi.aliyuncs.com'
    smsClient = new Dysmsapi20170525(config)
  }
  return smsClient
}

export async function sendSmsCode(phone: string, code: string): Promise<{ success: boolean; message: string }> {
  if (!SMS_CONFIG.accessKeyId || !SMS_CONFIG.accessKeySecret) {
    console.log(`[SMS-DEV] 手机号 ${phone} 验证码: ${code}`)
    return { success: true, message: '开发模式：验证码仅打印到日志' }
  }

  try {
    const sendRequest = new Dysmsapi20170525Module.SendSmsRequest({
      phoneNumbers: phone,
      signName: SMS_CONFIG.signName,
      templateCode: SMS_CONFIG.templateCode,
      templateParam: JSON.stringify({ code }),
    })

    const runtime = new Util.RuntimeOptions({})
    const client = getSmsClient()

    const result = await client.sendSmsWithOptions(sendRequest, runtime)

    if (result.body?.code === 'OK') {
      console.log(`[SMS] 发送成功 ${phone}: ${code}`)
      return { success: true, message: '发送成功' }
    } else {
      console.error(`[SMS] 发送失败 ${phone}:`, result.body?.message)
      return { success: false, message: result.body?.message || '发送失败' }
    }
  } catch (error: any) {
    console.error(`[SMS] 发送异常 ${phone}:`, error.message)
    return { success: false, message: error.message || '发送异常' }
  }
}