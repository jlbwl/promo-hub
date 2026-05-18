import { Response, Request, NextFunction } from 'express'
import logger from './logger.js'

/**
 * 标准 API 响应格式
 */
export interface ApiResponse<T> {
  code: number
  message: string
  data: T | null
  timestamp?: number
}

/**
 * HTTP 状态码常量
 */
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  INTERNAL_SERVER_ERROR = 500,
}

/**
 * 错误码枚举
 */
export enum ErrorCode {
  // 通用错误 (1xxx)
  SUCCESS = 0,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  INTERNAL_SERVER_ERROR = 500,
  
  // 用户/认证错误 (2xxx)
  USER_NOT_FOUND = 2001,
  USER_ALREADY_EXISTS = 2002,
  INVALID_CREDENTIALS = 2003,
  INVALID_PHONE = 2004,
  INVALID_CODE = 2005,
  CODE_EXPIRED = 2006,
  
  // 业务错误 (3xxx)
  PRODUCT_NOT_FOUND = 3001,
  INSUFFICIENT_STOCK = 3002,
}

/**
 * 应用错误类 - 自定义业务错误
 */
export class AppError extends Error {
  public readonly code: number
  public readonly statusCode: number
  public readonly details?: Record<string, any>

  constructor(
    message: string,
    code: number = ErrorCode.BAD_REQUEST,
    statusCode: number = HttpStatus.BAD_REQUEST,
    details?: Record<string, any>
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

/**
 * 发送成功响应
 */
export const sendSuccess = <T>(res: Response, data: T, message = '操作成功'): void => {
  const response: ApiResponse<T> = {
    code: ErrorCode.SUCCESS,
    message,
    data,
    timestamp: Date.now(),
  }
  res.json(response)
}

/**
 * 发送分页响应
 */
export const sendPagination = <T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  pageSize: number
): void => {
  sendSuccess(
    res,
    {
      list: data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
    '获取成功'
  )
}

/**
 * 发送错误响应
 */
export const sendError = (
  res: Response,
  message: string,
  code: number = ErrorCode.BAD_REQUEST,
  statusCode: number = HttpStatus.BAD_REQUEST
): void => {
  const response: ApiResponse<null> = {
    code,
    message,
    data: null,
    timestamp: Date.now(),
  }
  res.status(statusCode).json(response)
}

/**
 * 发送应用错误响应
 */
export const sendAppError = (res: Response, err: AppError): void => {
  sendError(res, err.message, err.code, err.statusCode)
}

/**
 * 包装控制器，自动处理错误
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await fn(req, res, next)
    } catch (err) {
      next(err)
    }
  }
}

/**
 * 全局错误处理中间件
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // 记录错误日志
  logger.logError(
    err,
    req.method,
    req.originalUrl,
    req.ip,
    (req.session as any)?.user?.id
  )

  // 应用错误
  if (err instanceof AppError) {
    sendAppError(res, err)
    return
  }

  // Multer 错误
  if ((err as any).code === 'LIMIT_FILE_SIZE') {
    sendError(res, '文件大小超过限制', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
    return
  }

  // 默认错误
  sendError(
    res,
    process.env.NODE_ENV === 'production'
      ? '服务器内部错误'
      : err.message,
    ErrorCode.INTERNAL_SERVER_ERROR,
    HttpStatus.INTERNAL_SERVER_ERROR
  )
}

