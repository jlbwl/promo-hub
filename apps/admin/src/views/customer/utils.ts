/**
 * 客户管理页共享类型与 Excel 工具：导出、模板下载、导入文件解析。
 * ExcelJS 动态 import，避免进入管理端首屏包。
 */
import type ExcelJS from 'exceljs'

export interface CustomerItem {
  id: string
  groupName: string
  contactName: string
  payMethod: string
  payMethodLabel: string
  cardNo: string
  hasQrCode: boolean
  searchCount: number
  status: string
  statusLabel: string
  source: string
  createdAt?: string
  updatedAt?: string
}

export interface CustomerListFilters {
  keyword?: string
  payMethod?: string
  status?: string
}

export type CustomerImportMode = 'skip' | 'overwrite'

export interface CustomerImportIssue {
  rowNumber: number
  groupName: string
  reason: string
}

export interface CustomerImportResult {
  dryRun: boolean
  mode: CustomerImportMode
  totalRows: number
  created: number
  updated: number
  skipped: number
  errors: number
  errorRows: CustomerImportIssue[]
  skippedRows: CustomerImportIssue[]
}

export interface CustomerImportRowPayload {
  rowNumber: number
  groupName: string
  contactName: string
  payMethod: string
  cardNo: string
  searchCount?: number
}

export const PAY_METHOD_OPTIONS = [
  { value: 'alipay', label: '支付宝' },
  { value: 'wechat', label: '微信' },
  { value: 'usdt', label: 'USDT' },
]

export const STATUS_OPTIONS = [
  { value: 'active', label: '启用' },
  { value: 'disabled', label: '停用' },
]

/** 导出与模板列顺序：与源项目「客户预设」一致，末尾追加使用次数用于回导 */
export const CUSTOMER_EXPORT_HEADERS = ['群号简称', '对接人', '收款方式', '卡号/备注', '是否有收款码', '使用次数']

/** 导入可识别的表头别名（已做去空格、全角斜杠归一化） */
const IMPORT_HEADER_ALIASES: Record<string, string> = {
  群号简称: 'groupName',
  群号: 'groupName',
  对接人: 'contactName',
  对接: 'contactName',
  收款方式: 'payMethod',
  收款: 'payMethod',
  '卡号/备注': 'cardNo',
  卡号: 'cardNo',
  支付宝卡: 'cardNo',
  是否有收款码: 'hasQrCode',
  使用次数: 'searchCount',
}

const normalizeHeader = (value: string): string =>
  value
    .replace(/\s+/g, '')
    .replace(/[／]/g, '/')
    .toLowerCase()

/** 表头归一化后查别名；未知列返回 undefined（忽略） */
export function resolveImportColumn(header: string): string | undefined {
  return IMPORT_HEADER_ALIASES[normalizeHeader(header)]
}

export interface ParseCustomerFileResult {
  rows: CustomerImportRowPayload[]
  /** 文件里出现但被忽略的列名，用于提示 */
  ignoredHeaders: string[]
}

/**
 * 解析导入文件：只取第一个工作表，表头在第 1 行，数据从第 2 行开始。
 * 不做业务校验（后端统一校验并回传行号），空白行直接跳过。
 */
export async function parseCustomerWorkbook(file: File): Promise<ParseCustomerFileResult> {
  const exceljsModule = await import('exceljs')
  const workbook = new exceljsModule.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())

  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    throw new Error('文件中没有可读取的工作表')
  }

  const headerRow = worksheet.getRow(1)
  const columnMap = new Map<number, string>()
  const ignoredHeaders: string[] = []
  let hasGroupColumn = false

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const header = String(cell.text || '').trim()
    if (!header) return
    const field = resolveImportColumn(header)
    if (!field) {
      ignoredHeaders.push(header)
      return
    }
    if (field === 'groupName') hasGroupColumn = true
    // 同名字段重复出现时以第一列为准
    if (!Array.from(columnMap.values()).includes(field)) {
      columnMap.set(colNumber, field)
    }
  })

  if (!hasGroupColumn) {
    throw new Error('未找到「群号简称」列，请使用模板或源项目导出的文件')
  }

  const rows: CustomerImportRowPayload[] = []
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber)
    const raw: Record<string, string> = {}
    columnMap.forEach((field, colNumber) => {
      raw[field] = String(row.getCell(colNumber).text || '').trim()
    })

    if (!raw.groupName && !raw.contactName && !raw.payMethod && !raw.cardNo) {
      continue
    }

    const payload: CustomerImportRowPayload = {
      rowNumber,
      groupName: raw.groupName || '',
      contactName: raw.contactName || '',
      payMethod: raw.payMethod || '',
      cardNo: raw.cardNo || '',
    }
    // 未提供使用次数的行不传该字段，后端保留库中原值
    if (raw.searchCount) {
      payload.searchCount = Number(raw.searchCount.replace(/,/g, ''))
    }
    rows.push(payload)
  }

  return { rows, ignoredHeaders }
}

const applyHeaderStyle = (row: ExcelJS.Row): void => {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF409EFF' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
}

const setColumnWidths = (worksheet: ExcelJS.Worksheet, widths: number[]): void => {
  widths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width
  })
}

/** 导出客户档案：列与源项目「客户预设」一致，带使用次数供回导 */
export async function buildCustomerExportWorkbook(list: CustomerItem[]): Promise<ExcelJS.Workbook> {
  const exceljsModule = await import('exceljs')
  const workbook = new exceljsModule.Workbook()
  const worksheet = workbook.addWorksheet('客户预设')

  const headerRow = worksheet.addRow(CUSTOMER_EXPORT_HEADERS)
  applyHeaderStyle(headerRow)

  list.forEach((item) => {
    worksheet.addRow([
      item.groupName,
      item.contactName,
      item.payMethodLabel,
      item.cardNo,
      item.hasQrCode ? '是' : '否',
      item.searchCount,
    ])
  })

  setColumnWidths(worksheet, [18, 16, 12, 30, 14, 12])
  return workbook
}

/** 导入模板：表头 + 一行示例 */
export async function buildCustomerTemplateWorkbook(): Promise<ExcelJS.Workbook> {
  const exceljsModule = await import('exceljs')
  const workbook = new exceljsModule.Workbook()
  const worksheet = workbook.addWorksheet('客户预设')

  const headerRow = worksheet.addRow(CUSTOMER_EXPORT_HEADERS)
  applyHeaderStyle(headerRow)
  worksheet.addRow(['888', '张三', '支付宝', '卡号或备注（可空）', '否', 0])

  setColumnWidths(worksheet, [18, 16, 12, 30, 14, 12])
  return workbook
}

/** 导入失败/跳过明细导出，便于逐行修正 */
export async function buildImportIssueWorkbook(issues: CustomerImportIssue[]): Promise<ExcelJS.Workbook> {
  const exceljsModule = await import('exceljs')
  const workbook = new exceljsModule.Workbook()
  const worksheet = workbook.addWorksheet('导入问题行')

  const headerRow = worksheet.addRow(['行号', '群号简称', '原因'])
  applyHeaderStyle(headerRow)
  issues.forEach((issue) => {
    worksheet.addRow([issue.rowNumber, issue.groupName, issue.reason])
  })

  setColumnWidths(worksheet, [10, 20, 60])
  return workbook
}

/** 生成 xlsx 并触发浏览器下载 */
export async function downloadWorkbook(workbook: ExcelJS.Workbook, fileName: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** 当天日期字符串，用于导出文件名 */
export const todayStamp = (): string => {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}
