
import { queryOne, query } from '../db.js'
import bcrypt from 'bcryptjs'

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}

function serialize(val: unknown): string {
  try {
    if (val === null || val === undefined) {
      return JSON.stringify([])
    }
    if (Array.isArray(val)) {
      return JSON.stringify(val)
    }
    if (typeof val === 'string') {
      try {
        const parsed: unknown = JSON.parse(val)
        if (Array.isArray(parsed)) {
          return JSON.stringify(parsed)
        }
      } catch {
      }
    }
    return JSON.stringify([])
  } catch {
    return JSON.stringify([])
  }
}

function formatDateTime(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return date.toISOString().replace('T', ' ').substring(0, 19)
}

/**
 * 格式化 MySQL DATETIME 字段（北京时间 UTC+8）
 * 将 ISO 字符串或 Date 对象转换为 MySQL 接受的 DATETIME 格式
 */
function formatMySQLDateTime(date: string | Date | null | undefined): string | null {
  if (!date) return null
  const d = new Date(date)
  if (isNaN(d.getTime())) return null
  // M4：数据库按北京时间（UTC+8）存 NOW()，这里同步偏移，避免审核/结算时间比实际早 8 小时
  const beijing = new Date(d.getTime() + 8 * 60 * 60 * 1000)
  return beijing.toISOString().replace('T', ' ').substring(0, 19)
}

export function deserialize<T = unknown>(val: unknown): T[] {
  if (val === null || val === undefined) return []
  if (typeof val === 'string') {
    try {
      const parsed: unknown = JSON.parse(val)
      if (!Array.isArray(parsed)) {
        return []
      }
      return parsed
    } catch {
      return []
    }
  }
  if (!Array.isArray(val)) {
    return []
  }
  return val
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const result = await queryOne(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [tableName, columnName]
    )
    return !!result
  } catch {
    return false
  }
}

/**
 * 从对象中剥离 password 字段
 * 用于返回安全数据时移除敏感字段
 */
function stripPassword<T extends { password?: unknown }>(obj: T): Omit<T, 'password'> {
  const { password: _, ...safeObj } = obj
  return safeObj
}

/**
 * 构建动态 UPDATE SQL 查询
 * 通用模式：遍历字段 → 白名单过滤 → 拼接 SET → 执行 SQL
 * 
 * @param table - 表名
 * @param mutableFields - 可更新字段白名单 Set
 * @param id - 记录 ID
 * @param fields - 要更新的字段对象
 * @param options - 可选配置
 * @param options.transformValue - 值转换函数（如序列化 JSON）
 * @param options.nullInsteadOfEmpty - 空值使用 null 而不是空字符串
 * @param options.skipUpdatedAt - 跳过自动添加 updatedAt
 * @param options.additionalSets - 额外的 SET 子句（如 status = ?）
 * @param options.additionalValues - 额外的值（对应 additionalSets）
 * @param options.idColumn - ID 列名（默认 'id'）
 * @param options.updatedAtColumn - updatedAt 列名（默认 'updatedAt'）
 */
async function buildDynamicUpdateQuery(
  table: string,
  mutableFields: Set<string>,
  id: string,
  fields: object,
  options: {
    transformValue?: (key: string, val: unknown) => unknown
    nullInsteadOfEmpty?: boolean
    skipUpdatedAt?: boolean
    additionalSets?: string[]
    additionalValues?: unknown[]
    idColumn?: string
    updatedAtColumn?: string
  } = {}
): Promise<void> {
  const {
    transformValue,
    nullInsteadOfEmpty = false,
    skipUpdatedAt = false,
    additionalSets = [],
    additionalValues = [],
    idColumn = 'id',
    updatedAtColumn = 'updatedAt',
  } = options

  const sets: string[] = []
  const values: unknown[] = []

  for (const [key, val] of Object.entries(fields as Record<string, unknown>)) {
    if (key === idColumn || !mutableFields.has(key)) continue
    
    sets.push(`${key} = ?`)
    const transformed = transformValue ? transformValue(key, val) : val
    values.push(transformed ?? (nullInsteadOfEmpty ? null : ''))
  }

  if (sets.length === 0 && additionalSets.length === 0) return

  // 添加额外的 SET 子句
  sets.push(...additionalSets)
  values.push(...additionalValues)

  // 自动添加 updatedAt
  if (!skipUpdatedAt) {
    sets.push(`${updatedAtColumn} = NOW()`)
  }

  values.push(id)
  await query(`UPDATE ${table} SET ${sets.join(', ')} WHERE ${idColumn} = ?`, values)
}

export { verifyPassword, serialize, formatDateTime, formatMySQLDateTime, stripPassword, buildDynamicUpdateQuery, columnExists }
