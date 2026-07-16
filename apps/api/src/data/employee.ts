
import { query, queryOne } from '../db.js'
import { verifyPassword } from './utils.js'

export async function readEmployees(): Promise<any[]> {
  const rows = await query('SELECT * FROM employees ORDER BY createdAt DESC')
  return (rows as any[]).map(row => ({
    ...row,
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
  }))
}

export async function writeEmployees(employees: any[]): Promise<void> {
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

export async function readEmployeesByUserId(userId: string): Promise<any[]> {
  const rows = await query('SELECT * FROM employees WHERE userId = ? ORDER BY createdAt DESC', [userId])
  return (rows as any[]).map(row => ({
    ...row,
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
  }))
}

export async function readEmployeeById(id: string): Promise<any> {
  const row = await queryOne('SELECT * FROM employees WHERE id = ?', [id])
  if (!row) return null
  return {
    ...row,
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
  }
}

export async function readEmployeeByPhone(phone: string): Promise<any> {
  const row = await queryOne('SELECT * FROM employees WHERE phone = ?', [phone])
  if (!row) return null
  return {
    ...row,
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
  }
}

export async function insertEmployee(e: any): Promise<void> {
  await query(
    `INSERT INTO employees (id, userId, phone, password, nickname, expiresAt, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [e.id, e.userId || '', e.phone || '', e.password || '', e.nickname || '', e.expiresAt || null, e.status || 'active']
  )
}

export async function updateEmployee(id: string, fields: Record<string, any>): Promise<void> {
  const sets: string[] = []
  const values: any[] = []
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

export async function validateEmployee(phone: string, password: string): Promise<any> {
  const row = await queryOne('SELECT * FROM employees WHERE phone = ? AND status = ?', [phone, 'active'])
  if (!row) return null
  
  const passwordValid = await verifyPassword(password, row.password)
  if (!passwordValid) return null
  
  const now = new Date()
  const expiresAt = new Date(row.expiresAt)
  if (expiresAt < now) return null
  
  return {
    ...row,
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
  }
}
