import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

// 必须在导入 auth.ts 之前设置（模块加载时强校验密钥）
vi.hoisted(() => {
  process.env.JWT_SECRET = 'test_jwt_secret_0123456789_0123456789'
  process.env.SESSION_SECRET = 'test_session_secret_0123456789_0123456789'
})

vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  },
}))

vi.mock('../../services/cache/index.js', () => ({
  getCacheService: vi.fn(),
}))

vi.mock('../../data/index.js', () => ({
  readEmployeeById: vi.fn(),
}))

import jwt from 'jsonwebtoken'
import { getCacheService } from '../../services/cache/index.js'
import { attachUser } from '../auth.js'

const makeReq = (overrides: Partial<Request> = {}): Request =>
  ({
    headers: {},
    session: {},
    ...overrides,
  }) as unknown as Request

const makeRes = (): Response =>
  ({
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  }) as unknown as Response

describe('attachUser 可选鉴权中间件', () => {
  let next: NextFunction & Mock

  beforeEach(() => {
    vi.clearAllMocks()
    next = vi.fn() as NextFunction & Mock
  })

  it('Session 已认证：直接使用 session 用户', async () => {
    const req = makeReq({
      session: {
        isAuthenticated: true,
        user: { id: 'u_session', phone: '13800000000', role: 'user' },
      },
    } as Partial<Request>)
    const res = makeRes()

    await attachUser(req, res, next)

    expect(req.user?.id).toBe('u_session')
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('有效 Bearer Token：解析出用户身份（session 失效场景）', async () => {
    const token = jwt.sign(
      { id: 'u_bearer', phone: '13900000000', role: 'user', type: 'access' },
      process.env.JWT_SECRET as string
    )
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } } as Partial<Request>)
    const res = makeRes()

    await attachUser(req, res, next)

    expect(req.user?.id).toBe('u_bearer')
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('无任何凭证：不挂载用户且不阻断请求（保持访客语义）', async () => {
    const req = makeReq()
    const res = makeRes()

    await attachUser(req, res, next)

    expect(req.user).toBeUndefined()
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('无效 Bearer + 有效 X-Refresh-Token：通过刷新兜底识别身份', async () => {
    const cachedUser = { id: 'u_refresh', phone: '13700000000', role: 'user' }
    const refreshToken = jwt.sign(
      { id: 'u_refresh', phone: '13700000000', role: 'user', type: 'refresh' },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    )
    vi.mocked(getCacheService).mockReturnValue({
      // 契约：CacheService.get 返回已 JSON.parse 的对象
      get: async (key: string) =>
        key === `refresh_token:${refreshToken}` ? cachedUser : null,
      set: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    } as unknown as ReturnType<typeof getCacheService>)

    const req = makeReq({
      headers: { authorization: 'Bearer invalid-token', 'x-refresh-token': refreshToken },
    } as Partial<Request>)
    const res = makeRes()

    await attachUser(req, res, next)

    expect(req.user?.id).toBe('u_refresh')
    expect(res.setHeader).toHaveBeenCalledWith('X-New-Token', expect.any(String))
    expect(res.setHeader).toHaveBeenCalledWith('X-New-Refresh-Token', expect.any(String))
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('无效 Bearer + 无效 X-Refresh-Token：不挂载用户且不阻断', async () => {
    vi.mocked(getCacheService).mockReturnValue({
      get: async () => null,
      set: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    } as unknown as ReturnType<typeof getCacheService>)

    const req = makeReq({
      headers: {
        authorization: 'Bearer invalid-token',
        'x-refresh-token': 'invalid-refresh-token',
      },
    } as Partial<Request>)
    const res = makeRes()

    await attachUser(req, res, next)

    expect(req.user).toBeUndefined()
    expect(next).toHaveBeenCalledTimes(1)
  })
})
