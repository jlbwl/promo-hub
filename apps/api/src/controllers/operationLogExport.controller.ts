import type { Request, Response } from 'express'
import { formatDate, getErrorMessage } from '@promo/shared'
import { readOperationLogs } from '../data/index.js'
import logger from '../utils/logger.js'
import { sendError } from '../utils/response.js'
import { parseOperationLogFilters } from '../utils/operationLogQuery.js'
import { maskPhonesInText, parseAuditDetail } from '../utils/auditDetail.js'
import { toCsvLine, UTF8_BOM } from '../utils/csv.js'

/** 每页拉取条数：与列表接口上限一致，避免单次查询过重 */
const EXPORT_PAGE_SIZE = 100
/** 单次导出硬上限：防止超大结果集长时间占用连接 */
const MAX_EXPORT_ROWS = 100000

const CSV_HEADER = [
  '操作时间',
  '操作类型',
  '目标类型',
  '目标ID',
  '目标名称',
  '操作人',
  '操作人手机号',
  '操作原因',
  '详情摘要',
  '详情变更',
]

const OPERATION_TYPE_LABELS: Record<string, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
  offline: '下架',
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  order: '订单',
  product: '产品',
  user: '用户',
  manager: '渠道经理',
  category: '分类',
  qrcode: '二维码',
  admin: '管理员',
}

interface ExportLogRow {
  createdAt?: string | null
  adminName?: string
  adminPhone?: string
  operationType: string
  targetType: string
  targetId?: string
  targetName?: string
  reason?: string
  detail?: string | null
}

/**
 * 单行 CSV 数据。
 * detail 兼容结构化 JSON 与历史自由文本；无 summary 时按列表页同样的兜底摘要生成。
 */
function buildOperationLogCsvRow(row: ExportLogRow): string[] {
  const time = row.createdAt ? formatDate(row.createdAt) : '-'
  const operation = OPERATION_TYPE_LABELS[row.operationType] || row.operationType
  const targetType = TARGET_TYPE_LABELS[row.targetType] || row.targetType
  const detail = parseAuditDetail(row.detail)
  const summary = maskPhonesInText(detail.summary) || maskPhonesInText(
    `${time}，${row.adminName || '未知管理员'} 对${targetType}「${row.targetName || row.targetId || '-'}」执行了${operation}操作`
      + (row.reason ? `，原因：${row.reason}` : '') + '。'
  )

  return [
    time,
    operation,
    targetType,
    // 目标 ID 可能是订单号等长数字串，不做手机号脱敏，避免误伤
    row.targetId || '-',
    maskPhonesInText(row.targetName || '-'),
    row.adminName || '-',
    maskPhonesInText(row.adminPhone || '-'),
    maskPhonesInText(row.reason || '-'),
    summary,
    maskPhonesInText(detail.changesText) || '-',
  ]
}

/**
 * 按当前筛选条件流式导出操作日志 CSV。
 * 分页读取（每页 100 条）后逐行写出，不把全表读入内存。
 * 导出为只读查询，不写入操作日志：避免高频导出产生噪音，且不改变任何业务数据。
 */
export const exportOperationLogs = async (req: Request, res: Response): Promise<void> => {
  const filters = parseOperationLogFilters(req.query)

  let firstPage: Awaited<ReturnType<typeof readOperationLogs>>
  try {
    firstPage = await readOperationLogs({ ...filters, page: 1, pageSize: EXPORT_PAGE_SIZE })
  } catch (error) {
    // 尚未发送响应头，可安全返回 JSON 错误
    logger.error('[导出操作日志] 读取失败:', { error: getErrorMessage(error) })
    sendError(res, getErrorMessage(error, '导出失败'), 500)
    return
  }

  const filename = `operation-logs-${formatDate(new Date(), 'YYYYMMDDHHmmss')}.csv`
  res.status(200)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('Cache-Control', 'no-store')
  res.write(UTF8_BOM)
  res.write(toCsvLine(CSV_HEADER))

  let rows = firstPage.list
  let page = 1
  let written = 0

  try {
    while (rows.length > 0 && written < MAX_EXPORT_ROWS) {
      for (const row of rows) {
        if (written >= MAX_EXPORT_ROWS) break
        res.write(toCsvLine(buildOperationLogCsvRow(row)))
        written += 1
      }
      if (rows.length < EXPORT_PAGE_SIZE || written >= MAX_EXPORT_ROWS) break
      page += 1
      const next = await readOperationLogs({ ...filters, page, pageSize: EXPORT_PAGE_SIZE })
      rows = next.list
    }
    if (written >= MAX_EXPORT_ROWS) {
      logger.warn('[导出操作日志] 达到单次导出上限:', { limit: MAX_EXPORT_ROWS, filters })
    }
  } catch (error) {
    // 响应头已发出，无法再改写为 JSON 错误；保留已导出的部分并记录日志
    logger.error('[导出操作日志] 分页读取失败，导出中止:', { error: getErrorMessage(error), page })
  } finally {
    res.end()
  }
}
