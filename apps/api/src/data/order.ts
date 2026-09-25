
import logger from '../utils/logger.js'
import { getErrorMessage } from '@promo/shared'
import type { OrderStats } from '@promo/shared'
import { query, queryOne } from '../db.js'
import type { OrderRow } from '../data-memory.js'

export async function readOrders(): Promise<OrderRow[]> {
  return (await query('SELECT * FROM orders WHERE deleted = 0 ORDER BY createdAt DESC')) as OrderRow[]
}

// 订单中"用户+团队名称"去重组合（用于后台筛选用户下拉选项）
export interface OrderUserOption {
  userId: string
  userName?: string | null
  userPhone?: string | null
  teamName?: string | null
  orderCount: number
}

export async function readOrderUserOptions(): Promise<OrderUserOption[]> {
  return (await query(
    `SELECT userId, userName, userPhone, teamName, COUNT(*) as orderCount
     FROM orders WHERE deleted = 0
     GROUP BY userId, userName, userPhone, teamName
     ORDER BY MAX(createdAt) DESC`
  )) as OrderUserOption[]
}

export async function readOrder(id: string): Promise<OrderRow | null> {
  return (await queryOne('SELECT * FROM orders WHERE id = ? AND deleted = 0', [id])) as OrderRow | null
}

export async function getOrderStats(managerId?: string): Promise<OrderStats> {
  let whereClause = 'deleted = 0'
  const params: string[] = []
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

  const result = (await queryOne(sql, params)) as {
    total?: number | string
    pending?: number | string
    approved?: number | string
    pendingPayment?: number | string
    settled?: number | string
    rejected?: number | string
  } | null

  return {
    total: Number(result?.total) || 0,
    pending: Number(result?.pending) || 0,
    approved: Number(result?.approved) || 0,
    pendingPayment: Number(result?.pendingPayment) || 0,
    settled: Number(result?.settled) || 0,
    rejected: Number(result?.rejected) || 0,
  }
}

export async function readDeletedOrders(userId?: string): Promise<OrderRow[]> {
  const params: string[] = []
  let sql = 'SELECT * FROM orders WHERE deleted = 1 ORDER BY deletedAt DESC'
  if (userId) {
    sql = 'SELECT * FROM orders WHERE deleted = 1 AND userId = ? ORDER BY deletedAt DESC'
    params.push(userId)
  }
  return (await query(sql, params)) as OrderRow[]
}

export async function writeOrders(orders: OrderRow[]): Promise<void> {
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

export async function insertOrder(o: OrderRow): Promise<void> {
  await query(
    `INSERT INTO orders (id, productId, userId, managerId, employeeId, productName, productPrice, optionLabel, redirectUrl, userName, userPhone, teamName, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [o.id, o.productId || '', o.userId || '', o.managerId || '', o.employeeId || '', o.productName || '', o.productPrice || 0, o.optionLabel || '', o.redirectUrl || '', o.userName || '', o.userPhone || '', o.teamName || '', o.status || 'pending']
  )
}

export async function updateOrder(id: string, fields: Record<string, unknown>): Promise<void> {
  const sets: string[] = []
  const values: unknown[] = []
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
  /** 与 userId 之间为 OR 关系：用户端按本人手机号关联注册前的访客做单 */
  matchUserPhone?: string
  managerId?: string
  employeeId?: string
  status?: string
  managedBy?: string
  userPhone?: string
  teamName?: string
  keyword?: string
  page?: number
  pageSize?: number
}): Promise<{ list: OrderRow[]; total: number }> {
  const whereConditions: string[] = ['deleted = 0']
  const values: unknown[] = []

  if (params.userId && params.matchUserPhone) {
    whereConditions.push('(userId = ? OR userPhone = ?)')
    values.push(params.userId, params.matchUserPhone)
  } else if (params.userId) {
    whereConditions.push('userId = ?')
    values.push(params.userId)
  }
  if (params.userPhone) {
    whereConditions.push('userPhone = ?')
    values.push(params.userPhone)
  }
  if (params.teamName) {
    whereConditions.push('teamName = ?')
    values.push(params.teamName)
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
    const countResult = (await queryOne(
      `SELECT COUNT(1) as total FROM orders WHERE ${whereClause}`,
      values
    )) as { total?: number | string } | null
    const total = Number(countResult?.total) || 0

    let orders: OrderRow[] = []
    if (total > 0) {
      orders = (await query(
        `SELECT * FROM orders WHERE ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        [...values, pageSize, offset]
      )) as OrderRow[]
    }

    const userIds = Array.from(new Set(orders.map(o => o.userId).filter(Boolean)))
    const usersMap = new Map<string, string | null | undefined>()
    if (userIds.length > 0) {
      try {
        const users = (await query(
          `SELECT id, teamName FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`,
          userIds
        )) as { id: string; teamName?: string | null }[]
        users.forEach(user => {
          usersMap.set(user.id, user.teamName)
        })
      } catch (e) {
        logger.warn('[订单查询] 获取用户信息失败', { error: e instanceof Error ? e.message : String(e) })
      }
    }

    return {
      list: orders.map(order => ({
        ...order,
        productPrice: Number(order.productPrice) || 0,
        teamName: order.teamName || usersMap.get(order.userId) || '',
      })),
      total,
    }
  } catch (error) {
    logger.error('[订单查询] 数据库错误:', { error: getErrorMessage(error) })
    const err = new Error('获取订单列表失败') as Error & { code?: number }
    err.code = 500
    throw err
  }
}
