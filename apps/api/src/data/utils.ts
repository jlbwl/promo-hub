
import { query, queryOne } from '../db.js'
import bcrypt from 'bcryptjs'

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}

function serialize(val: any): string {
  try {
    if (val === null || val === undefined) {
      return JSON.stringify(["sms"])
    }
    if (Array.isArray(val)) {
      return JSON.stringify(val)
    }
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed)) {
          return JSON.stringify(parsed)
        }
      } catch {
      }
    }
    return JSON.stringify(["sms"])
  } catch (e) {
    console.warn('[serialize] 序列化失败，返回默认值', e)
    return JSON.stringify(["sms"])
  }
}

function formatDateTime(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return date.toISOString().replace('T', ' ').substring(0, 19)
}

export function deserialize(val: any): any {
  if (val === null || val === undefined) return null
  if (typeof val === 'string') {
    try { 
      const parsed = JSON.parse(val)
      if (!Array.isArray(parsed)) {
        return ["sms"]
      }
      return parsed
    } catch { 
      return ["sms"]
    }
  }
  if (!Array.isArray(val)) {
    return ["sms"]
  }
  return val
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const result = await queryOne(
      `SHOW COLUMNS FROM ${tableName} LIKE ?`,
      [columnName]
    )
    return !!result
  } catch (e) {
    console.warn(`[columnExists] Failed to check column ${tableName}.${columnName}:`, e)
    return false
  }
}

async function ensureProductCategoryColumns(): Promise<void> {
  try {
    await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS categoryId VARCHAR(100) DEFAULT "" AFTER category')
    console.log('[DB] Added/verified categoryId column')
  } catch (e) {
    console.warn('[DB] categoryId column already exists or failed to add:', e)
  }
  try {
    await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS categoryNameSnapshot VARCHAR(200) DEFAULT "" AFTER categoryId')
    console.log('[DB] Added/verified categoryNameSnapshot column')
  } catch (e) {
    console.warn('[DB] categoryNameSnapshot column already exists or failed to add:', e)
  }
}

export { verifyPassword, serialize, formatDateTime, columnExists, ensureProductCategoryColumns }
