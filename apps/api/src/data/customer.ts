import { randomUUID } from 'node:crypto'
import { query, queryOne, withTransaction } from '../db.js'
import { parsePage, parsePageSize } from '../utils/pagination.js'

/** customers 表原始行结构 */
export interface CustomerRow {
  id: string
  groupName: string
  contactName: string
  payMethod: string
  cardNo: string
  qrCodeUrl: string
  searchCount: number | string
  status: string
  source: string
  createdBy: string
  createdAt?: string
  updatedAt?: string
}

export interface CustomerRecord extends CustomerRow {
  searchCount: number
}

export interface CustomerListParams {
  keyword?: string
  payMethod?: string
  status?: string
  page?: number
  pageSize?: number
}

export const CUSTOMER_EXPORT_LIMIT = 10000

const toRecord = (row: CustomerRow): CustomerRecord => ({
  ...row,
  contactName: row.contactName || '',
  cardNo: row.cardNo || '',
  qrCodeUrl: row.qrCodeUrl || '',
  searchCount: Number(row.searchCount) || 0,
})

function buildFilters(params: CustomerListParams): { where: string; values: unknown[] } {
  const conditions: string[] = []
  const values: unknown[] = []

  if (params.keyword) {
    conditions.push('(groupName LIKE ? OR contactName LIKE ? OR cardNo LIKE ?)')
    const kw = `%${params.keyword}%`
    values.push(kw, kw, kw)
  }
  if (params.payMethod) {
    conditions.push('payMethod = ?')
    values.push(params.payMethod)
  }
  if (params.status) {
    conditions.push('status = ?')
    values.push(params.status)
  }

  return {
    where: conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '',
    values,
  }
}

export async function readCustomersPaged(
  params: CustomerListParams = {}
): Promise<{ list: CustomerRecord[]; total: number }> {
  const { where, values } = buildFilters(params)
  const countResult = (await queryOne(
    `SELECT COUNT(1) as count FROM customers${where}`,
    [...values]
  )) as { count: number } | null
  const total = countResult?.count || 0

  const pageNum = parsePage(params.page)
  const pageSizeNum = parsePageSize(params.pageSize)
  const offset = (pageNum - 1) * pageSizeNum

  const rows = (await query(
    `SELECT * FROM customers${where} ORDER BY searchCount DESC, updatedAt DESC, createdAt DESC LIMIT ? OFFSET ?`,
    [...values, pageSizeNum, offset]
  )) as CustomerRow[]

  return { list: rows.map(toRecord), total }
}

/** 导出用：按同一套筛选条件读取全量，超过上限时返回 truncated */
export async function readCustomersForExport(
  params: CustomerListParams = {}
): Promise<{ list: CustomerRecord[]; total: number; truncated: boolean }> {
  const { where, values } = buildFilters(params)
  const countResult = (await queryOne(
    `SELECT COUNT(1) as count FROM customers${where}`,
    [...values]
  )) as { count: number } | null
  const total = countResult?.count || 0

  const rows = (await query(
    `SELECT * FROM customers${where} ORDER BY searchCount DESC, updatedAt DESC, createdAt DESC LIMIT ?`,
    [...values, CUSTOMER_EXPORT_LIMIT]
  )) as CustomerRow[]

  return {
    list: rows.map(toRecord),
    total,
    truncated: total > rows.length,
  }
}

export async function readCustomerById(id: string): Promise<CustomerRecord | null> {
  const row = (await queryOne('SELECT * FROM customers WHERE id = ?', [id])) as CustomerRow | null
  return row ? toRecord(row) : null
}

export async function readCustomerByGroupName(groupName: string): Promise<CustomerRecord | null> {
  const row = (await queryOne('SELECT * FROM customers WHERE groupName = ?', [groupName])) as CustomerRow | null
  return row ? toRecord(row) : null
}

/** 按群号简称批量读取（导入计划比对用），分片避免 IN 参数过多 */
export async function readCustomersByGroupNames(groupNames: string[]): Promise<CustomerRecord[]> {
  const unique = Array.from(new Set(groupNames.filter(Boolean)))
  if (unique.length === 0) return []

  const result: CustomerRecord[] = []
  const CHUNK = 500
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK)
    const placeholders = chunk.map(() => '?').join(', ')
    const rows = (await query(
      `SELECT * FROM customers WHERE groupName IN (${placeholders})`,
      chunk
    )) as CustomerRow[]
    result.push(...rows.map(toRecord))
  }
  return result
}

export interface CreateCustomerInput {
  groupName: string
  contactName: string
  payMethod: string
  cardNo?: string
  qrCodeUrl?: string
  searchCount?: number
  status?: string
  source?: string
  createdBy?: string
}

export function buildCustomerId(): string {
  return `cust_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 10)}`
}

export async function insertCustomer(input: CreateCustomerInput): Promise<string> {
  const id = buildCustomerId()
  await query(
    `INSERT INTO customers
       (id, groupName, contactName, payMethod, cardNo, qrCodeUrl, searchCount, status, source, createdBy, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      id,
      input.groupName,
      input.contactName,
      input.payMethod,
      input.cardNo || '',
      input.qrCodeUrl || '',
      input.searchCount ?? 0,
      input.status || 'active',
      input.source || 'manual',
      input.createdBy || '',
    ]
  )
  return id
}

/** customers 表允许动态 UPDATE 的字段白名单 */
const CUSTOMER_MUTABLE_FIELDS = new Set([
  'groupName', 'contactName', 'payMethod', 'cardNo', 'qrCodeUrl', 'searchCount', 'status',
])

export async function updateCustomer(id: string, fields: object): Promise<void> {
  const sets: string[] = []
  const values: unknown[] = []
  for (const [key, val] of Object.entries(fields as Record<string, unknown>)) {
    if (!CUSTOMER_MUTABLE_FIELDS.has(key)) continue
    sets.push(`${key} = ?`)
    values.push(key === 'searchCount' ? Number(val) || 0 : val ?? '')
  }
  if (sets.length === 0) return
  sets.push('updatedAt = NOW()')
  values.push(id)
  await query(`UPDATE customers SET ${sets.join(', ')} WHERE id = ?`, values)
}

export async function deleteCustomer(id: string): Promise<void> {
  await query('DELETE FROM customers WHERE id = ?', [id])
}

export interface CustomerImportApplyInput {
  toCreate: CreateCustomerInput[]
  toUpdate: Array<{
    id: string
    contactName: string
    payMethod: string
    cardNo: string
    searchCount: number
  }>
}

/** 导入落库：新增 + 覆盖更新在同一事务内完成，任一失败整体回滚 */
export async function applyCustomerImport(
  input: CustomerImportApplyInput,
  createdBy: string
): Promise<void> {
  await withTransaction(async (conn) => {
    for (const row of input.toCreate) {
      await conn.execute(
        `INSERT INTO customers
           (id, groupName, contactName, payMethod, cardNo, qrCodeUrl, searchCount, status, source, createdBy, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          buildCustomerId(),
          row.groupName,
          row.contactName,
          row.payMethod,
          row.cardNo || '',
          row.qrCodeUrl || '',
          row.searchCount ?? 0,
          row.status || 'active',
          'import',
          createdBy,
        ]
      )
    }

    for (const row of input.toUpdate) {
      await conn.execute(
        `UPDATE customers
            SET contactName = ?, payMethod = ?, cardNo = ?, searchCount = ?, source = 'import', updatedAt = NOW()
          WHERE id = ?`,
        [row.contactName, row.payMethod, row.cardNo, row.searchCount, row.id]
      )
    }
  })
}
