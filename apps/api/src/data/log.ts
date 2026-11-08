
import { randomUUID } from 'node:crypto'
import { query, queryOne } from '../db.js'
import { parsePage, parsePageSize } from '../utils/pagination.js'
import type { OperationLogRow } from '../data-memory.js'

// 读取后的日志记录：createdAt 统一转为 ISO 字符串（可能为 null）
type OperationLogRecord = Omit<OperationLogRow, 'createdAt'> & {
  createdAt: string | null
}

export async function insertOperationLog(log: {
  adminId: string
  adminPhone: string
  adminName: string
  operationType: string
  targetType: string
  targetId: string
  targetName: string
  reason?: string
  detail?: string
}): Promise<void> {
  // O13：保留时间前缀以维持 keyset 时间序，随机段改用 crypto.randomUUID
  const id = `log_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 8)}`
  await query(
    `INSERT INTO operation_logs (id, adminId, adminPhone, adminName, operationType, targetType, targetId, targetName, reason, detail, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [id, log.adminId, log.adminPhone, log.adminName, log.operationType, log.targetType, log.targetId, log.targetName, log.reason || '', log.detail || '']
  )
}

type OperationLogFilters = {
  adminId?: string
  operationType?: string
  targetType?: string
  startTime?: string
  endTime?: string
  keyword?: string
}

/** 复用筛选条件构造，避免列表与导出逻辑分叉 */
function buildOperationLogFilters(params?: OperationLogFilters): { conditions: string[]; values: unknown[] } {
  const values: unknown[] = []
  const conditions: string[] = []

  if (params?.adminId) {
    conditions.push('adminId = ?')
    values.push(params.adminId)
  }
  if (params?.operationType) {
    conditions.push('operationType = ?')
    values.push(params.operationType)
  }
  if (params?.targetType) {
    conditions.push('targetType = ?')
    values.push(params.targetType)
  }
  // 时间范围按自然日闭区间：开始日 00:00:00 起，结束日次日 00:00:00 止
  if (params?.startTime) {
    conditions.push('createdAt >= ?')
    values.push(`${params.startTime} 00:00:00`)
  }
  if (params?.endTime) {
    conditions.push('createdAt < DATE_ADD(?, INTERVAL 1 DAY)')
    values.push(`${params.endTime} 00:00:00`)
  }
  if (params?.keyword) {
    conditions.push('(targetName LIKE ? OR targetId LIKE ?)')
    values.push(`%${params.keyword}%`, `%${params.keyword}%`)
  }

  return { conditions, values }
}

function mapOperationLogRows(rows: OperationLogRow[]): OperationLogRecord[] {
  return rows.map(row => ({
    ...row,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  }))
}

export async function readOperationLogs(params?: OperationLogFilters & {
  page?: number
  pageSize?: number
}): Promise<{ list: OperationLogRecord[]; total: number }> {
  const { conditions, values } = buildOperationLogFilters(params)
  let queryStr = 'SELECT * FROM operation_logs'
  if (conditions.length > 0) {
    queryStr += ' WHERE ' + conditions.join(' AND ')
  }
  queryStr += ' ORDER BY createdAt DESC, id DESC'

  const total = (await queryOne('SELECT COUNT(1) as count FROM operation_logs' + (conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : ''), values)) as { count: number } | null
  const totalCount = total?.count || 0

  const pageNum = parsePage(params?.page)
  const pageSizeNum = parsePageSize(params?.pageSize, 20)
  const offset = (pageNum - 1) * pageSizeNum

  const rows = (await query(queryStr + ' LIMIT ? OFFSET ?', [...values, pageSizeNum, offset])) as OperationLogRow[]

  return {
    list: mapOperationLogRows(rows),
    total: totalCount,
  }
}

/** 导出前只统计一次总数（避免分页循环内重复 COUNT） */
export async function countOperationLogs(params?: OperationLogFilters): Promise<number> {
  const { conditions, values } = buildOperationLogFilters(params)
  const sql = 'SELECT COUNT(1) as count FROM operation_logs' + (conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '')
  const result = (await queryOne(sql, values)) as { count?: number | string } | null
  return Number(result?.count) || 0
}

/**
 * O7：导出用 keyset 分页，按 id 倒序游标推进，不做 OFFSET 也不重复统计总数。
 * id 形如 log_<毫秒时间戳>_<随机串>，倒序即近似时间倒序。
 */
export async function readOperationLogsKeyset(
  params?: OperationLogFilters,
  beforeId?: string,
  limit = 500,
): Promise<OperationLogRecord[]> {
  const { conditions, values } = buildOperationLogFilters(params)
  const allConditions = [...conditions]
  const allValues = [...values]
  if (beforeId) {
    allConditions.push('id < ?')
    allValues.push(beforeId)
  }

  let queryStr = 'SELECT * FROM operation_logs'
  if (allConditions.length > 0) {
    queryStr += ' WHERE ' + allConditions.join(' AND ')
  }
  queryStr += ' ORDER BY id DESC LIMIT ?'

  const rows = (await query(queryStr, [...allValues, limit])) as OperationLogRow[]
  return mapOperationLogRows(rows)
}

export interface OperationLogAdminOption {
  id: string
  name: string
  phone: string
}

/** 操作人筛选选项：只取日志里实际出现过的管理员，避免暴露完整管理员名单 */
export async function readOperationLogAdmins(): Promise<OperationLogAdminOption[]> {
  const rows = (await query(
    `SELECT adminId, adminName, adminPhone FROM operation_logs WHERE adminId <> '' GROUP BY adminId, adminName, adminPhone`
  )) as Array<{ adminId: string; adminName: string; adminPhone: string }>

  const seen = new Set<string>()
  const result: OperationLogAdminOption[] = []
  for (const row of rows) {
    if (!row.adminId || seen.has(row.adminId)) continue
    seen.add(row.adminId)
    result.push({
      id: row.adminId,
      name: row.adminName || row.adminPhone || row.adminId,
      phone: row.adminPhone || '',
    })
  }
  return result
}
