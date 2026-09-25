import { Response, Request, NextFunction } from 'express'
import logger from './logger.js'
import { AppError, ErrorCode, HttpStatus, ApiResponse } from '@promo/shared'

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
 *
 * 兼容两种调用方式：
 * - sendError(res, message, code)          —— HTTP 状态码默认与业务错误码一致
 * - sendError(res, message, code, status)  —— 显式区分业务码与 HTTP 状态码
 *
 * 历史背景：大量调用点只传了业务码（如 401/403/404），旧实现 HTTP 状态码恒为
 * 默认值 400，导致 HTTP 语义错误（如"未登录"返回 HTTP 400）。现未显式传
 * statusCode 时自动与业务码对齐（限合法 HTTP 范围），显式传参的调用不受影响。
 */
export const sendError = (
  res: Response,
  message: string,
  code: number = ErrorCode.BAD_REQUEST,
  statusCode?: number
): void => {
  const httpStatus =
    statusCode ?? (code >= 400 && code <= 599 ? code : HttpStatus.BAD_REQUEST)
  const response: ApiResponse<null> = {
    code,
    message,
    data: null,
    timestamp: Date.now(),
  }
  res.status(httpStatus).json(response)
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
    req.session?.user?.id
  )

  // 应用错误
  if (err instanceof AppError) {
    sendAppError(res, err)
    return
  }

  // Multer 错误
  if ((err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
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

