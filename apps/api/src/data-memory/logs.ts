import { readFileData, writeFileData } from './_shared.js'
import { parsePage, parsePageSize } from '../utils/pagination.js'
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
  startTime?: string
  endTime?: string
  keyword?: string
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
  if (params?.startTime) {
    const start = new Date(`${params.startTime}T00:00:00`).getTime()
    logs = logs.filter((log) => new Date(log.createdAt).getTime() >= start)
  }
  if (params?.endTime) {
    const end = new Date(`${params.endTime}T00:00:00`).getTime()
    const endExclusive = end + 24 * 60 * 60 * 1000
    logs = logs.filter((log) => new Date(log.createdAt).getTime() < endExclusive)
  }
  if (params?.keyword) {
    const keyword = params.keyword.toLowerCase()
    logs = logs.filter(
      (log) =>
        (log.targetName || '').toLowerCase().includes(keyword) ||
        (log.targetId || '').toLowerCase().includes(keyword)
    )
  }

  logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const total = logs.length
  const pageNum = parsePage(params?.page)
  const pageSizeNum = parsePageSize(params?.pageSize, 20)
  const start = (pageNum - 1) * pageSizeNum
  const list = logs.slice(start, start + pageSizeNum)

  return { list, total }
}

export interface OperationLogAdminOption {
  id: string
  name: string
  phone: string
}

/** 操作人筛选选项：只取日志里实际出现过的管理员 */
export async function readOperationLogAdmins(): Promise<OperationLogAdminOption[]> {
  const logs = await readFileData<OperationLogRow>('operation_logs')
  const seen = new Set<string>()
  const result: OperationLogAdminOption[] = []
  for (const log of logs) {
    if (!log.adminId || seen.has(log.adminId)) continue
    seen.add(log.adminId)
    result.push({
      id: log.adminId,
      name: log.adminName || log.adminPhone || log.adminId,
      phone: log.adminPhone || '',
    })
  }
  return result
}
