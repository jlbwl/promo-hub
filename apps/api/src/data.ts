import { query, queryOne } from './db.js'
export { query, queryOne }

// ============ 通用辅助函数 ============

function serialize(val: any): string | null {
  if (val === null || val === undefined) return null
  return JSON.stringify(val)
}

function formatDateTime(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return date.toISOString().replace('T', ' ').substring(0, 19)
}

function deserialize(val: any): any {
  if (val === null || val === undefined) return null
  if (typeof val === 'string') {
    try { return JSON.parse(val) } catch { return val }
  }
  return val
}

// ============ Admins ============

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

// ============ Cart ============

export async function readCartItems(userId: string): Promise<any[]> {
  return await query(
    'SELECT * FROM cart WHERE userId = ? ORDER BY addedAt DESC',
    [userId]
  )
}

export async function readCartByManagerId(managerId: string): Promise<any[]> {
  return await query(
    'SELECT * FROM cart WHERE managerId = ? ORDER BY addedAt DESC',
    [managerId]
  )
}

export async function addToCart(item: any): Promise<void> {
  const id = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  await query(
    `INSERT INTO cart (id, userId, managerId, productId, productName, productPrice, coverImage, optionLabel, redirectUrl, addedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [id, item.userId, item.managerId || '', item.productId, item.productName || '', item.productPrice || 0, item.coverImage || '', item.optionLabel || '', item.redirectUrl || '']
  )
}

export async function removeFromCart(id: string): Promise<void> {
  await query('DELETE FROM cart WHERE id = ?', [id])
}

export async function removeFromCartByProductId(userId: string, productId: string): Promise<void> {
  await query('DELETE FROM cart WHERE userId = ? AND productId = ?', [userId, productId])
}

export async function isInCart(userId: string, productId: string): Promise<boolean> {
  const rows = await query(
    'SELECT id FROM cart WHERE userId = ? AND productId = ?',
    [userId, productId]
  )
  return (rows as any[]).length > 0
}

// ============ Products ============

export async function readProducts(): Promise<any[]> {
  const rows = await query('SELECT * FROM products ORDER BY createdAt DESC')
  return (rows as any[]).map(row => ({
    ...row,
    price: Number(row.price) || 0,
    originalPrice: Number(row.originalPrice) || 0,
    stock: Number(row.stock) || 0,
    requireName: Boolean(Number(row.requireName)),
    requirePhone: Boolean(Number(row.requirePhone)),
    images: deserialize(row.images),
    options: deserialize(row.options),
  }))
}

export async function readProduct(id: string): Promise<any> {
  const row = await queryOne('SELECT * FROM products WHERE id = ?', [id])
  if (!row) return null
  return {
    ...row,
    price: Number(row.price) || 0,
    originalPrice: Number(row.originalPrice) || 0,
    stock: Number(row.stock) || 0,
    requireName: Boolean(Number(row.requireName)),
    requirePhone: Boolean(Number(row.requirePhone)),
    images: deserialize(row.images),
    options: deserialize(row.options),
  }
}

export async function writeProducts(products: any[]): Promise<void> {
  for (const p of products) {
    const existing = await queryOne('SELECT id FROM products WHERE id = ?', [p.id])
    if (existing) {
      await query(
        `UPDATE products SET title=?, description=?, coverImage=?, images=?, price=?, originalPrice=?, category=?, status=?, managerId=?, stock=?, options=?, publishedBy=?, publishedAt=?, offlineReason=?, offlineAt=?, requireName=?, requirePhone=?, updatedAt=NOW() WHERE id=?`,
        [p.title || '', p.description || '', p.coverImage || '', serialize(p.images), p.price || 0, p.originalPrice || 0, p.category || '', p.status || 'draft', p.managerId || '', p.stock || 0, serialize(p.options), p.publishedBy || '', formatDateTime(p.publishedAt), p.offlineReason || '', formatDateTime(p.offlineAt), p.requireName ? 1 : 0, p.requirePhone ? 1 : 0, p.id]
      )
    } else {
      await query(
        `INSERT INTO products (id, title, description, coverImage, images, price, originalPrice, category, status, managerId, stock, options, publishedBy, publishedAt, offlineReason, offlineAt, requireName, requirePhone, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [p.id, p.title || '', p.description || '', p.coverImage || '', serialize(p.images), p.price || 0, p.originalPrice || 0, p.category || '', p.status || 'draft', p.managerId || '', p.stock || 0, serialize(p.options), p.publishedBy || '', formatDateTime(p.publishedAt), p.offlineReason || '', formatDateTime(p.offlineAt), p.requireName ? 1 : 0, p.requirePhone ? 1 : 0]
      )
    }
  }
}

export async function insertProduct(p: any): Promise<void> {
  await query(
    `INSERT INTO products (id, title, description, coverImage, images, price, originalPrice, category, status, managerId, stock, options, publishedBy, publishedAt, requireName, requirePhone, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [p.id, p.title || '', p.description || '', p.coverImage || '', serialize(p.images), p.price || 0, p.originalPrice || 0, p.category || '', p.status || 'draft', p.managerId || '', p.stock || 0, serialize(p.options), p.publishedBy || '', formatDateTime(p.publishedAt), p.requireName ? 1 : 0, p.requirePhone ? 1 : 0]
  )
}

export async function updateProduct(id: string, fields: Record<string, any>): Promise<void> {
  const sets: string[] = []
  const values: any[] = []
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id' || key === 'updatedAt') continue
    sets.push(`${key} = ?`)
    if (key === 'images' || key === 'options') {
      values.push(serialize(val))
    } else if (key === 'publishedAt' || key === 'offlineAt') {
      values.push(formatDateTime(val))
    } else if (typeof val === 'boolean' || key === 'requireName' || key === 'requirePhone') {
      values.push(val ? 1 : 0)
    } else {
      values.push(val ?? '')
    }
  }
  if (sets.length === 0) return
  sets.push('updatedAt = NOW()')
  values.push(id)
  await query(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, values)
}

export async function deleteProduct(id: string): Promise<void> {
  await query('DELETE FROM products WHERE id = ?', [id])
}

// ============ Managers ============

export async function readManagers(): Promise<any[]> {
  return await query('SELECT * FROM managers ORDER BY createdAt DESC')
}

export async function readManager(id: string): Promise<any> {
  return await queryOne('SELECT * FROM managers WHERE id = ?', [id])
}

export async function writeManagers(managers: any[]): Promise<void> {
  for (const m of managers) {
    const existing = await queryOne('SELECT id FROM managers WHERE id = ?', [m.id])
    if (existing) {
      await query(
        `UPDATE managers SET username=?, password=?, name=?, phone=?, status=?, teamName=?, role=?, updatedAt=NOW() WHERE id=?`,
        [m.username || '', m.password || '', m.name || '', m.phone || '', m.status || 'active', m.teamName || '', m.role || 'manager', m.id]
      )
    } else {
      await query(
        `INSERT INTO managers (id, username, password, name, phone, status, teamName, role, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [m.id, m.username || '', m.password || '', m.name || '', m.phone || '', m.status || 'active', m.teamName || '', m.role || 'manager']
      )
    }
  }
}

export async function insertManager(m: any): Promise<void> {
  await query(
    `INSERT INTO managers (id, username, password, name, phone, status, teamName, role, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [m.id, m.username || '', m.password || '', m.name || '', m.phone || '', m.status || 'active', m.teamName || '', m.role || 'manager']
  )
}

export async function updateManager(id: string, fields: Record<string, any>): Promise<void> {
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
  await query(`UPDATE managers SET ${sets.join(', ')} WHERE id = ?`, values)
}

export async function deleteManager(id: string): Promise<void> {
  await query('DELETE FROM managers WHERE id = ?', [id])
}

// ============ Users ============

export async function readUsers(): Promise<any[]> {
  const rows = await query('SELECT * FROM users ORDER BY createdAt DESC')
  return (rows as any[]).map(row => ({
    ...row,
    loginMethods: deserialize(row.loginMethods),
  }))
}

export async function readUser(id: string): Promise<any> {
  const row = await queryOne('SELECT * FROM users WHERE id = ?', [id])
  if (!row) return null
  return { ...row, loginMethods: deserialize(row.loginMethods) }
}

export async function writeUsers(users: any[]): Promise<void> {
  for (const u of users) {
    const existing = await queryOne('SELECT id FROM users WHERE id = ?', [u.id])
    if (existing) {
      await query(
        `UPDATE users SET phone=?, password=?, nickname=?, teamName=?, role=?, status=?, alipayUserId=?, wechatOpenId=?, loginMethods=?, updatedAt=NOW() WHERE id=?`,
        [u.phone || '', u.password || '', u.nickname || '', u.teamName || '', u.role || 'user', u.status || 'active', u.alipayUserId || '', u.wechatOpenId || '', serialize(u.loginMethods), u.id]
      )
    } else {
      await query(
        `INSERT INTO users (id, phone, password, nickname, teamName, role, status, alipayUserId, wechatOpenId, loginMethods, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [u.id, u.phone || '', u.password || '', u.nickname || '', u.teamName || '', u.role || 'user', u.status || 'active', u.alipayUserId || '', u.wechatOpenId || '', serialize(u.loginMethods)]
      )
    }
  }
}

export async function insertUser(u: any): Promise<void> {
  await query(
    `INSERT INTO users (id, phone, password, nickname, teamName, role, status, alipayUserId, wechatOpenId, loginMethods, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [u.id, u.phone || '', u.password || '', u.nickname || '', u.teamName || '', u.role || 'user', u.status || 'active', u.alipayUserId || '', u.wechatOpenId || '', serialize(u.loginMethods)]
  )
}

export async function updateUser(id: string, fields: Record<string, any>): Promise<void> {
  const sets: string[] = []
  const values: any[] = []
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id') continue
    sets.push(`${key} = ?`)
    if (key === 'loginMethods') {
      values.push(serialize(val))
    } else {
      values.push(val ?? '')
    }
  }
  if (sets.length === 0) return
  sets.push('updatedAt = NOW()')
  values.push(id)
  await query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, values)
}

export async function deleteUser(id: string): Promise<void> {
  await query('DELETE FROM users WHERE id = ?', [id])
}

// ============ Orders ============

export async function readOrders(): Promise<any[]> {
  return await query('SELECT * FROM orders WHERE deleted = 0 ORDER BY createdAt DESC')
}

export async function readOrder(id: string): Promise<any> {
  return await queryOne('SELECT * FROM orders WHERE id = ? AND deleted = 0', [id])
}

// 优化的订单统计（直接用SQL计数）
export async function getOrderStats(managerId?: string): Promise<any> {
  let whereClause = 'deleted = 0'
  const params: any[] = []
  if (managerId) {
    whereClause += ' AND managerId = ?'
    params.push(managerId)
  }

  const totalRes = await queryOne(`SELECT COUNT(*) as total FROM orders WHERE ${whereClause}`, params)
  const pendingRes = await queryOne(`SELECT COUNT(*) as count FROM orders WHERE ${whereClause} AND status = ?`, [...params, 'pending'])
  const approvedRes = await queryOne(`SELECT COUNT(*) as count FROM orders WHERE ${whereClause} AND status = ?`, [...params, 'approved'])
  const pendingPaymentRes = await queryOne(`SELECT COUNT(*) as count FROM orders WHERE ${whereClause} AND status = ?`, [...params, 'pending_payment'])
  const settledRes = await queryOne(`SELECT COUNT(*) as count FROM orders WHERE ${whereClause} AND status = ?`, [...params, 'settled'])
  const rejectedRes = await queryOne(`SELECT COUNT(*) as count FROM orders WHERE ${whereClause} AND status = ?`, [...params, 'rejected'])

  return {
    total: totalRes?.total || 0,
    pending: pendingRes?.count || 0,
    approved: approvedRes?.count || 0,
    pendingPayment: pendingPaymentRes?.count || 0,
    settled: settledRes?.count || 0,
    rejected: rejectedRes?.count || 0,
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
        `UPDATE orders SET productId=?, userId=?, managerId=?, productName=?, productPrice=?, optionLabel=?, redirectUrl=?, userName=?, userPhone=?, teamName=?, status=?, reviewedAt=?, rejectReason=?, addedToPaymentAt=?, settledAt=?, transferredFromManager=?, transferredAt=?, managedBy=? WHERE id=?`,
        [o.productId || '', o.userId || '', o.managerId || '', o.productName || '', o.productPrice || 0, o.optionLabel || '', o.redirectUrl || '', o.userName || '', o.userPhone || '', o.teamName || '', o.status || 'pending', o.reviewedAt || null, o.rejectReason || '', o.addedToPaymentAt || null, o.settledAt || null, o.transferredFromManager || '', o.transferredAt || null, o.managedBy || 'manager', o.id]
      )
    } else {
      await query(
        `INSERT INTO orders (id, productId, userId, managerId, productName, productPrice, optionLabel, redirectUrl, userName, userPhone, teamName, status, reviewedAt, rejectReason, addedToPaymentAt, settledAt, transferredFromManager, transferredAt, managedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [o.id, o.productId || '', o.userId || '', o.managerId || '', o.productName || '', o.productPrice || 0, o.optionLabel || '', o.redirectUrl || '', o.userName || '', o.userPhone || '', o.teamName || '', o.status || 'pending', o.reviewedAt || null, o.rejectReason || '', o.addedToPaymentAt || null, o.settledAt || null, o.transferredFromManager || '', o.transferredAt || null, o.managedBy || 'manager']
      )
    }
  }
}

export async function insertOrder(o: any): Promise<void> {
  await query(
    `INSERT INTO orders (id, productId, userId, managerId, productName, productPrice, optionLabel, redirectUrl, userName, userPhone, teamName, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [o.id, o.productId || '', o.userId || '', o.managerId || '', o.productName || '', o.productPrice || 0, o.optionLabel || '', o.redirectUrl || '', o.userName || '', o.userPhone || '', o.teamName || '', o.status || 'pending']
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

// ============ Commissions ============

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
        `INSERT INTO commissions (id, orderId, userId, managerId, productName, amount, status, approvedAt, paidAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [c.id, c.orderId || '', c.userId || '', c.managerId || '', c.productName || '', c.amount || 0, c.status || 'pending', c.approvedAt || null, c.paidAt || null]
      )
    }
  }
}

export async function insertCommission(c: any): Promise<void> {
  await query(
    `INSERT INTO commissions (id, orderId, userId, managerId, productName, amount, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
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

// ============ Employees (员工子账户) ============

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
  
  // 检查密码是否匹配
  if (row.password !== password) return null
  
  // 检查是否过期
  const now = new Date()
  const expiresAt = new Date(row.expiresAt)
  if (expiresAt < now) return null
  
  return {
    ...row,
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
  }
}

// ============ Operation Logs (操作日志) ============

export async function insertOperationLog(log: {
  adminId: string
  adminPhone: string
  adminName: string
  operationType: string
  targetType: string
  targetId: string
  targetName: string
  reason?: string
  detail?: string
}): Promise<void> {
  const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  await query(
    `INSERT INTO operation_logs (id, adminId, adminPhone, adminName, operationType, targetType, targetId, targetName, reason, detail, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [id, log.adminId, log.adminPhone, log.adminName, log.operationType, log.targetType, log.targetId, log.targetName, log.reason || '', log.detail || '']
  )
}

export async function readOperationLogs(params?: {
  adminId?: string
  operationType?: string
  targetType?: string
  page?: number
  pageSize?: number
}): Promise<{ list: any[]; total: number }> {
  let queryStr = 'SELECT * FROM operation_logs'
  const values: any[] = []
  const conditions: string[] = []

  if (params?.adminId) {
    conditions.push('adminId = ?')
    values.push(params.adminId)
  }
  if (params?.operationType) {
    conditions.push('operationType = ?')
    values.push(params.operationType)
  }
  if (params?.targetType) {
    conditions.push('targetType = ?')
    values.push(params.targetType)
  }

  if (conditions.length > 0) {
    queryStr += ' WHERE ' + conditions.join(' AND ')
  }

  queryStr += ' ORDER BY createdAt DESC'

  const total = await queryOne('SELECT COUNT(*) as count FROM operation_logs' + (conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : ''), values)
  const totalCount = total?.count || 0

  const pageNum = params?.page || 1
  const pageSizeNum = params?.pageSize || 20
  const offset = (pageNum - 1) * pageSizeNum
  
  const rows = await query(queryStr + ' LIMIT ? OFFSET ?', [...values, pageSizeNum, offset])
  
  return {
    list: (rows as any[]).map(row => ({
      ...row,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    })),
    total: totalCount,
  }
}
