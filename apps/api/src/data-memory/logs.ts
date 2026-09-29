import { readFileData, writeFileData } from './_shared.js'
import type { OperationLogRow } from './types.js'

// ============ Operation Logs (操作日志) ============

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
  const logs = await readFileData<OperationLogRow>('operation_logs')
  logs.push({
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...log,
    createdAt: new Date().toISOString(),
  })
  await writeFileData('operation_logs', logs)
}

export async function readOperationLogs(params?: {
  adminId?: string
  operationType?: string
  targetType?: string
  page?: number
  pageSize?: number
}): Promise<{ list: OperationLogRow[]; total: number }> {
  let logs = await readFileData<OperationLogRow>('operation_logs')

  if (params?.adminId) {
    logs = logs.filter((log) => log.adminId === params.adminId)
  }
  if (params?.operationType) {
    logs = logs.filter((log) => log.operationType === params.operationType)
  }
  if (params?.targetType) {
    logs = logs.filter((log) => log.targetType === params.targetType)
  }

  logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const total = logs.length
  const pageNum = params?.page || 1
  const pageSizeNum = params?.pageSize || 20
  const start = (pageNum - 1) * pageSizeNum
  const list = logs.slice(start, start + pageSizeNum)

  return { list, total }
}
