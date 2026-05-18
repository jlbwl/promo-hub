import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  sendSuccess,
  sendError,
  sendPagination,
  sendAppError,
  AppError,
  HttpStatus,
  ErrorCode,
} from '../response'
import logger from '../logger'

// Mock logger
vi.mock('../logger', () => ({
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
  let mockRes: any

  beforeEach(() => {
    mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    }
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
