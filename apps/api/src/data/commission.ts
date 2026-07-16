
import { query, queryOne } from '../db.js'

export async function readCommissions(): Promise<any[]> {
  return await query('SELECT * FROM commissions ORDER BY createdAt DESC')
}

export async function readCommission(id: string): Promise<any> {
  return await queryOne('SELECT * FROM commissions WHERE id = ?', [id])
}

export async function writeCommissions(commissions: any[]): Promise<void> {
  for (const c of commissions) {
    const existing = await queryOne('SELECT id FROM commissions WHERE id = ?', [c.id])
    if (existing) {
      await query(
        `UPDATE commissions SET orderId=?, userId=?, managerId=?, productName=?, amount=?, status=?, approvedAt=?, paidAt=? WHERE id=?`,
        [c.orderId || '', c.userId || '', c.managerId || '', c.productName || '', c.amount || 0, c.status || 'pending', c.approvedAt || null, c.paidAt || null, c.id]
      )
    } else {
      await query(
        `INSERT INTO commissions (id, orderId, userId, managerId, productName, amount, status, approvedAt, paidAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [c.id, c.orderId || '', c.userId || '', c.managerId || '', c.productName || '', c.amount || 0, c.status || 'pending', c.approvedAt || null, c.paidAt || null]
      )
    }
  }
}

export async function insertCommission(c: any): Promise<void> {
  await query(
    `INSERT INTO commissions (id, orderId, userId, managerId, productName, amount, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [c.id, c.orderId || '', c.userId || '', c.managerId || '', c.productName || '', c.amount || 0, c.status || 'pending']
  )
}

export async function updateCommission(id: string, fields: Record<string, any>): Promise<void> {
  const sets: string[] = []
  const values: any[] = []
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id') continue
    sets.push(`${key} = ?`)
    values.push(val ?? null)
  }
  if (sets.length === 0) return
  values.push(id)
  await query(`UPDATE commissions SET ${sets.join(', ')} WHERE id = ?`, values)
}
