/**
 * 统一错误处理模块
 * 提供标准化的错误类和错误抛出辅助函数
 */

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
  public readonly details?: Record<string, unknown>

  constructor(
    message: string,
    code: number = ErrorCode.BAD_REQUEST,
    statusCode: number = HttpStatus.BAD_REQUEST,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

/**
 * 错误抛出辅助函数
 */
// 注意：这里使用 function 声明而非 const 箭头函数。
// TypeScript 的控制流分析只在「具名函数声明 + 显式 never 返回类型」时，
// 才能把调用后的变量收窄为非空（const 箭头函数跨模块引用不会触发收窄）。
export function throwBadRequest(message: string, code: number = ErrorCode.BAD_REQUEST): never {
  throw new AppError(message, code, HttpStatus.BAD_REQUEST)
}

export function throwUnauthorized(message: string = '未登录或会话已过期', code: number = ErrorCode.UNAUTHORIZED): never {
  throw new AppError(message, code, HttpStatus.UNAUTHORIZED)
}

export function throwForbidden(message: string = '您没有权限执行此操作', code: number = ErrorCode.FORBIDDEN): never {
  throw new AppError(message, code, HttpStatus.FORBIDDEN)
}

export function throwNotFound(message: string, code: number = ErrorCode.NOT_FOUND): never {
  throw new AppError(message, code, HttpStatus.NOT_FOUND)
}

export function throwConflict(message: string, code: number = ErrorCode.CONFLICT): never {
  throw new AppError(message, code, HttpStatus.CONFLICT)
}

export function throwServerError(message: string = '服务器内部错误', code: number = ErrorCode.INTERNAL_SERVER_ERROR): never {
  throw new AppError(message, code, HttpStatus.INTERNAL_SERVER_ERROR)
}

/**
 * 从未知类型的错误对象中安全提取可读的错误信息
 * 用于 catch (error) 块中替代 error.message（error 为 unknown 时无法直接访问属性）
 * @param error - 未知类型的错误对象（throw 抛出的任意值）
 * @param fallback - 提取不到有效信息时的兜底文案
 */
export const getErrorMessage = (error: unknown, fallback: string = '操作失败，请稍后重试'): string => {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  return fallback
}
