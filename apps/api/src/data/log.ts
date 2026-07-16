
import { query, queryOne } from '../db.js'

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
  page?: number
  pageSize?: number
}): Promise<{ list: any[]; total: number }> {
  let queryStr = 'SELECT * FROM operation_logs'
  const values: any[] = []
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

  if (conditions.length > 0) {
    queryStr += ' WHERE ' + conditions.join(' AND ')
  }

  queryStr += ' ORDER BY createdAt DESC'

  const total = await queryOne('SELECT COUNT(*) as count FROM operation_logs' + (conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : ''), values)
  const totalCount = total?.count || 0

  const pageNum = parseInt(String(params?.page || 1), 10)
  const pageSizeNum = parseInt(String(params?.pageSize || 20), 10)
  const offset = (pageNum - 1) * pageSizeNum
  
  const rows = await query(queryStr + ' LIMIT ? OFFSET ?', [...values, pageSizeNum, offset])
  
  return {
    list: (rows as any[]).map(row => ({
      ...row,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    })),
    total: totalCount,
  }
}
