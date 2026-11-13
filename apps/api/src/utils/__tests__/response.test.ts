import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import {
  sendSuccess,
  sendError,
  sendPagination,
  sendAppError,
  sendServerError,
  AppError,
  HttpStatus,
  ErrorCode,
} from '../response.js'
import logger from '../logger.js'

// Mock logger
vi.mock('../logger.js', () => ({
  default: {
    error: vi.fn(),
    logError: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    logRequest: vi.fn(),
  },
  logRequest: vi.fn(),
  logError: vi.fn(),
}))

describe('response utils', () => {
  type MockResponse = Response & {
    json: Mock
    status: Mock
  }

  let mockRes: MockResponse

  beforeEach(() => {
    mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    } as MockResponse
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('sendSuccess', () => {
    it('should send success response', () => {
      const data = { id: 1, name: 'test' }
      sendSuccess(mockRes, data)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 0,
          message: '操作成功',
          data,
          timestamp: expect.any(Number),
        })
      )
    })

    it('should use custom message', () => {
      sendSuccess(mockRes, null, '自定义消息')
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '自定义消息',
        })
      )
    })
  })

  describe('sendError', () => {
    it('should send error response', () => {
      sendError(mockRes, '错误消息', 400, HttpStatus.BAD_REQUEST)
      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 400,
          message: '错误消息',
          data: null,
          timestamp: expect.any(Number),
        })
      )
    })

    it('should use default error code', () => {
      sendError(mockRes, '默认错误')
      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCode.BAD_REQUEST,
        })
      )
    })

    it('生产环境 5xx 默认脱敏为「服务器内部错误」', () => {
      vi.stubEnv('NODE_ENV', 'production')
      sendError(mockRes, 'ENOENT: /www/wwwroot/secret/path', 500, 500)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: '服务器内部错误' })
      )
      vi.unstubAllEnvs()
    })

    it('exposeMessage=true 时保留调用方确认安全的固定文案', () => {
      vi.stubEnv('NODE_ENV', 'production')
      sendError(mockRes, '图片保存失败：服务器存储目录不可用，请稍后重试', 500, 500, { reason: 'STORAGE_FAILED' }, true)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: '图片保存失败：服务器存储目录不可用，请稍后重试' })
      )
      vi.unstubAllEnvs()
    })
  })

  describe('sendPagination', () => {
    it('should send paginated response', () => {
      const data = [{ id: 1 }, { id: 2 }]
      sendPagination(mockRes, data, 10, 1, 10)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 0,
          data: {
            list: data,
            total: 10,
            page: 1,
            pageSize: 10,
            totalPages: 1,
          },
        })
      )
    })

    it('should calculate totalPages correctly', () => {
      sendPagination(mockRes, [], 25, 1, 10)
      const call = mockRes.json.mock.calls[0][0]
      expect(call.data.totalPages).toBe(3)
    })
  })

  describe('AppError', () => {
    it('should create AppError instance', () => {
      const err = new AppError('测试错误', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
      expect(err.message).toBe('测试错误')
      expect(err.code).toBe(ErrorCode.BAD_REQUEST)
      expect(err.statusCode).toBe(HttpStatus.BAD_REQUEST)
      expect(err.name).toBe('AppError')
    })

    it('should create AppError with details', () => {
      const details = { field: 'name', reason: 'required' }
      const err = new AppError(
        'Validation failed',
        ErrorCode.BAD_REQUEST,
        HttpStatus.BAD_REQUEST,
        details
      )
      expect(err.details).toEqual(details)
    })

    it('should use default code and status', () => {
      const err = new AppError('simple error')
      expect(err.code).toBe(ErrorCode.BAD_REQUEST)
      expect(err.statusCode).toBe(HttpStatus.BAD_REQUEST)
    })
  })

  describe('sendAppError', () => {
    it('should send AppError response', () => {
      const err = new AppError('App错误', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
      sendAppError(mockRes, err)
      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCode.BAD_REQUEST,
          message: 'App错误',
        })
      )
    })
  })

  describe('sendServerError', () => {
    const originalNodeEnv = process.env.NODE_ENV

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv
    })

    function makeMySqlError(): Error {
      return Object.assign(
        new Error("Duplicate entry '测试产品' for key 'products.title'"),
        { code: 'ER_DUP_ENTRY', errno: 1062, sqlState: '23000' }
      )
    }

    it('生产环境把数据库错误统一脱敏为 500，响应体不含 SQL/表名/列名', () => {
      process.env.NODE_ENV = 'production'
      sendServerError(mockRes, makeMySqlError(), '获取失败')

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
      const body = mockRes.json.mock.calls[0][0]
      expect(body).toEqual(
        expect.objectContaining({ code: ErrorCode.INTERNAL_SERVER_ERROR, message: '服务器内部错误', data: null })
      )
      const serialized = JSON.stringify(body)
      expect(serialized).not.toContain('ER_DUP_ENTRY')
      expect(serialized).not.toContain('Duplicate entry')
      expect(serialized).not.toContain('products.title')
    })

    it('业务错误（AppError）保持原有 code 与 message，HTTP 映射不变', () => {
      process.env.NODE_ENV = 'production'
      const err = new AppError('产品不存在', ErrorCode.PRODUCT_NOT_FOUND, HttpStatus.NOT_FOUND)
      sendServerError(mockRes, err)

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST)
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: ErrorCode.PRODUCT_NOT_FOUND, message: '产品不存在' })
      )
    })

    it('非生产环境保留原始错误信息，便于排查', () => {
      process.env.NODE_ENV = 'development'
      sendServerError(mockRes, makeMySqlError(), '获取失败')

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
      const body = mockRes.json.mock.calls[0][0]
      expect(body.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR)
      expect(String(body.message)).toContain('Duplicate entry')
    })

    it('把原始错误与堆栈写入日志', () => {
      process.env.NODE_ENV = 'production'
      sendServerError(mockRes, makeMySqlError(), '获取失败')

      expect(logger.error).toHaveBeenCalledWith(
        '[API] 未预期错误',
        expect.objectContaining({
          error: expect.stringContaining('Duplicate entry'),
          stack: expect.any(String),
        })
      )
    })
  })

  describe('HttpStatus', () => {
    it('should have correct HTTP status codes', () => {
      expect(HttpStatus.OK).toBe(200)
      expect(HttpStatus.BAD_REQUEST).toBe(400)
      expect(HttpStatus.UNAUTHORIZED).toBe(401)
      expect(HttpStatus.NOT_FOUND).toBe(404)
      expect(HttpStatus.INTERNAL_SERVER_ERROR).toBe(500)
    })
  })

  describe('ErrorCode', () => {
    it('should have correct error codes', () => {
      expect(ErrorCode.SUCCESS).toBe(0)
      expect(ErrorCode.BAD_REQUEST).toBe(400)
      expect(ErrorCode.USER_NOT_FOUND).toBe(2001)
      expect(ErrorCode.PRODUCT_NOT_FOUND).toBe(3001)
    })
  })
})
