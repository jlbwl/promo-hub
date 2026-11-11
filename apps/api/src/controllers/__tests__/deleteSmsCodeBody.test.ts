import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response } from 'express'

vi.hoisted(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
})

vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  },
  maskPhone: vi.fn((phone: string) => (phone ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : '')),
}))

vi.mock('../../data/index.js', () => ({
  readUsers: vi.fn(),
  readUsersPaged: vi.fn(),
  updateUser: vi.fn(),
  readManagers: vi.fn(),
  updateManager: vi.fn(),
  readManager: vi.fn(),
  withTransaction: vi.fn(),
}))

vi.mock('../../db.js', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  withTransaction: vi.fn(),
}))

vi.mock('../../utils/sms.js', () => ({
  verifySmsCode: vi.fn(),
  sendSmsCode: vi.fn(),
  generateSmsCode: vi.fn(),
  saveSmsCode: vi.fn(),
  deleteSmsCode: vi.fn(),
}))

vi.mock('../../utils/auditLog.js', () => ({
  logAdminOperation: vi.fn(),
}))

vi.mock('../../utils/auditDetail.js', () => ({
  buildAuditDetail: vi.fn(() => ({})),
}))

import { readUsers, readManager, withTransaction } from '../../data/index.js'
import { withTransaction as dbWithTransaction } from '../../db.js'
import { verifySmsCode } from '../../utils/sms.js'
import { deleteUser } from '../user-admin.controller.js'
import { deleteManagerWithCascade } from '../manager.controller.js'

const makeRes = () => {
  const res = { status: vi.fn(), json: vi.fn(), setHeader: vi.fn() }
  res.status.mockReturnValue(res)
  return res as unknown as Response & typeof res
}

const bodyOf = (res: ReturnType<typeof makeRes>) => res.json.mock.calls[0]?.[0] as { code?: number; message?: string }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(verifySmsCode).mockReturnValue(true)
  vi.mocked(withTransaction).mockResolvedValue(undefined)
})

describe('删除操作的一次性验证码改由请求体传递', () => {
  it('deleteUser：从请求体读取验证码并校验', async () => {
    vi.mocked(readUsers).mockResolvedValueOnce([
      { id: 'u_1', nickname: '张三', phone: '13800138000', status: 'active' },
    ] as never)
    const req = {
      body: { smsCode: '123456' },
      query: {},
      params: { id: 'u_1' },
      user: { id: 'a_1', phone: '13900139000', role: 'admin' },
    } as unknown as Request
    const res = makeRes()
    const next = vi.fn()

    await deleteUser(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(verifySmsCode).toHaveBeenCalledWith('13900139000', '123456')
    expect(bodyOf(res).code).toBe(0)
  })

  it('deleteUser：验证码只放在 query 时不再接受', async () => {
    vi.mocked(readUsers).mockResolvedValueOnce([
      { id: 'u_1', nickname: '张三', phone: '13800138000', status: 'active' },
    ] as never)
    const req = {
      body: {},
      query: { smsCode: '123456' },
      params: { id: 'u_1' },
      user: { id: 'a_1', phone: '13900139000', role: 'admin' },
    } as unknown as Request
    const next = vi.fn()

    await deleteUser(req, makeRes(), next)

    expect(next).toHaveBeenCalled()
    const err = next.mock.calls[0][0] as { statusCode?: number; message?: string }
    expect(err.statusCode).toBe(400)
    expect(err.message).toContain('验证码')
    expect(withTransaction).not.toHaveBeenCalled()
  })

  it('deleteManagerWithCascade：从请求体读取验证码并校验', async () => {
    vi.mocked(readManager).mockResolvedValueOnce({ id: 'm_1', name: '经理A', phone: '13700137000' } as never)
    const req = {
      body: { smsCode: '654321' },
      query: {},
      params: { id: 'm_1' },
      user: { id: 'a_1', phone: '13900139000', role: 'admin' },
    } as unknown as Request
    const res = makeRes()

    await deleteManagerWithCascade(req, res)

    expect(verifySmsCode).toHaveBeenCalledWith('13900139000', '654321')
    expect(bodyOf(res).code).toBe(0)
  })

  it('deleteManagerWithCascade：验证码只放在 query 时不再接受', async () => {
    const req = {
      body: {},
      query: { smsCode: '654321' },
      params: { id: 'm_1' },
      user: { id: 'a_1', phone: '13900139000', role: 'admin' },
    } as unknown as Request
    const res = makeRes()

    await deleteManagerWithCascade(req, res)

    expect(bodyOf(res).code).toBe(400)
    expect(dbWithTransaction).not.toHaveBeenCalled()
  })
})
