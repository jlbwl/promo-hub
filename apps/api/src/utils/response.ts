import { Response, Request, NextFunction } from 'express'
import logger from './logger.js'
import { AppError, ErrorCode, HttpStatus, ApiResponse, getErrorMessage } from '@promo/shared'
import { classifyUploadError } from './uploadError.js'

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
  statusCode?: number,
  data: unknown = null
): void => {
  // 安全：数据库层错误码是字符串（ER_DUP_ENTRY / ER_NO_SUCH_TABLE 等），
  // 直接参与数值比较会得到 NaN 并恒为 false，绝不能据此推断 HTTP 状态码
  const isHttpStatus = typeof code === 'number' && code >= 400 && code <= 599
  const httpStatus = statusCode ?? (isHttpStatus ? code : HttpStatus.BAD_REQUEST)
  // H7：生产环境 5xx 不回显原始异常/数据库信息，仅保留业务 4xx 的明确提示
  const finalMessage =
    process.env.NODE_ENV === 'production' && httpStatus >= 500
      ? '服务器内部错误'
      : message
  const response: ApiResponse<unknown> = {
    code,
    message: finalMessage,
    data,
    timestamp: Date.now(),
  }
  res.status(httpStatus).json(response)
}

/**
 * 统一发送上传失败响应：区分类型不支持 / 体积超限 / 存储失败，
 * data.reason 供前端定位问题，5xx 仍由 sendError 兜底脱敏
 */
export const sendUploadError = (res: Response, error: unknown): void => {
  const failure = classifyUploadError(error)
  sendError(res, failure.message, failure.code, failure.status, { reason: failure.reason })
}

/**
 * 发送应用错误响应
 */
export const sendAppError = (res: Response, err: AppError): void => {
  sendError(res, err.message, err.code, err.statusCode)
}

/**
 * 发送控制器 catch 分支捕获的异常
 *
 * 安全：数据库驱动的异常（mysql2）message 里含 SQL 片段、表名、列名、唯一索引名
 * 甚至业务数据值，`error.code` 是 `ER_*` 字符串而非数字。因此：
 * - 可识别的业务错误（AppError / 显式挂载数字码的异常）保持原有 code、message 与 HTTP 状态；
 * - 其余一律按 500 处理，原始信息（message + stack）只写入日志，
 *   生产环境由 sendError 的 5xx 分支脱敏为「服务器内部错误」。
 */
export const sendServerError = (
  res: Response,
  error: unknown,
  fallbackMessage: string = '操作失败'
): void => {
  if (error instanceof AppError) {
    sendError(res, error.message, error.code)
    return
  }

  // 兼容服务层显式挂载数字错误码的业务异常（如 { code: 404, message: '订单不存在' }）。
  // 只接受合法的 HTTP 数字码；mysql2 的 ER_* 是字符串，会落到下方 500 脱敏分支。
  const rawCode = (error as { code?: unknown })?.code
  if (typeof rawCode === 'number' && rawCode >= 400 && rawCode <= 599) {
    sendError(res, getErrorMessage(error, fallbackMessage), rawCode)
    return
  }

  logger.error('[API] 未预期错误', {
    error: getErrorMessage(error, fallbackMessage),
    stack: error instanceof Error ? error.stack : undefined,
  })
  sendError(
    res,
    getErrorMessage(error, fallbackMessage),
    ErrorCode.INTERNAL_SERVER_ERROR,
    HttpStatus.INTERNAL_SERVER_ERROR
  )
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
      if (err instanceof AppError) {
        next(err)
      } else {
        next(new AppError(
          process.env.NODE_ENV === 'production'
            ? '服务器内部错误'
            : ((err as Error).message || '服务器内部错误'),
          ErrorCode.INTERNAL_SERVER_ERROR,
          HttpStatus.INTERNAL_SERVER_ERROR
        ))
      }
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
    req.user?.id
  )

  // 应用错误
  if (err instanceof AppError) {
    sendAppError(res, err)
    return
  }

  // Multer 错误：体积超限（413）、字段/请求格式错误（400），不再一律落到 500/400
  const multerCode = (err as { code?: unknown }).code
  if (typeof multerCode === 'string' && multerCode.startsWith('LIMIT_')) {
    const failure = classifyUploadError(err)
    sendError(res, failure.message, failure.code, failure.status, { reason: failure.reason })
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

