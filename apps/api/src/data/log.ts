
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
  const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  await query(
    `INSERT INTO operation_logs (id, adminId, adminPhone, adminName, operationType, targetType, targetId, targetName, reason, detail, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [id, log.adminId, log.adminPhone, log.adminName, log.operationType, log.targetType, log.targetId, log.targetName, log.reason || '', log.detail || '']
  )
}

export async function readOperationLogs(params?: {
  adminId?: string
  operationType?: string
  targetType?: string
  startTime?: string
  endTime?: string
  keyword?: string
  page?: number
  pageSize?: number
}): Promise<{ list: OperationLogRecord[]; total: number }> {
  let queryStr = 'SELECT * FROM operation_logs'
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

  if (conditions.length > 0) {
    queryStr += ' WHERE ' + conditions.join(' AND ')
  }

  queryStr += ' ORDER BY createdAt DESC'

  const total = (await queryOne('SELECT COUNT(1) as count FROM operation_logs' + (conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : ''), values)) as { count: number } | null
  const totalCount = total?.count || 0

  const pageNum = parsePage(params?.page)
  const pageSizeNum = parsePageSize(params?.pageSize, 20)
  const offset = (pageNum - 1) * pageSizeNum
  
  const rows = (await query(queryStr + ' LIMIT ? OFFSET ?', [...values, pageSizeNum, offset])) as OperationLogRow[]
  
  return {
    list: rows.map(row => ({
      ...row,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    })),
    total: totalCount,
  }
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
