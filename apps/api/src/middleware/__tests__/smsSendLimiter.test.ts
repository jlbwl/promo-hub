import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Request, Response } from 'express'
import { smsSendLimiter } from '../smsSendLimiter.js'
import { smsRateLimitConfig } from '../../config/security.js'

const makeRes = () => {
  const res = {
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  }
  res.status.mockReturnValue(res)
  return res as unknown as Response & typeof res
}

const run = (phone: unknown, ip: string) => {
  const req = { body: { phone }, ip } as unknown as Request
  const res = makeRes()
  const next = vi.fn()
  smsSendLimiter(req, res, next)
  return { res, next, status: res.status.mock.calls[0]?.[0], body: res.json.mock.calls[0]?.[0] }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('短信发送限流（按号码 + 按来源）', () => {
  it('配置项从环境变量读取，业务逻辑不硬编码阈值', () => {
    expect(smsRateLimitConfig.phonePerMinute).toBeGreaterThan(0)
    expect(smsRateLimitConfig.phonePerDay).toBeGreaterThanOrEqual(smsRateLimitConfig.phonePerMinute)
    expect(smsRateLimitConfig.ipPerDay).toBeGreaterThan(0)
  })

  it('同一号码 1 分钟内重复发送被拒绝（429）', () => {
    const phone = '13900000001'
    expect(run(phone, '10.0.0.1').next).toHaveBeenCalled()

    const second = run(phone, '10.0.0.2')
    expect(second.next).not.toHaveBeenCalled()
    expect(second.status).toBe(429)
    expect(second.body).toMatchObject({ code: 429 })
    expect(second.res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String))
  })

  it('换来源 IP 也无法绕过号码维度限制', () => {
    const phone = '13900000002'
    run(phone, '10.0.1.1')
    const blocked = run(phone, '10.0.1.2')
    expect(blocked.status).toBe(429)
    expect(blocked.next).not.toHaveBeenCalled()
  })

  it('同一号码超出分钟窗口后可再次发送', () => {
    vi.useFakeTimers()
    const phone = '13900000003'
    expect(run(phone, '10.0.2.1').next).toHaveBeenCalled()
    vi.advanceTimersByTime(61 * 1000)
    expect(run(phone, '10.0.2.1').next).toHaveBeenCalled()
  })

  it('同一号码单日发送次数达到上限后被拒绝', () => {
    vi.useFakeTimers()
    const phone = '13900000004'
    for (let i = 0; i < smsRateLimitConfig.phonePerDay; i += 1) {
      expect(run(phone, '10.0.3.1').next).toHaveBeenCalled()
      vi.advanceTimersByTime(61 * 1000)
    }
    const blocked = run(phone, '10.0.3.1')
    expect(blocked.status).toBe(429)
  })

  it('同一来源批量遍历不同号码时按来源日上限拦截', () => {
    const ip = '10.0.4.1'
    for (let i = 0; i < smsRateLimitConfig.ipPerDay; i += 1) {
      const phone = `1370000${String(i).padStart(4, '0')}`
      expect(run(phone, ip).next).toHaveBeenCalled()
    }
    const blocked = run('13799999999', ip)
    expect(blocked.status).toBe(429)
    expect(blocked.next).not.toHaveBeenCalled()
  })

  it('手机号缺失时不拦截，交给控制器做格式校验', () => {
    expect(run(undefined, '10.0.5.1').next).toHaveBeenCalled()
  })
})
