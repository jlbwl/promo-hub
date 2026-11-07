import type { Request } from 'express'

/** 操作日志筛选项：列表与导出共用，保证导出结果与页面筛选一致 */
export interface OperationLogFilters {
  adminId?: string
  operationType?: string
  targetType?: string
  startTime?: string
  endTime?: string
  keyword?: string
}

/** 日期筛选参数格式（YYYY-MM-DD） */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined

/** 从 query 解析筛选条件；非法日期/空关键字直接忽略，避免产生无意义查询 */
export function parseOperationLogFilters(query: Request['query']): OperationLogFilters {
  const startTime = DATE_PATTERN.test(String(query.startTime ?? '')) ? String(query.startTime) : undefined
  const endTime = DATE_PATTERN.test(String(query.endTime ?? '')) ? String(query.endTime) : undefined
  const keyword = String(query.keyword ?? '').trim().slice(0, 100)

  return {
    adminId: readString(query.adminId),
    operationType: readString(query.operationType),
    targetType: readString(query.targetType),
    startTime,
    endTime,
    keyword: keyword || undefined,
  }
}
