import { Response, Request, NextFunction } from 'express'
import logger from './logger.js'
import { AppError, ErrorCode, HttpStatus } from '../../packages/shared/src/utils/errors'
import type { ApiResponse } from '../../packages/shared/src/types'

// 重新导出共享的类型和错误类，保持向后兼容
export { AppError, ErrorCode, HttpStatus }
export type { ApiResponse }

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

