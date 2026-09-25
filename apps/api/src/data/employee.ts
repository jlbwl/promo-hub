
import { query, queryOne } from '../db.js'
import { verifyPassword } from './utils.js'
import type { Employee } from '@promo/shared'

// employees 表原始行结构：expiresAt 为 DATETIME（mysql2 返回 Date）或字符串
type EmployeeRow = Omit<Employee, 'expiresAt'> & {
  expiresAt?: string | Date | null
}

// 读取后的员工记录：expiresAt 统一转为 ISO 字符串或 null
type EmployeeRecord = Omit<Employee, 'expiresAt'> & {
  expiresAt: string | null
}

function toEmployeeRecord(row: EmployeeRow): EmployeeRecord {
  return {
    ...row,
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
  }
}

export async function readEmployees(): Promise<EmployeeRecord[]> {
  const rows = (await query('SELECT * FROM employees ORDER BY createdAt DESC')) as EmployeeRow[]
  return rows.map(toEmployeeRecord)
}

export async function writeEmployees(employees: Employee[]): Promise<void> {
  for (const e of employees) {
    const existing = await queryOne('SELECT id FROM employees WHERE id = ?', [e.id])
    if (existing) {
      await query(
        `UPDATE employees SET userId=?, phone=?, password=?, nickname=?, expiresAt=?, status=?, updatedAt=NOW() WHERE id=?`,
        [e.userId || '', e.phone || '', e.password || '', e.nickname || '', e.expiresAt || null, e.status || 'active', e.id]
      )
    } else {
      await query(
        `INSERT INTO employees (id, userId, phone, password, nickname, expiresAt, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [e.id, e.userId || '', e.phone || '', e.password || '', e.nickname || '', e.expiresAt || null, e.status || 'active']
      )
    }
  }
}

export async function readEmployeesByUserId(userId: string): Promise<EmployeeRecord[]> {
  const rows = (await query('SELECT * FROM employees WHERE userId = ? ORDER BY createdAt DESC', [userId])) as EmployeeRow[]
  return rows.map(toEmployeeRecord)
}

export async function readEmployeeById(id: string): Promise<EmployeeRecord | null> {
  const row = (await queryOne('SELECT * FROM employees WHERE id = ?', [id])) as EmployeeRow | null
  if (!row) return null
  return toEmployeeRecord(row)
}

export async function readEmployeeByPhone(phone: string): Promise<EmployeeRecord | null> {
  const row = (await queryOne('SELECT * FROM employees WHERE phone = ?', [phone])) as EmployeeRow | null
  if (!row) return null
  return toEmployeeRecord(row)
}

// 写入参数：与 shared Employee 一致，但 createdAt 由 DB NOW() 生成、可缺省
export type EmployeeInput = Omit<Employee, 'createdAt'> & { createdAt?: string }

export async function insertEmployee(e: EmployeeInput): Promise<void> {
  await query(
    `INSERT INTO employees (id, userId, phone, password, nickname, expiresAt, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [e.id, e.userId || '', e.phone || '', e.password || '', e.nickname || '', e.expiresAt || null, e.status || 'active']
  )
}

export async function updateEmployee(id: string, fields: Record<string, unknown>): Promise<void> {
  const sets: string[] = []
  const values: unknown[] = []
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id') continue
    sets.push(`${key} = ?`)
    values.push(val ?? '')
  }
  if (sets.length === 0) return
  sets.push('updatedAt = NOW()')
  values.push(id)
  await query(`UPDATE employees SET ${sets.join(', ')} WHERE id = ?`, values)
}

export async function deleteEmployee(id: string): Promise<void> {
  await query('DELETE FROM employees WHERE id = ?', [id])
}

export async function validateEmployee(phone: string, password: string): Promise<EmployeeRecord | null> {
  const row = (await queryOne('SELECT * FROM employees WHERE phone = ? AND status = ?', [phone, 'active'])) as EmployeeRow | null
  if (!row) return null

  const passwordValid = await verifyPassword(password, row.password)
  if (!passwordValid) return null

  const now = new Date()
  const expiresAt = new Date(row.expiresAt as string)
  if (expiresAt < now) return null

  return toEmployeeRecord(row)
}
