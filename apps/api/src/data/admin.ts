
import { query, queryOne } from '../db.js'

export async function readAdminByPhone(phone: string): Promise<any> {
  return await queryOne('SELECT * FROM admins WHERE phone = ? AND status = ?', [phone, 'active'])
}

export async function readAdminById(id: string): Promise<any> {
  return await queryOne('SELECT * FROM admins WHERE id = ?', [id])
}

export async function updateAdmin(id: string, fields: Record<string, any>): Promise<void> {
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
  await query(`UPDATE admins SET ${sets.join(', ')} WHERE id = ?`, values)
}
