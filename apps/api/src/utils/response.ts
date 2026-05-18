import { Response } from 'express'

/**
 * 标准 API 响应格式
 */
export interface ApiResponse<T> {
  code: number
  message: string
  data: T | null
}

/**
 * 发送成功响应
 */
export const sendSuccess = <T>(res: Response, data: T, message = '操作成功'): void => {
  res.json({
    code: 0,
    message,
    data,
  })
}

/**
 * 发送错误响应
 */
export const sendError = (
  res: Response,
  message: string,
  code = 400
): void => {
  res.status(code).json({
    code,
    message,
    data: null,
  })
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
  res.json({
    code: 0,
    message: '获取成功',
    data: {
      list: data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  })
}
