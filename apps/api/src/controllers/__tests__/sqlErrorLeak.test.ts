import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import type { Request } from 'express'
import { AppError, ErrorCode, HttpStatus } from '@promo/shared'

/**
 * 回归：数据库层的字符串错误码（ER_*）不得被当作业务码或 HTTP 状态码，
 * 生产环境下响应体不得回显 SQL 片段 / 表名 / 列名 / 唯一索引名。
 */

const serviceMocks = vi.hoisted(() => ({
  productService: { getProductById: vi.fn() },
  orderService: { createOrder: vi.fn(), reviewOrder: vi.fn() },
}))

vi.mock('../../services/index.js', () => serviceMocks)

vi.mock('../../utils/logger.js', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    logRequest: vi.fn(),
  },
  logRequest: vi.fn(),
}))

vi.mock('../../data/index.js', () => ({ readUser: vi.fn() }))

vi.mock('../../utils/auditLog.js', () => ({
  logAdminOperation: vi.fn().mockResolvedValue(undefined),
}))

import { getProductById } from '../product.controller.js'
import { createOrder, reviewOrder } from '../order.controller.js'

/** mysql2 原生错误的典型形态：code 是字符串，message 里带表名/列名/索引名/数据值 */
function makeMySqlError(): Error {
  return Object.assign(
    new Error("Duplicate entry '测试产品' for key 'products.title'"),
    { code: 'ER_DUP_ENTRY', errno: 1062, sqlState: '23000' }
  )
}

describe('数据库错误不得以业务码/HTTP 状态码回显', () => {
  type MockResponse = {
    status: Mock
    json: Mock
  }

  let res: MockResponse
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    }
    serviceMocks.productService.getProductById.mockReset()
    serviceMocks.orderService.createOrder.mockReset()
    serviceMocks.orderService.reviewOrder.mockReset()
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
    expect(serialized).not.toContain('products.title')
    expect(serialized).not.toContain('products')
  }

  describe('生产环境', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production'
    })

    it('产品详情遇到 ER_DUP_ENTRY 时返回 500 通用信息，不回显 SQL', async () => {
      serviceMocks.productService.getProductById.mockRejectedValue(makeMySqlError())
      const req = { params: { id: 'p1' } } as unknown as Request

      await getProductById(req, res as never)

      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
      expect(body().code).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
      expect(body().message).toBe('服务器内部错误')
      expectNoSensitiveText()
    })

    it('做单遇到 ER_DUP_ENTRY 时返回 500 通用信息，不回显 SQL', async () => {
      serviceMocks.orderService.createOrder.mockRejectedValue(makeMySqlError())
      const req = {
        body: { productId: 'p1' },
        user: { id: 'u1', role: 'user' },
      } as unknown as Request

      await createOrder(req, res as never)

      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
      expect(body().code).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
      expect(body().message).toBe('服务器内部错误')
      expectNoSensitiveText()
    })

    it('审核订单遇到 ER_DUP_ENTRY 时不得把字符串错误码透出', async () => {
      serviceMocks.orderService.reviewOrder.mockRejectedValue(makeMySqlError())
      const req = {
        params: { id: 'o1' },
        body: { action: 'approve' },
        user: { id: 'admin1', role: 'admin' },
      } as unknown as Request

      await reviewOrder(req, res as never)

      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
      expect(body().code).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
      expect(body().message).toBe('服务器内部错误')
      expectNoSensitiveText()
    })
  })

  describe('契约保持', () => {
    it('业务错误（AppError）仍原样返回原有 code 与 message', async () => {
      process.env.NODE_ENV = 'production'
      serviceMocks.productService.getProductById.mockRejectedValue(
        new AppError('产品不存在', ErrorCode.PRODUCT_NOT_FOUND, HttpStatus.NOT_FOUND)
      )
      const req = { params: { id: 'p404' } } as unknown as Request

      await getProductById(req, res as never)

      // HTTP 状态保持现状（业务码 3001 不在 400-599，旧实现即为 400）
      expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST)
      expect(body().code).toBe(ErrorCode.PRODUCT_NOT_FOUND)
      expect(body().message).toBe('产品不存在')
    })

    it('服务层挂载的数字错误码（如 404）仍原样透传', async () => {
      process.env.NODE_ENV = 'production'
      serviceMocks.orderService.createOrder.mockRejectedValue(
        Object.assign(new Error('产品不存在'), { code: 404 })
      )
      const req = {
        body: { productId: 'p1' },
        user: { id: 'u1', role: 'user' },
      } as unknown as Request

      await createOrder(req, res as never)

      expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND)
      expect(body().code).toBe(HttpStatus.NOT_FOUND)
      expect(body().message).toBe('产品不存在')
    })

    it('审核重单的 409 与 data.conflict 契约保持不变', async () => {
      process.env.NODE_ENV = 'production'
      const conflict = Object.assign(new Error('该订单疑似重复，请确认后再提交'), {
        code: 409,
        data: { conflict: { id: 'o9', userName: '张三' } },
      })
      serviceMocks.orderService.reviewOrder.mockRejectedValue(conflict)
      const req = {
        params: { id: 'o1' },
        body: { action: 'approve' },
        user: { id: 'admin1', role: 'admin' },
      } as unknown as Request

      await reviewOrder(req, res as never)

      expect(res.status).toHaveBeenCalledWith(HttpStatus.CONFLICT)
      expect(body().code).toBe(HttpStatus.CONFLICT)
      expect(body().message).toBe('该订单疑似重复，请确认后再提交')
      expect(body().data).toEqual({ conflict: { id: 'o9', userName: '张三' } })
    })

    it('非生产环境保留原始错误信息，便于本地排查', async () => {
      process.env.NODE_ENV = 'development'
      serviceMocks.productService.getProductById.mockRejectedValue(makeMySqlError())
      const req = { params: { id: 'p1' } } as unknown as Request

      await getProductById(req, res as never)

      expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
      expect(body().code).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
      expect(String(body().message)).toContain('Duplicate entry')
    })
  })
})
