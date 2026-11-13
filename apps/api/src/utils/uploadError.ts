import { AppError } from '@promo/shared'

/**
 * 上传失败的机器可读原因
 * 前端可据此做差异化提示（如换格式 / 压缩体积 / 重试），无需解析文案
 */
export type UploadFailureReason =
  | 'NO_FILE'
  | 'UNSUPPORTED_TYPE'
  | 'FILE_TOO_LARGE'
  | 'INVALID_REQUEST'
  | 'STORAGE_FAILED'

export interface UploadFailure {
  status: number
  code: number
  message: string
  reason: UploadFailureReason
}

/** Multer 错误码 → 明确的 HTTP 语义 */
const MULTER_FAILURES: Record<string, UploadFailure> = {
  LIMIT_FILE_SIZE: {
    status: 413,
    code: 413,
    message: '图片大小超过上传上限',
    reason: 'FILE_TOO_LARGE',
  },
  LIMIT_FILE_COUNT: {
    status: 400,
    code: 400,
    message: '上传文件数量超出限制',
    reason: 'INVALID_REQUEST',
  },
  LIMIT_UNEXPECTED_FILE: {
    status: 400,
    code: 400,
    message: '上传字段名不正确，请检查表单字段',
    reason: 'INVALID_REQUEST',
  },
  LIMIT_PART_COUNT: {
    status: 400,
    code: 400,
    message: '上传请求字段过多',
    reason: 'INVALID_REQUEST',
  },
  LIMIT_FIELD_KEY: {
    status: 400,
    code: 400,
    message: '上传字段名过长',
    reason: 'INVALID_REQUEST',
  },
  LIMIT_FIELD_VALUE: {
    status: 400,
    code: 400,
    message: '上传字段值过长',
    reason: 'INVALID_REQUEST',
  },
  LIMIT_FIELD_COUNT: {
    status: 400,
    code: 400,
    message: '上传字段数量超出限制',
    reason: 'INVALID_REQUEST',
  },
}

/** 文件系统写入失败的 errno 码：目录不存在 / 无权限 / 磁盘满 / 只读 */
const STORAGE_ERROR_CODES = new Set(['ENOENT', 'EACCES', 'EPERM', 'ENOSPC', 'EROFS', 'EMFILE'])

/**
 * 归类上传异常
 *
 * - 业务校验（类型/格式）保持 4xx 与原文案
 * - Multer 体积超限 → 413，字段/请求格式 → 400
 * - 文件系统写入失败 → 500 + 可定位的存储提示（由调用方决定是否放行文案）
 * - sharp 等底层处理/存储异常 → 500，只给通用文案，原始信息只进日志
 */
export const classifyUploadError = (error: unknown): UploadFailure => {
  if (error instanceof AppError) {
    return {
      status: error.statusCode && error.statusCode >= 400 ? error.statusCode : 400,
      code: error.code,
      message: error.message,
      reason: 'UNSUPPORTED_TYPE',
    }
  }

  const multerCode = (error as { code?: unknown } | null)?.code
  if (typeof multerCode === 'string' && MULTER_FAILURES[multerCode]) {
    return MULTER_FAILURES[multerCode]
  }

  if (typeof multerCode === 'string' && STORAGE_ERROR_CODES.has(multerCode)) {
    return {
      status: 500,
      code: 500,
      message: '图片保存失败：服务器存储目录不可用，请稍后重试',
      reason: 'STORAGE_FAILED',
    }
  }

  return {
    status: 500,
    code: 500,
    message: '图片处理或存储失败，请稍后重试',
    reason: 'STORAGE_FAILED',
  }
}
