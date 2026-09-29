
import { query, queryOne } from '../db.js'
import type { AdminRow } from '../data-memory.js'

export async function readAdminByPhone(phone: string): Promise<AdminRow | null> {
  return (await queryOne('SELECT * FROM admins WHERE phone = ? AND status = ?', [phone, 'active'])) as AdminRow | null
}

export async function readAdminById(id: string): Promise<AdminRow | null> {
  return (await queryOne('SELECT * FROM admins WHERE id = ?', [id])) as AdminRow | null
}

/**
 * admins 表允许动态 UPDATE 的字段白名单（防止任意 key 拼接进 SQL）。
 */
const ADMIN_MUTABLE_FIELDS = new Set(['phone', 'password', 'status'])

export async function updateAdmin(id: string, fields: object): Promise<void> {
  const sets: string[] = []
  const values: unknown[] = []
  for (const [key, val] of Object.entries(fields as Record<string, unknown>)) {
    if (key === 'id' || !ADMIN_MUTABLE_FIELDS.has(key)) continue
    sets.push(`${key} = ?`)
    values.push(val ?? '')
  }
  if (sets.length === 0) return
  sets.push('updatedAt = NOW()')
  values.push(id)
  await query(`UPDATE admins SET ${sets.join(', ')} WHERE id = ?`, values)
}
