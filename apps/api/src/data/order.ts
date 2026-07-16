
import { query, queryOne } from '../db.js'

export async function readOrders(): Promise<any[]> {
  return await query('SELECT * FROM orders WHERE deleted = 0 ORDER BY createdAt DESC')
}

export async function readOrder(id: string): Promise<any> {
  return await queryOne('SELECT * FROM orders WHERE id = ? AND deleted = 0', [id])
}

export async function getOrderStats(managerId?: string): Promise<any> {
  let whereClause = 'deleted = 0'
  const params: any[] = []
  if (managerId) {
    whereClause += ' AND managerId = ?'
    params.push(managerId)
  }

  const sql = `SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
    SUM(CASE WHEN status = 'pending_payment' THEN 1 ELSE 0 END) as pendingPayment,
    SUM(CASE WHEN status = 'settled' THEN 1 ELSE 0 END) as settled,
    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
  FROM orders WHERE ${whereClause}`

  const result = await queryOne(sql, params)

  return {
    total: Number(result?.total) || 0,
    pending: Number(result?.pending) || 0,
    approved: Number(result?.approved) || 0,
    pendingPayment: Number(result?.pendingPayment) || 0,
    settled: Number(result?.settled) || 0,
    rejected: Number(result?.rejected) || 0,
  }
}

export async function readDeletedOrders(userId?: string): Promise<any[]> {
  const params: any[] = []
  let sql = 'SELECT * FROM orders WHERE deleted = 1 ORDER BY deletedAt DESC'
  if (userId) {
    sql = 'SELECT * FROM orders WHERE deleted = 1 AND userId = ? ORDER BY deletedAt DESC'
    params.push(userId)
  }
  return await query(sql, params)
}

export async function writeOrders(orders: any[]): Promise<void> {
  for (const o of orders) {
    const existing = await queryOne('SELECT id FROM orders WHERE id = ?', [o.id])
    if (existing) {
      await query(
        `UPDATE orders SET productId=?, userId=?, managerId=?, employeeId=?, productName=?, productPrice=?, optionLabel=?, redirectUrl=?, userName=?, userPhone=?, teamName=?, fundAccount=?, status=?, reviewedAt=?, rejectReason=?, addedToPaymentAt=?, settledAt=?, transferredFromManager=?, transferredAt=?, managedBy=? WHERE id=?`,
        [o.productId || '', o.userId || '', o.managerId || '', o.employeeId || '', o.productName || '', o.productPrice || 0, o.optionLabel || '', o.redirectUrl || '', o.userName || '', o.userPhone || '', o.teamName || '', o.fundAccount || '', o.status || 'pending', o.reviewedAt || null, o.rejectReason || '', o.addedToPaymentAt || null, o.settledAt || null, o.transferredFromManager || '', o.transferredAt || null, o.managedBy || 'manager', o.id]
      )
    } else {
      await query(
        `INSERT INTO orders (id, productId, userId, managerId, employeeId, productName, productPrice, optionLabel, redirectUrl, userName, userPhone, teamName, fundAccount, status, reviewedAt, rejectReason, addedToPaymentAt, settledAt, transferredFromManager, transferredAt, managedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [o.id, o.productId || '', o.userId || '', o.managerId || '', o.employeeId || '', o.productName || '', o.productPrice || 0, o.optionLabel || '', o.redirectUrl || '', o.userName || '', o.userPhone || '', o.teamName || '', o.fundAccount || '', o.status || 'pending', o.reviewedAt || null, o.rejectReason || '', o.addedToPaymentAt || null, o.settledAt || null, o.transferredFromManager || '', o.transferredAt || null, o.managedBy || 'manager']
      )
    }
  }
}

export async function insertOrder(o: any): Promise<void> {
  await query(
    `INSERT INTO orders (id, productId, userId, managerId, employeeId, productName, productPrice, optionLabel, redirectUrl, userName, userPhone, teamName, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [o.id, o.productId || '', o.userId || '', o.managerId || '', o.employeeId || '', o.productName || '', o.productPrice || 0, o.optionLabel || '', o.redirectUrl || '', o.userName || '', o.userPhone || '', o.teamName || '', o.status || 'pending']
  )
}

export async function updateOrder(id: string, fields: Record<string, any>): Promise<void> {
  const sets: string[] = []
  const values: any[] = []
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id') continue
    sets.push(`${key} = ?`)
    values.push(val ?? null)
  }
  if (sets.length === 0) return
  values.push(id)
  await query(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`, values)
}

export async function deleteOrder(id: string): Promise<void> {
  await query('UPDATE orders SET deleted = 1, deletedAt = NOW() WHERE id = ?', [id])
}

export async function restoreOrder(id: string): Promise<void> {
  await query('UPDATE orders SET deleted = 0, deletedAt = NULL WHERE id = ?', [id])
}

export async function getOrdersPaginated(params: {
  userId?: string
  managerId?: string
  employeeId?: string
  status?: string
  managedBy?: string
  keyword?: string
  page?: number
  pageSize?: number
}): Promise<{ list: any[]; total: number }> {
  const whereConditions: string[] = ['deleted = 0']
  const values: any[] = []

  if (params.userId) {
    whereConditions.push('userId = ?')
    values.push(params.userId)
  }
  if (params.managerId) {
    whereConditions.push('managerId = ?')
    values.push(params.managerId)
  }
  if (params.employeeId) {
    whereConditions.push('employeeId = ?')
    values.push(params.employeeId)
  }
  if (params.status) {
    whereConditions.push('status = ?')
    values.push(params.status)
  }
  if (params.managedBy) {
    whereConditions.push('managedBy = ?')
    values.push(params.managedBy)
  }
  if (params.keyword) {
    whereConditions.push('(productName LIKE ? OR userName LIKE ? OR userPhone LIKE ?)')
    values.push(`%${params.keyword}%`, `%${params.keyword}%`, `%${params.keyword}%`)
  }

  const whereClause = whereConditions.join(' AND ')

  const page = Math.max(1, parseInt(String(params.page || 1), 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(String(params.pageSize || 20), 10)))
  const offset = (page - 1) * pageSize

  try {
    const countResult = await queryOne(
      `SELECT COUNT(*) as total FROM orders WHERE ${whereClause}`,
      values
    )
    const total = Number(countResult?.total) || 0

    let orders: any[] = []
    if (total > 0) {
      orders = await query(
        `SELECT * FROM orders WHERE ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        [...values, pageSize, offset]
      )
    }

    const userIds = Array.from(new Set((orders as any[]).map(o => o.userId).filter(Boolean)))
    const usersMap = new Map()
    if (userIds.length > 0) {
      try {
        const users = await query(
          `SELECT id, teamName FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`,
          userIds
        )
        ;(users as any[]).forEach(user => {
          usersMap.set(user.id, user.teamName)
        })
      } catch (e) {
        console.warn('[订单查询] 获取用户信息失败:', e)
      }
    }

    return {
      list: (orders as any[]).map(order => ({
        ...order,
        productPrice: Number(order.productPrice) || 0,
        teamName: order.teamName || usersMap.get(order.userId) || '',
      })),
      total,
    }
  } catch (error: any) {
    console.error('[订单查询] 数据库错误:', error)
    const err = new Error('获取订单列表失败')
    ;(err as any).code = 500
    throw err
  }
}
