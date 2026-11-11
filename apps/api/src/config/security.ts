/**
 * 安全相关可调参数
 *
 * 阈值统一从环境变量读取，未配置时使用保守默认值；业务代码只引用这里，
 * 不直接硬编码数字，便于按线上实际流量调整而不改代码。
 */

const readPositiveInt = (name: string, fallback: number): number => {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * 短信验证码发送限流
 *
 * - 号码维度：挡住对同一号码的短信轰炸（换 IP 也绕不过）
 * - 来源维度：挡住批量遍历手机号的探测/成本消耗
 * - 分钟 + 日两个窗口：分钟窗口抑制高频重试，日窗口封顶单日成本
 */
export const smsRateLimitConfig = {
  /** 同一号码每分钟最多发送次数 */
  phonePerMinute: readPositiveInt('SMS_RATE_PHONE_PER_MINUTE', 1),
  /** 同一号码每天最多发送次数 */
  phonePerDay: readPositiveInt('SMS_RATE_PHONE_PER_DAY', 5),
  /** 同一来源 IP 每天最多发送次数（批量遍历号码时命中） */
  ipPerDay: readPositiveInt('SMS_RATE_IP_PER_DAY', 20),
}
