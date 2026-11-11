import { Request, Response, NextFunction } from 'express'
import { sendError } from '../utils/response.js'
import { smsRateLimitConfig } from '../config/security.js'

/**
 * 短信验证码发送限流（按手机号 + 按来源）
 *
 * 已有的 `smsLimiter`（express-rate-limit）只按 IP 3/min，换 IP 即可对同一号码
 * 无限发送，也无法约束单日成本。这里补充两个维度：
 * - 同一号码：1 分钟 1 次、每天 5 次（换 IP 也绕不过）
 * - 同一来源 IP：每天 20 次（抑制批量遍历手机号）
 *
 * 计数为进程内固定窗口，与现有 rate-limit MemoryStore 一致。
 * 注意：改 cluster/多实例前必须换成 Redis 计数器，否则每个进程各算一份。
 */

interface Counter {
  count: number
  resetAt: number
}

const MINUTE_MS = 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const MAX_COUNTERS = 10000

const counters = new Map<string, Counter>()

const pruneExpired = (now: number): void => {
  if (counters.size < MAX_COUNTERS) return
  for (const [key, counter] of counters) {
    if (counter.resetAt <= now) counters.delete(key)
  }
}

/** 只读检查，不消耗配额 */
const check = (key: string, limit: number, now: number) => {
  const counter = counters.get(key)
  if (!counter || counter.resetAt <= now) {
    return { blocked: false, retryAfterMs: 0, limit }
  }
  if (counter.count >= limit) {
    return { blocked: true, retryAfterMs: counter.resetAt - now, limit }
  }
  return { blocked: false, retryAfterMs: 0, limit }
}

/** 全部维度都通过后才统一自增，避免被拦截的请求白白消耗其它维度配额 */
const consume = (key: string, windowMs: number, now: number): void => {
  const counter = counters.get(key)
  if (!counter || counter.resetAt <= now) {
    counters.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  counter.count += 1
}

export const smsSendLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const rawPhone = (req.body as { phone?: unknown } | undefined)?.phone
  const phone = typeof rawPhone === 'string' ? rawPhone.trim() : ''
  // 号码缺失/非字符串交给控制器做格式校验，这里不重复报错
  if (!phone) {
    next()
    return
  }

  const now = Date.now()
  const ip = req.ip || req.socket?.remoteAddress || 'unknown'

  const targets: Array<{ key: string; windowMs: number; limit: number }> = [
    { key: `sms:rl:phone:1m:${phone}`, windowMs: MINUTE_MS, limit: smsRateLimitConfig.phonePerMinute },
    { key: `sms:rl:phone:1d:${phone}`, windowMs: DAY_MS, limit: smsRateLimitConfig.phonePerDay },
    { key: `sms:rl:ip:1d:${ip}`, windowMs: DAY_MS, limit: smsRateLimitConfig.ipPerDay },
  ]

  const blocked = targets
    .map(target => ({ ...check(target.key, target.limit, now), target }))
    .find(result => result.blocked)

  if (blocked) {
    const retryAfterSeconds = Math.max(1, Math.ceil(blocked.retryAfterMs / 1000))
    res.setHeader('Retry-After', String(retryAfterSeconds))
    res.setHeader('X-RateLimit-Limit', String(blocked.limit))
    sendError(res, '验证码发送过于频繁，请稍后再试', 429)
    return
  }

  pruneExpired(now)
  for (const target of targets) {
    consume(target.key, target.windowMs, now)
  }
  next()
}
