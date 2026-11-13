/**
 * 客户档案导入的纯函数：字段归一化、校验、文件内去重与入库计划。
 *
 * 源项目导出列映射（前端完成列名 → 字段名的转换）：
 * - 群号简称 → groupName（必填，唯一键）
 * - 对接人   → contactName（必填）
 * - 收款方式 → payMethod（归一化到 alipay/wechat/usdt，缺省 alipay）
 * - 卡号/备注 → cardNo
 * - 是否有收款码 → 不参与导入（文件里只有是/否，没有图片内容）
 * - 使用次数 → searchCount（可选；未提供时保留库中原值，新记录为 0）
 */

export const PAY_METHODS = ['alipay', 'wechat', 'usdt'] as const
export type PayMethod = (typeof PAY_METHODS)[number]

export const PAY_METHOD_LABELS: Record<PayMethod, string> = {
  alipay: '支付宝',
  wechat: '微信',
  usdt: 'USDT',
}

/** 单次导入的最大行数，避免超大请求撑爆内存与事务 */
export const MAX_IMPORT_ROWS = 2000

/** 字段长度上限，与 customers 表列宽保持一致 */
const MAX_GROUP_NAME = 200
const MAX_CONTACT_NAME = 200
const MAX_CARD_NO = 500

export interface RawCustomerImportRow {
  rowNumber?: unknown
  groupName?: unknown
  contactName?: unknown
  payMethod?: unknown
  cardNo?: unknown
  searchCount?: unknown
  [key: string]: unknown
}

export interface NormalizedCustomerInput {
  rowNumber: number
  groupName: string
  contactName: string
  payMethod: PayMethod
  cardNo: string
  /** null 表示导入文件未提供使用次数，更新时保留库中原值 */
  searchCount: number | null
}

export interface CustomerImportIssue {
  rowNumber: number
  groupName: string
  reason: string
}

export interface NormalizeResult {
  rows: NormalizedCustomerInput[]
  errors: CustomerImportIssue[]
  /** 文件内群号简称重复、被合并掉的行（保留最后一行） */
  duplicates: CustomerImportIssue[]
  /** 整行无有效内容的空白行（不计入错误，按跳过展示） */
  blankRows: CustomerImportIssue[]
}

export interface ExistingCustomerLike {
  id: string
  groupName: string
  searchCount: number
}

export interface CustomerImportPlanRow extends NormalizedCustomerInput {
  id: string
  /** 更新时实际写入的使用次数：文件带值用文件值，否则保留库中原值 */
  effectiveSearchCount: number
}

export interface CustomerImportPlan {
  toCreate: NormalizedCustomerInput[]
  toUpdate: CustomerImportPlanRow[]
  skipped: CustomerImportIssue[]
  errors: CustomerImportIssue[]
  duplicates: CustomerImportIssue[]
  totalRows: number
}

export type ImportMode = 'skip' | 'overwrite'

const toText = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

/**
 * 收款方式归一化：兼容中文、英文与常见别名，无法识别时返回 null。
 * 空值按源项目默认值处理为支付宝。
 */
export function normalizePayMethod(value: unknown): PayMethod | null {
  const raw = toText(value)
  if (!raw) return 'alipay'

  const key = raw.toLowerCase().replace(/[\s_-]/g, '')
  if (['支付宝', 'alipay', 'zfb', '支付宝收款', 'ali'].includes(key)) return 'alipay'
  if (['微信', '微信支付', 'wechat', 'weixin', 'wx', 'vx'].includes(key)) return 'wechat'
  if (['usdt', '泰达', '泰达币', 'u', 'trc20', 'erc20'].includes(key)) return 'usdt'
  return null
}

/** 使用次数解析：未提供返回 null；非法值返回 undefined 由调用方报错 */
export function parseSearchCount(value: unknown): number | null | undefined {
  const raw = toText(value)
  if (!raw) return null
  const num = Number(raw.replace(/,/g, ''))
  if (!Number.isFinite(num) || num < 0 || !Number.isInteger(num)) return undefined
  return num
}

function isBlankRow(row: RawCustomerImportRow): boolean {
  return (
    !toText(row.groupName) &&
    !toText(row.contactName) &&
    !toText(row.payMethod) &&
    !toText(row.cardNo) &&
    (row.searchCount === null || row.searchCount === undefined || toText(row.searchCount) === '')
  )
}

function resolveRowNumber(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * 校验并归一化原始行。
 * rowNumber 由前端按 Excel 实际行号传入；缺省时按「表头第 1 行」推算为 index + 2。
 */
export function normalizeImportRows(rawRows: unknown): NormalizeResult {
  const result: NormalizeResult = { rows: [], errors: [], duplicates: [], blankRows: [] }

  if (!Array.isArray(rawRows)) {
    result.errors.push({ rowNumber: 0, groupName: '', reason: '导入数据格式错误：rows 必须是数组' })
    return result
  }

  const byGroup = new Map<string, NormalizedCustomerInput>()

  rawRows.forEach((item, index) => {
    const row = (item && typeof item === 'object' ? item : {}) as RawCustomerImportRow
    const rowNumber = resolveRowNumber(row.rowNumber, index + 2)
    const groupName = toText(row.groupName)
    const contactName = toText(row.contactName)

    if (isBlankRow(row)) {
      result.blankRows.push({ rowNumber, groupName: '', reason: '空行已忽略' })
      return
    }

    const fail = (reason: string): void => {
      result.errors.push({ rowNumber, groupName, reason })
    }

    if (!groupName) {
      fail('群号简称不能为空')
      return
    }
    if (groupName.length > MAX_GROUP_NAME) {
      fail(`群号简称超长（最多 ${MAX_GROUP_NAME} 字）`)
      return
    }
    if (!contactName) {
      fail('对接人不能为空')
      return
    }
    if (contactName.length > MAX_CONTACT_NAME) {
      fail(`对接人超长（最多 ${MAX_CONTACT_NAME} 字）`)
      return
    }

    const cardNo = toText(row.cardNo)
    if (cardNo.length > MAX_CARD_NO) {
      fail(`卡号/备注超长（最多 ${MAX_CARD_NO} 字）`)
      return
    }

    const payMethod = normalizePayMethod(row.payMethod)
    if (!payMethod) {
      fail(`无法识别的收款方式：${toText(row.payMethod)}（仅支持支付宝/微信/USDT）`)
      return
    }

    const searchCount = parseSearchCount(row.searchCount)
    if (searchCount === undefined) {
      fail(`使用次数必须是非负整数：${toText(row.searchCount)}`)
      return
    }

    const normalized: NormalizedCustomerInput = {
      rowNumber,
      groupName,
      contactName,
      payMethod,
      cardNo,
      searchCount,
    }

    const previous = byGroup.get(groupName)
    if (previous) {
      // 文件内重复：以最后一行为准，先出现的行记为跳过
      result.duplicates.push({
        rowNumber: previous.rowNumber,
        groupName,
        reason: `文件内群号简称重复，已采用第 ${rowNumber} 行`,
      })
    }
    byGroup.set(groupName, normalized)
  })

  result.rows = Array.from(byGroup.values())
  return result
}

/**
 * 结合库中已有记录生成入库计划。
 * - overwrite：命中已有群号则更新，使用次数按「文件带值用文件值，否则保留原值」
 * - skip：命中已有群号则跳过
 */
export function buildCustomerImportPlan(
  rawRows: unknown,
  existing: ExistingCustomerLike[],
  mode: ImportMode
): CustomerImportPlan {
  const normalized = normalizeImportRows(rawRows)
  const existingMap = new Map(existing.map((item) => [item.groupName, item]))

  const plan: CustomerImportPlan = {
    toCreate: [],
    toUpdate: [],
    skipped: [],
    errors: normalized.errors,
    duplicates: normalized.duplicates,
    totalRows: Array.isArray(rawRows) ? rawRows.length : 0,
  }

  // 文件内被合并掉的行与空白行计入跳过
  plan.skipped.push(...normalized.duplicates, ...normalized.blankRows)

  for (const row of normalized.rows) {
    const current = existingMap.get(row.groupName)
    if (!current) {
      plan.toCreate.push(row)
      continue
    }
    if (mode === 'skip') {
      plan.skipped.push({
        rowNumber: row.rowNumber,
        groupName: row.groupName,
        reason: '库中已存在该群号简称，按跳过处理',
      })
      continue
    }
    plan.toUpdate.push({
      ...row,
      id: current.id,
      effectiveSearchCount: row.searchCount ?? current.searchCount ?? 0,
    })
  }

  return plan
}
