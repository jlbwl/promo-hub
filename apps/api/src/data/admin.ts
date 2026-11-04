
import { queryOne } from '../db.js'
import { buildDynamicUpdateQuery } from './utils.js'
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
  await buildDynamicUpdateQuery('admins', ADMIN_MUTABLE_FIELDS, id, fields)
}
