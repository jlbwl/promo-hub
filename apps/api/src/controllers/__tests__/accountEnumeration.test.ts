import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response } from 'express'

vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  },
}))

vi.mock('../../data/index.js', () => ({
  readUsers: vi.fn(),
  readUser: vi.fn(),
  insertUser: vi.fn(),
  updateUser: vi.fn(),
  touchUserLastLogin: vi.fn(),
  readManagers: vi.fn(),
  readManager: vi.fn(),
  insertManager: vi.fn(),
  updateManager: vi.fn(),
  readAdminByPhone: vi.fn(),
  updateAdmin: vi.fn(),
  readOperationLogs: vi.fn(),
  readOperationLogAdmins: vi.fn(),
  readProducts: vi.fn(),
  updateProduct: vi.fn(),
  query: vi.fn(),
  queryOne: vi.fn(),
  deserialize: vi.fn(),
  withTransaction: vi.fn(),
}))

vi.mock('../../db.js', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  withTransaction: vi.fn(),
}))

vi.mock('../../middleware/auth.js', () => ({
  generateAuthToken: vi.fn(),
  generateTokens: vi.fn(),
  refreshAuthToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeAllRefreshTokens: vi.fn(),
  blacklistAccessToken: vi.fn(),
}))

vi.mock('../../utils/sms.js', () => ({
  sendSmsCode: vi.fn(),
  generateSmsCode: vi.fn(),
  saveSmsCode: vi.fn(),
  verifySmsCode: vi.fn(),
  deleteSmsCode: vi.fn(),
}))

vi.mock('../../utils/password.js', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed_password'),
  verifyPassword: vi.fn(),
}))

vi.mock('../../services/index.js', () => ({
  userService: { smsLogin: vi.fn() },
}))

vi.mock('../../services/cache/index.js', () => ({
  CacheService: class {},
  getCacheService: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    deletePattern: vi.fn(),
  })),
  CacheKeys: {
    productDetail: vi.fn(),
    productList: vi.fn(),
  },
}))

vi.mock('../../utils/auditLog.js', () => ({
  logAdminOperation: vi.fn(),
}))

import { readUsers, readManagers, readAdminByPhone, insertUser, queryOne } from '../../data/index.js'
import { verifySmsCode, sendSmsCode } from '../../utils/sms.js'
import { verifyPassword } from '../../utils/password.js'
import { registerUser } from '../user-register.controller.js'
import { userLogin } from '../user-login.controller.js'
import { sendAdminSmsCode, adminSmsLogin, adminLogin } from '../admin.controller.js'
import { sendManagerSmsCode, managerSmsLogin, managerLogin } from '../manager.controller.js'

type Handler = (req: Request, res: Response) => Promise<unknown>

const makeRes = () => {
  const res = {
    statusCode: 200,
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  }
  res.status.mockImplementation((code: number) => {
    res.statusCode = code
    return res
  })
  return res as unknown as Response & typeof res
}

const run = async (handler: Handler, body: Record<string, unknown>) => {
  const req = { body, query: {}, params: {}, headers: {} } as unknown as Request
  const res = makeRes()
  const next = vi.fn()
  await handler(req, res, next)

  // asyncHandler 把 AppError 交给 next，这里等价地还原成响应，便于比较两条分支
  if (res.json.mock.calls.length === 0 && next.mock.calls.length > 0) {
    const err = next.mock.calls[0][0] as { code?: number; message?: string; statusCode?: number }
    if (err && typeof err.statusCode === 'number') {
      return {
        statusCode: err.statusCode,
        body: { code: err.code, message: err.message, data: null },
      }
    }
  }

  return {
    statusCode: res.statusCode,
    body: res.json.mock.calls[0]?.[0],
  }
}

/** 去掉响应里的时间戳，只比较调用方可见的语义字段 */
const normalize = (body: unknown) => {
  const payload = body as { code?: number; message?: string; data?: unknown } | undefined
  return { code: payload?.code, message: payload?.message, data: payload?.data }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(sendSmsCode).mockResolvedValue({ success: true, message: '发送成功' })
})

describe('注册与登录接口的手机号枚举防护', () => {
  it('注册：已注册与全新手机号返回完全一致，且已注册时不重复建号', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({ id: 'u_exist' } as never)
    const existing = await run(registerUser, { phone: '13800138000', password: '123456' })

    vi.mocked(queryOne).mockResolvedValueOnce(null)
    const fresh = await run(registerUser, { phone: '13800138001', password: '123456' })

    expect(existing.statusCode).toBe(fresh.statusCode)
    expect(normalize(existing.body)).toEqual(normalize(fresh.body))
    expect(insertUser).toHaveBeenCalledTimes(1)
  })

  it('管理员发码：号码是否存在返回一致，未注册号码不触发真实短信', async () => {
    vi.mocked(readAdminByPhone).mockResolvedValueOnce(null)
    const unknown = await run(sendAdminSmsCode, { phone: '13800138100' })

    vi.mocked(readAdminByPhone).mockResolvedValueOnce({
      id: 'a_1',
      phone: '13800138100',
      name: '管理员',
      password: 'hashed',
      status: 'active',
    } as never)
    const known = await run(sendAdminSmsCode, { phone: '13800138100' })

    expect(unknown.statusCode).toBe(known.statusCode)
    expect(normalize(unknown.body)).toEqual(normalize(known.body))
    expect(sendSmsCode).toHaveBeenCalledTimes(1)
  })

  it('管理员短信登录：号码不存在与验证码错误无法区分', async () => {
    vi.mocked(verifySmsCode).mockReturnValueOnce(false)
    const badCode = await run(adminSmsLogin, { phone: '13800138200', code: '000000' })

    vi.mocked(verifySmsCode).mockReturnValueOnce(true)
    vi.mocked(readAdminByPhone).mockResolvedValueOnce(null)
    const unknown = await run(adminSmsLogin, { phone: '13800138200', code: '123456' })

    expect(unknown.statusCode).toBe(badCode.statusCode)
    expect(normalize(unknown.body)).toEqual(normalize(badCode.body))
  })

  it('经理短信登录：号码不存在与验证码错误无法区分', async () => {
    vi.mocked(verifySmsCode).mockReturnValueOnce(false)
    const badCode = await run(managerSmsLogin, { phone: '13800138300', code: '000000' })

    vi.mocked(verifySmsCode).mockReturnValueOnce(true)
    vi.mocked(readManagers).mockResolvedValueOnce([] as never)
    const unknown = await run(managerSmsLogin, { phone: '13800138300', code: '123456' })

    expect(unknown.statusCode).toBe(badCode.statusCode)
    expect(normalize(unknown.body)).toEqual(normalize(badCode.body))
  })

  it('经理发码：非经理号码与经理号码返回一致，且非经理不触发真实短信', async () => {
    vi.mocked(readManagers).mockResolvedValueOnce([] as never)
    const unknown = await run(sendManagerSmsCode, { phone: '13800138400' })

    vi.mocked(readManagers).mockResolvedValueOnce([
      { id: 'm_1', phone: '13800138400', name: '经理', password: 'hashed', status: 'active', teamName: 'A' },
    ] as never)
    const known = await run(sendManagerSmsCode, { phone: '13800138400' })

    expect(unknown.statusCode).toBe(known.statusCode)
    expect(normalize(unknown.body)).toEqual(normalize(known.body))
    expect(sendSmsCode).toHaveBeenCalledTimes(1)
  })

  it('管理员密码登录：号码不存在与密码错误无法区分', async () => {
    vi.mocked(readAdminByPhone).mockResolvedValueOnce(null)
    const notFound = await run(adminLogin, { phone: '13800138500', password: 'whatever' })

    vi.mocked(readAdminByPhone).mockResolvedValueOnce({
      id: 'a_1',
      phone: '13800138500',
      name: '管理员',
      password: 'hashed',
      status: 'active',
    } as never)
    vi.mocked(verifyPassword).mockResolvedValueOnce(false)
    const wrongPassword = await run(adminLogin, { phone: '13800138500', password: 'whatever' })

    expect(notFound.statusCode).toBe(401)
    expect(normalize(notFound.body)).toEqual(normalize(wrongPassword.body))
  })

  it('经理密码登录：号码不存在与密码错误无法区分', async () => {
    vi.mocked(readManagers).mockResolvedValueOnce([] as never)
    const notFound = await run(managerLogin, { phone: '13800138600', password: 'whatever' })

    vi.mocked(readManagers).mockResolvedValueOnce([
      { id: 'm_1', phone: '13800138600', name: '经理', password: 'hashed', status: 'active', teamName: 'A' },
    ] as never)
    vi.mocked(verifyPassword).mockResolvedValueOnce(false)
    const wrongPassword = await run(managerLogin, { phone: '13800138600', password: 'whatever' })

    expect(notFound.statusCode).toBe(401)
    expect(normalize(notFound.body)).toEqual(normalize(wrongPassword.body))
  })

  it('用户密码登录：号码不存在与密码错误无法区分', async () => {
    vi.mocked(readUsers).mockResolvedValueOnce([] as never)
    const notFound = await run(userLogin, { phone: '13800138700', password: 'whatever' })

    vi.mocked(readUsers).mockResolvedValueOnce([
      {
        id: 'u_1',
        phone: '13800138700',
        password: 'hashed',
        nickname: '张三',
        teamName: '',
        role: 'user',
        status: 'active',
      },
    ] as never)
    vi.mocked(verifyPassword).mockResolvedValueOnce(false)
    const wrongPassword = await run(userLogin, { phone: '13800138700', password: 'whatever' })

    expect(notFound.statusCode).toBe(401)
    expect(normalize(notFound.body)).toEqual(normalize(wrongPassword.body))
  })
})
