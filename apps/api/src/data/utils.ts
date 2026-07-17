
import { queryOne } from '../db.js'
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
      return JSON.stringify([])
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

export function deserialize(val: any): any {
  if (val === null || val === undefined) return []
  if (typeof val === 'string') {
    try { 
      const parsed = JSON.parse(val)
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

export { verifyPassword, serialize, formatDateTime, columnExists }
