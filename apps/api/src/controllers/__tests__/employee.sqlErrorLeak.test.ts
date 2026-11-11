import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import type { Request } from 'express'
import { HttpStatus } from '@promo/shared'

/**
 * 回归：employee 控制器的 7 个 catch 分支历史上用 `code = 1`，
 * 导致数据库错误码/原始 message 以 HTTP 400 原样回显。
 * 生产环境必须只返回通用内部错误，业务校验信息保持原样。
 */

const dataMocks = vi.hoisted(() => ({
  readEmployeeByPhone: vi.fn(),
  readEmployeeById: vi.fn(),
  readEmployeesByUserId: vi.fn(),
  insertEmployee: vi.fn(),
  deleteEmployee: vi.fn(),
  updateEmployee: vi.fn(),
  readUser: vi.fn(),
}))

const authMocks = vi.hoisted(() => ({
  generateTokens: vi.fn(),
  revokeAllRefreshTokens: vi.fn(),
}))

const passwordMocks = vi.hoisted(() => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}))

vi.mock('../../data/index.js', () => dataMocks)
vi.mock('../../middleware/auth.js', () => authMocks)
vi.mock('../../utils/password.js', () => passwordMocks)
vi.mock('../../utils/logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn(), logRequest: vi.fn() },
  logRequest: vi.fn(),
}))

import {
  createEmployee,
  deleteEmployeeById,
  employeeLogin,
  validateEmployee,
} from '../employee.controller.js'

function makeMySqlError(): Error {
  return Object.assign(
    new Error("Duplicate entry '13800138000' for key 'employees.phone'"),
    { code: 'ER_DUP_ENTRY', errno: 1062, sqlState: '23000' }
  )
}

describe('员工接口的数据库错误不得原样回显', () => {
  type MockResponse = { status: Mock; json: Mock }
  let res: MockResponse
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    Object.values(dataMocks).forEach((fn) => fn.mockReset())
    authMocks.generateTokens.mockReset()
    authMocks.revokeAllRefreshTokens.mockReset().mockResolvedValue(undefined)
    passwordMocks.hashPassword.mockReset().mockResolvedValue('hashed')
    passwordMocks.verifyPassword.mockReset()
    process.env.NODE_ENV = 'production'
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    vi.clearAllMocks()
  })

  function body(): Record<string, unknown> {
    return res.json.mock.calls[0][0] as Record<string, unknown>
  }

  function expectNoSensitiveText(): void {
    const serialized = JSON.stringify(body())
    expect(serialized).not.toContain('ER_DUP_ENTRY')
    expect(serialized).not.toContain('Duplicate entry')
    expect(serialized).not.toContain('employees.phone')
    expect(serialized).not.toContain('employees')
  }

  function expectGenericInternalError(): void {
    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(body().code).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(body().message).toBe('服务器内部错误')
    expectNoSensitiveText()
  }

  const userReq = (extra: Record<string, unknown> = {}): Request =>
    ({ user: { id: 'u1', role: 'user' }, body: {}, params: {}, ...extra }) as unknown as Request

  it('创建员工遇到 ER_DUP_ENTRY 时返回 500 通用信息', async () => {
    dataMocks.readEmployeeByPhone.mockResolvedValue(null)
    dataMocks.insertEmployee.mockRejectedValue(makeMySqlError())

    await createEmployee(
      userReq({ body: { phone: '13800138000', password: '123456', expiresHours: 24 } }),
      res as never
    )

    expectGenericInternalError()
  })

  it('员工登录遇到 ER_NO_SUCH_TABLE 时返回 500 通用信息', async () => {
    dataMocks.readEmployeeByPhone.mockRejectedValue(
      Object.assign(new Error("Table 'promo.employees' doesn't exist"), { code: 'ER_NO_SUCH_TABLE' })
    )

    await employeeLogin(userReq({ body: { phone: '13800138000', password: '123456' } }), res as never)

    expectGenericInternalError()
  })

  it('删除员工遇到数据库错误时返回 500 通用信息', async () => {
    dataMocks.readEmployeeById.mockResolvedValue({ id: 'emp1', userId: 'u1', status: 'active' })
    dataMocks.deleteEmployee.mockRejectedValue(makeMySqlError())

    await deleteEmployeeById(userReq({ params: { id: 'emp1' } }), res as never)

    expectGenericInternalError()
  })

  it('校验员工遇到数据库错误时返回 500 通用信息', async () => {
    dataMocks.readEmployeeById.mockRejectedValue(makeMySqlError())

    await validateEmployee(userReq({ body: { employeeId: 'emp1' } }), res as never)

    expectGenericInternalError()
  })

  describe('业务校验契约保持不变（code = 1）', () => {
    it('创建员工密码过短仍返回 code 1 与原消息', async () => {
      await createEmployee(userReq({ body: { phone: '13800138000', password: '123' } }), res as never)

      expect(body().code).toBe(1)
      expect(body().message).toBe('密码至少6位')
    })

    it('员工登录密码错误仍返回 code 1 与原消息', async () => {
      dataMocks.readEmployeeByPhone.mockResolvedValue({
        id: 'emp1',
        userId: 'u1',
        status: 'active',
        password: 'hashed',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      })
      passwordMocks.verifyPassword.mockResolvedValue(false)

      await employeeLogin(userReq({ body: { phone: '13800138000', password: '123456' } }), res as never)

      expect(body().code).toBe(1)
      expect(body().message).toBe('手机号、密码错误或账户已过期')
    })

    it('员工不存在仍返回 code 1 与原消息', async () => {
      dataMocks.readEmployeeById.mockResolvedValue(null)

      await deleteEmployeeById(userReq({ params: { id: 'emp1' } }), res as never)

      expect(body().code).toBe(1)
      expect(body().message).toBe('员工不存在')
    })
  })
})
