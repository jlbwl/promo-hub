import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import type { Request, Response } from 'express'
import { AppError } from '@promo/shared'

// Mock 依赖模块（避免真实 MySQL / Redis / 文件系统 / 阿里云 SMS）
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
  writeUsers: vi.fn(),
  readUsersPaged: vi.fn(),
  readManagers: vi.fn(),
  writeManagers: vi.fn(),
  readProducts: vi.fn(),
  writeProducts: vi.fn(),
  query: vi.fn(),
  queryOne: vi.fn(),
  deserialize: vi.fn(),
  insertUser: vi.fn(),
  updateUser: vi.fn(),
  withTransaction: vi.fn(),
}))

vi.mock('../../middleware/auth.js', () => ({
  login: vi.fn(),
  loginSync: vi.fn(),
  generateAuthToken: vi.fn(),
  logout: vi.fn(),
  generateTokens: vi.fn(),
  refreshAuthToken: vi.fn(),
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

import {
  readUsers,
  writeUsers,
  readManagers,
  queryOne,
  deserialize,
  insertUser,
  updateUser,
} from '../../data/index.js'
import {
  generateTokens,
  login as sessionLogin,
  logout as sessionLogout,
} from '../../middleware/auth.js'
import {
  sendSmsCode,
  generateSmsCode,
  saveSmsCode,
  verifySmsCode,
  deleteSmsCode,
} from '../../utils/sms.js'
import { verifyPassword } from '../../utils/password.js'
import {
  registerUser,
  userLogin,
  sendUserSmsCode,
  userSmsLogin,
  setUserPassword,
  userLogout,
  getUserById,
  deleteUser,
} from '../user.controller.js'

const makeReq = (overrides: Partial<Request> = {}): Request =>
  ({
    body: {},
    query: {},
    params: {},
    session: undefined as unknown as Request['session'],
    ...overrides,
  }) as Request

const makeRes = (): Response => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  return res
}

const makeNext = (): Mock => vi.fn()

const nextError = (next: Mock): AppError =>
  next.mock.calls[0][0] as unknown as AppError

const jsonPayload = (res: Response) =>
  (res.json as Mock).mock.calls[0][0] as unknown as {
    code: number
    message: string
    data: Record<string, unknown> & { user?: Record<string, unknown>; expiresIn?: number; token?: string }
  }

const mockUser = {
  id: 'u_1',
  phone: '13800000001',
  password: 'hashed_existing',
  nickname: '测试用户',
  teamName: '团队A',
  role: 'user',
  status: 'active',
  loginMethods: ['password'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('user.controller 认证流程', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(generateTokens).mockResolvedValue({
      token: 'jwt_token',
      refreshToken: 'refresh_token',
    } as Awaited<ReturnType<typeof generateTokens>>)
  })

  describe('registerUser 注册', () => {
    it('应成功注册并返回不含密码的用户信息', async () => {
      vi.mocked(readUsers).mockResolvedValue([mockUser])
      const req = makeReq({
        body: { phone: '13800000002', password: '123456', nickname: '新用户' },
      })
      const res = makeRes()

      await registerUser(req, res, makeNext())

      expect(writeUsers).toHaveBeenCalledTimes(1)
      const written = vi.mocked(writeUsers).mock.calls[0][0]
      const created = written[written.length - 1] as typeof mockUser
      expect(created.phone).toBe('13800000002')
      expect(created.password).not.toBe('123456')
      const payload = jsonPayload(res)
      expect(payload.code).toBe(0)
      expect(payload.data.user?.password).toBeUndefined()
    })

    it.each([
      ['缺少参数', { password: '123456' }, '手机号和密码不能为空'],
      ['手机号格式错误', { phone: '123', password: '123456' }, '手机号格式不正确'],
      ['密码过短', { phone: '13800000002', password: '123' }, '密码长度不能少于6位'],
    ])('%s 应返回 400', async (_name, body, message) => {
      const req = makeReq({ body })
      const res = makeRes()
      const next = makeNext()

      await registerUser(req, res, next)

      expect(next).toHaveBeenCalledTimes(1)
      const err = vi.mocked(next).mock.calls[0][0] as AppError
      expect(err).toBeInstanceOf(AppError)
      expect(err.statusCode).toBe(400)
      expect(err.message).toBe(message)
    })

    it('重复手机号应返回 409', async () => {
      vi.mocked(readUsers).mockResolvedValue([mockUser])
      const req = makeReq({ body: { phone: '13800000001', password: '123456' } })
      const next = makeNext()

      await registerUser(req, makeRes(), next)

      const err = vi.mocked(next).mock.calls[0][0] as AppError
      expect(err.statusCode).toBe(409)
    })

    it('团队名称重复应返回 409', async () => {
      vi.mocked(readUsers).mockResolvedValue([mockUser])
      const req = makeReq({
        body: { phone: '13800000002', password: '123456', teamName: '团队A' },
      })
      const next = makeNext()

      await registerUser(req, makeRes(), next)

      const err = vi.mocked(next).mock.calls[0][0] as AppError
      expect(err.statusCode).toBe(409)
      expect(err.message).toBe('该团队名称已存在')
    })
  })

  describe('userLogin 密码登录', () => {
    it('应成功登录并返回 token 与 refreshToken', async () => {
      vi.mocked(readUsers).mockResolvedValue([mockUser])
      vi.mocked(verifyPassword).mockResolvedValue(true)
      const req = makeReq({ body: { phone: '13800000001', password: '123456' } })
      const res = makeRes()

      await userLogin(req, res, makeNext())

      const payload = vi.mocked(res.json).mock.calls[0][0] as {
        data: { token: string; refreshToken: string; user: Record<string, unknown> }
      }
      expect(payload.data.token).toBe('jwt_token')
      expect(payload.data.refreshToken).toBe('refresh_token')
      expect(payload.data.user.password).toBeUndefined()
    })

    it('用户不存在或被禁用应返回 401', async () => {
      vi.mocked(readUsers).mockResolvedValue([
        { ...mockUser, status: 'disabled' },
      ])
      const next = makeNext()

      await userLogin(
        makeReq({ body: { phone: '13800000001', password: '123456' } }),
        makeRes(),
        next
      )

      const err = vi.mocked(next).mock.calls[0][0] as AppError
      expect(err.statusCode).toBe(401)
    })

    it('密码错误应返回 401', async () => {
      vi.mocked(readUsers).mockResolvedValue([mockUser])
      vi.mocked(verifyPassword).mockResolvedValue(false)
      const next = makeNext()

      await userLogin(
        makeReq({ body: { phone: '13800000001', password: 'wrong' } }),
        makeRes(),
        next
      )

      const err = vi.mocked(next).mock.calls[0][0] as AppError
      expect(err.statusCode).toBe(401)
    })
  })

  describe('sendUserSmsCode 发送验证码', () => {
    it('手机号格式错误应返回 400', async () => {
      const next = makeNext()

      await sendUserSmsCode(
        makeReq({ body: { phone: '123' } }),
        makeRes(),
        next
      )

      const err = vi.mocked(next).mock.calls[0][0] as AppError
      expect(err.statusCode).toBe(400)
    })

    it('发送成功应返回有效期', async () => {
      vi.mocked(generateSmsCode).mockReturnValue('123456')
      vi.mocked(sendSmsCode).mockResolvedValue({ success: true })
      const res = makeRes()

      await sendUserSmsCode(
        makeReq({ body: { phone: '13800000001' } }),
        res,
        makeNext()
      )

      expect(saveSmsCode).toHaveBeenCalledWith('13800000001', '123456', 300)
      const payload = vi.mocked(res.json).mock.calls[0][0] as { data: { expiresIn: number } }
      expect(payload.data.expiresIn).toBe(300)
    })

    it('发送失败应删除验证码并抛出 500（防静默失败）', async () => {
      vi.mocked(generateSmsCode).mockReturnValue('123456')
      vi.mocked(sendSmsCode).mockResolvedValue({
        success: false,
        message: 'InvalidAccessKeyId',
      })
      const next = makeNext()

      await sendUserSmsCode(
        makeReq({ body: { phone: '13800000001' } }),
        makeRes(),
        next
      )

      expect(deleteSmsCode).toHaveBeenCalledWith('13800000001')
      const err = vi.mocked(next).mock.calls[0][0] as AppError
      expect(err.statusCode).toBe(500)
      expect(err.message).toBe('验证码发送失败，请稍后重试')
    })
  })

  describe('userSmsLogin 短信登录', () => {
    it('验证码错误应返回 400', async () => {
      vi.mocked(verifySmsCode).mockReturnValue(false)
      const next = makeNext()

      await userSmsLogin(
        makeReq({ body: { phone: '13800000001', code: '000000' } }),
        makeRes(),
        next
      )

      const err = vi.mocked(next).mock.calls[0][0] as AppError
      expect(err.statusCode).toBe(400)
    })

    it('新用户应自动注册并返回 token', async () => {
      vi.mocked(verifySmsCode).mockReturnValue(true)
      vi.mocked(queryOne).mockResolvedValue(null) // 手机号查无用户
      const res = makeRes()

      await userSmsLogin(
        makeReq({
          body: { phone: '13900000001', code: '123456', teamName: '新团队' },
        }),
        res,
        makeNext()
      )

      expect(insertUser).toHaveBeenCalledTimes(1)
      const created = vi.mocked(insertUser).mock.calls[0][0] as Record<string, unknown>
      expect(created.phone).toBe('13900000001')
      expect(created.teamName).toBe('新团队')
      const payload = vi.mocked(res.json).mock.calls[0][0] as {
        data: { token: string; user: Record<string, unknown> }
      }
      expect(payload.data.token).toBe('jwt_token')
      expect(payload.data.user.password).toBeUndefined()
    })

    it('老用户登录时 updateUser 只传 loginMethods，不传 updatedAt（回归：MySQL DATETIME 不接受 ISO 字符串）', async () => {
      vi.mocked(verifySmsCode).mockReturnValue(true)
      const existing = {
        ...mockUser,
        phone: '13800000001',
        loginMethods: '["password"]',
        role: 'user',
      }
      // 第一次按 phone 查，更新后按 id 再查
      vi.mocked(queryOne)
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ ...existing, loginMethods: '["password","sms"]' })
      vi.mocked(deserialize).mockReturnValue(['password'])
      const res = makeRes()

      await userSmsLogin(
        makeReq({ body: { phone: '13800000001', code: '123456' } }),
        res,
        makeNext()
      )

      expect(updateUser).toHaveBeenCalledTimes(1)
      const [, fields] = vi.mocked(updateUser).mock.calls[0]
      expect(fields).toEqual({ loginMethods: ['password', 'sms'] })
      expect(fields).not.toHaveProperty('updatedAt')
      const payload = vi.mocked(res.json).mock.calls[0][0] as { code: number }
      expect(payload.code).toBe(0)
    })

    it('session 保存失败不阻断登录（容错分支）', async () => {
      vi.mocked(verifySmsCode).mockReturnValue(true)
      vi.mocked(queryOne).mockResolvedValue(null)
      vi.mocked(sessionLogin).mockRejectedValue(new Error('redis down'))
      const res = makeRes()

      await userSmsLogin(
        makeReq({ body: { phone: '13900000002', code: '123456' } }),
        res,
        makeNext()
      )

      const payload = vi.mocked(res.json).mock.calls[0][0] as { code: number }
      expect(payload.code).toBe(0)
    })

    it('非 AppError 异常应包装为 500 且保留原始信息', async () => {
      vi.mocked(verifySmsCode).mockReturnValue(true)
      vi.mocked(queryOne).mockRejectedValue(new Error('connection refused'))
      const next = makeNext()

      await userSmsLogin(
        makeReq({ body: { phone: '13800000001', code: '123456' } }),
        makeRes(),
        next
      )

      const err = vi.mocked(next).mock.calls[0][0] as AppError
      expect(err.statusCode).toBe(500)
      expect(err.message).toContain('connection refused')
    })
  })

  describe('setUserPassword 设置密码', () => {
    it('验证码错误应返回 400', async () => {
      vi.mocked(verifySmsCode).mockReturnValue(false)
      const next = makeNext()

      await setUserPassword(
        makeReq({
          body: { phone: '13800000001', code: '000000', password: '123456' },
        }),
        makeRes(),
        next
      )

      const err = vi.mocked(next).mock.calls[0][0] as AppError
      expect(err.statusCode).toBe(400)
    })

    it('用户不存在应返回 404', async () => {
      vi.mocked(verifySmsCode).mockReturnValue(true)
      vi.mocked(readUsers).mockResolvedValue([])
      const next = makeNext()

      await setUserPassword(
        makeReq({
          body: { phone: '13800000001', code: '123456', password: '123456' },
        }),
        makeRes(),
        next
      )

      const err = vi.mocked(next).mock.calls[0][0] as AppError
      expect(err.statusCode).toBe(404)
    })

    it('成功设置应写入哈希密码', async () => {
      vi.mocked(verifySmsCode).mockReturnValue(true)
      vi.mocked(readUsers).mockResolvedValue([{ ...mockUser }])
      const res = makeRes()

      await setUserPassword(
        makeReq({
          body: { phone: '13800000001', code: '123456', password: '654321' },
        }),
        res,
        makeNext()
      )

      const written = vi.mocked(writeUsers).mock.calls[0][0] as Array<typeof mockUser>
      expect(written[0].password).toBe('hashed_password')
      expect(written[0].password).not.toBe('654321')
      const payload = vi.mocked(res.json).mock.calls[0][0] as { code: number }
      expect(payload.code).toBe(0)
    })
  })

  describe('userLogout 登出', () => {
    it('应清除会话并返回成功', async () => {
      const res = makeRes()

      await userLogout(makeReq(), res, makeNext())

      expect(sessionLogout).toHaveBeenCalledTimes(1)
      const payload = vi.mocked(res.json).mock.calls[0][0] as { code: number }
      expect(payload.code).toBe(0)
    })
  })

  describe('getUserById 用户详情', () => {
    it('经理优先匹配', async () => {
      vi.mocked(readManagers).mockResolvedValue([
        { id: 'm_1', name: '经理', phone: '13900000000', teamName: '', status: 'active', createdAt: '2026-01-01' },
      ] as never)
      const res = makeRes()

      await getUserById(makeReq({ params: { id: 'm_1' } }), res, makeNext())

      const payload = vi.mocked(res.json).mock.calls[0][0] as { data: { role: string } }
      expect(payload.data.role).toBe('manager')
    })

    it('用户不存在应返回 404', async () => {
      vi.mocked(readManagers).mockResolvedValue([])
      vi.mocked(readUsers).mockResolvedValue([])
      const next = makeNext()

      await getUserById(makeReq({ params: { id: 'nope' } }), makeRes(), next)

      const err = vi.mocked(next).mock.calls[0][0] as AppError
      expect(err.statusCode).toBe(404)
    })
  })

  describe('deleteUser 删除用户', () => {
    it('缺少验证码应返回 400', async () => {
      const next = makeNext()

      await deleteUser(
        makeReq({
          query: {},
          session: { user: { phone: '13700000000' } },
        } as unknown as Partial<Request>),
        makeRes(),
        next
      )

      const err = vi.mocked(next).mock.calls[0][0] as AppError
      expect(err.statusCode).toBe(400)
    })

    it('未登录应返回 401', async () => {
      const next = makeNext()

      await deleteUser(
        makeReq({ query: { smsCode: '123456' } }),
        makeRes(),
        next
      )

      const err = vi.mocked(next).mock.calls[0][0] as AppError
      expect(err.statusCode).toBe(401)
    })

    it('验证码错误应返回 400', async () => {
      vi.mocked(verifySmsCode).mockReturnValue(false)
      const next = makeNext()

      await deleteUser(
        makeReq({
          query: { smsCode: '000000' },
          session: { user: { phone: '13700000000' } },
        } as unknown as Partial<Request>),
        makeRes(),
        next
      )

      const err = vi.mocked(next).mock.calls[0][0] as AppError
      expect(err.statusCode).toBe(400)
      expect(deleteSmsCode).not.toHaveBeenCalled()
    })
  })
})
