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

// ============ Products ============

export async function readProducts(): Promise<any[]> {
  const rows = await query('SELECT * FROM products ORDER BY createdAt DESC')
  return (rows as any[]).map(row => ({
    ...row,
    price: Number(row.price) || 0,
    originalPrice: Number(row.originalPrice) || 0,
    commission: Number(row.commission) || 0,
    commissionRate: Number(row.commissionRate) || 0,
    stock: Number(row.stock) || 0,
    images: deserialize(row.images),
    tags: deserialize(row.tags),
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
    commission: Number(row.commission) || 0,
    commissionRate: Number(row.commissionRate) || 0,
    stock: Number(row.stock) || 0,
    images: deserialize(row.images),
    tags: deserialize(row.tags),
    options: deserialize(row.options),
  }
}

export async function writeProducts(products: any[]): Promise<void> {
  for (const p of products) {
    const existing = await queryOne('SELECT id FROM products WHERE id = ?', [p.id])
    if (existing) {
      await query(
        `UPDATE products SET title=?, description=?, coverImage=?, images=?, price=?, originalPrice=?, commission=?, commissionRate=?, category=?, tags=?, status=?, managerId=?, stock=?, options=?, publishedBy=?, publishedAt=?, offlineReason=?, offlineAt=?, updatedAt=NOW() WHERE id=?`,
        [p.title || '', p.description || '', p.coverImage || '', serialize(p.images), p.price || 0, p.originalPrice || 0, p.commission || 0, p.commissionRate || 0, p.category || '', serialize(p.tags), p.status || 'draft', p.managerId || '', p.stock || 0, serialize(p.options), p.publishedBy || '', formatDateTime(p.publishedAt), p.offlineReason || '', formatDateTime(p.offlineAt), p.id]
      )
    } else {
      await query(
        `INSERT INTO products (id, title, description, coverImage, images, price, originalPrice, commission, commissionRate, category, tags, status, managerId, stock, options, publishedBy, publishedAt, offlineReason, offlineAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [p.id, p.title || '', p.description || '', p.coverImage || '', serialize(p.images), p.price || 0, p.originalPrice || 0, p.commission || 0, p.commissionRate || 0, p.category || '', serialize(p.tags), p.status || 'draft', p.managerId || '', p.stock || 0, serialize(p.options), p.publishedBy || '', formatDateTime(p.publishedAt), p.offlineReason || '', formatDateTime(p.offlineAt)]
      )
    }
  }
}

export async function insertProduct(p: any): Promise<void> {
  await query(
    `INSERT INTO products (id, title, description, coverImage, images, price, originalPrice, commission, commissionRate, category, tags, status, managerId, stock, options, publishedBy, publishedAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [p.id, p.title || '', p.description || '', p.coverImage || '', serialize(p.images), p.price || 0, p.originalPrice || 0, p.commission || 0, p.commissionRate || 0, p.category || '', serialize(p.tags), p.status || 'draft', p.managerId || '', p.stock || 0, serialize(p.options), p.publishedBy || '', formatDateTime(p.publishedAt)]
  )
}

export async function updateProduct(id: string, fields: Record<string, any>): Promise<void> {
  const sets: string[] = []
  const values: any[] = []
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id' || key === 'updatedAt') continue
    sets.push(`${key} = ?`)
    if (key === 'images' || key === 'tags' || key === 'options') {
      values.push(serialize(val))
    } else if (key === 'publishedAt' || key === 'offlineAt') {
      values.push(formatDateTime(val))
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
        `UPDATE managers SET username=?, password=?, name=?, phone=?, status=?, updatedAt=NOW() WHERE id=?`,
        [m.username || '', m.password || '', m.name || '', m.phone || '', m.status || 'active', m.id]
      )
    } else {
      await query(
        `INSERT INTO managers (id, username, password, name, phone, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [m.id, m.username || '', m.password || '', m.name || '', m.phone || '', m.status || 'active']
      )
    }
  }
}

export async function insertManager(m: any): Promise<void> {
  await query(
    `INSERT INTO managers (id, username, password, name, phone, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [m.id, m.username || '', m.password || '', m.name || '', m.phone || '', m.status || 'active']
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
        `UPDATE users SET phone=?, password=?, nickname=?, role=?, status=?, alipayUserId=?, wechatOpenId=?, loginMethods=?, updatedAt=NOW() WHERE id=?`,
        [u.phone || '', u.password || '', u.nickname || '', u.role || 'user', u.status || 'active', u.alipayUserId || '', u.wechatOpenId || '', serialize(u.loginMethods), u.id]
      )
    } else {
      await query(
        `INSERT INTO users (id, phone, password, nickname, role, status, alipayUserId, wechatOpenId, loginMethods, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [u.id, u.phone || '', u.password || '', u.nickname || '', u.role || 'user', u.status || 'active', u.alipayUserId || '', u.wechatOpenId || '', serialize(u.loginMethods)]
      )
    }
  }
}

export async function insertUser(u: any): Promise<void> {
  await query(
    `INSERT INTO users (id, phone, password, nickname, role, status, alipayUserId, wechatOpenId, loginMethods, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [u.id, u.phone || '', u.password || '', u.nickname || '', u.role || 'user', u.status || 'active', u.alipayUserId || '', u.wechatOpenId || '', serialize(u.loginMethods)]
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

// ============ Orders ============

export async function readOrders(): Promise<any[]> {
  return await query('SELECT * FROM orders ORDER BY createdAt DESC')
}

export async function readOrder(id: string): Promise<any> {
  return await queryOne('SELECT * FROM orders WHERE id = ?', [id])
}

export async function writeOrders(orders: any[]): Promise<void> {
  for (const o of orders) {
    const existing = await queryOne('SELECT id FROM orders WHERE id = ?', [o.id])
    if (existing) {
      await query(
        `UPDATE orders SET productId=?, userId=?, managerId=?, productName=?, productPrice=?, optionLabel=?, redirectUrl=?, userName=?, userPhone=?, status=?, reviewedAt=?, rejectReason=?, addedToPaymentAt=?, settledAt=?, transferredFromManager=?, transferredAt=?, managedBy=? WHERE id=?`,
        [o.productId || '', o.userId || '', o.managerId || '', o.productName || '', o.productPrice || 0, o.optionLabel || '', o.redirectUrl || '', o.userName || '', o.userPhone || '', o.status || 'pending', o.reviewedAt || null, o.rejectReason || '', o.addedToPaymentAt || null, o.settledAt || null, o.transferredFromManager || '', o.transferredAt || null, o.managedBy || 'manager', o.id]
      )
    } else {
      await query(
        `INSERT INTO orders (id, productId, userId, managerId, productName, productPrice, optionLabel, redirectUrl, userName, userPhone, status, reviewedAt, rejectReason, addedToPaymentAt, settledAt, transferredFromManager, transferredAt, managedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [o.id, o.productId || '', o.userId || '', o.managerId || '', o.productName || '', o.productPrice || 0, o.optionLabel || '', o.redirectUrl || '', o.userName || '', o.userPhone || '', o.status || 'pending', o.reviewedAt || null, o.rejectReason || '', o.addedToPaymentAt || null, o.settledAt || null, o.transferredFromManager || '', o.transferredAt || null, o.managedBy || 'manager']
      )
    }
  }
}

export async function insertOrder(o: any): Promise<void> {
  await query(
    `INSERT INTO orders (id, productId, userId, managerId, productName, productPrice, optionLabel, redirectUrl, userName, userPhone, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [o.id, o.productId || '', o.userId || '', o.managerId || '', o.productName || '', o.productPrice || 0, o.optionLabel || '', o.redirectUrl || '', o.userName || '', o.userPhone || '', o.status || 'pending']
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
