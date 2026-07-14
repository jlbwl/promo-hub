
import { query, queryOne } from './db.js'
export { query, queryOne }

import bcrypt from 'bcryptjs'

// ============ 通用辅助函数 ============

// 密码验证函数
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}

function serialize(val: any): string {
  // 确保总是返回有效的 JSON 数组字符串
  try {
    if (val === null || val === undefined) {
      return JSON.stringify(["sms"])
    }
    if (Array.isArray(val)) {
      return JSON.stringify(val)
    }
    // 如果已经是字符串，先尝试解析
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed)) {
          return JSON.stringify(parsed)
        }
      } catch {
        // 解析失败，继续下面的处理
      }
    }
    // 兜底返回 ["sms"]
    return JSON.stringify(["sms"])
  } catch (e) {
    console.warn('[serialize] 序列化失败，返回默认值', e)
    return JSON.stringify(["sms"])
  }
}

function formatDateTime(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return date.toISOString().replace('T', ' ').substring(0, 19)
}

export function deserialize(val: any): any {
  if (val === null || val === undefined) return null
  if (typeof val === 'string') {
    try { 
      const parsed = JSON.parse(val)
      // 确保返回的是数组
      if (!Array.isArray(parsed)) {
        return ["sms"]
      }
      return parsed
    } catch { 
      // 如果解析失败，返回默认值
      return ["sms"]
    }
  }
  // 如果不是字符串但也不是数组，返回默认值
  if (!Array.isArray(val)) {
    return ["sms"]
  }
  return val
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const result = await queryOne(
      `SHOW COLUMNS FROM ${tableName} LIKE ?`,
      [columnName]
    )
    return !!result
  } catch (e) {
    console.warn(`[columnExists] Failed to check column ${tableName}.${columnName}:`, e)
    return false
  }
}

async function ensureProductCategoryColumns(): Promise<void> {
  try {
    await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS categoryId VARCHAR(100) DEFAULT "" AFTER category')
    console.log('[DB] Added/verified categoryId column')
  } catch (e) {
    console.warn('[DB] categoryId column already exists or failed to add:', e)
  }
  try {
    await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS categoryNameSnapshot VARCHAR(200) DEFAULT "" AFTER categoryId')
    console.log('[DB] Added/verified categoryNameSnapshot column')
  } catch (e) {
    console.warn('[DB] categoryNameSnapshot column already exists or failed to add:', e)
  }
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
  await ensureProductCategoryColumns()
  const hasCategoryId = await columnExists('products', 'categoryId')
  const hasCategoryNameSnapshot = await columnExists('products', 'categoryNameSnapshot')

  for (const p of products) {
    const existing = await queryOne('SELECT id FROM products WHERE id = ?', [p.id])
    if (existing) {
      let updateColumns = [
        'title=?', 'description=?', 'coverImage=?', 'images=?', 'price=?',
        'originalPrice=?', 'category=?', 'status=?', 'managerId=?', 'stock=?',
        'options=?', 'publishedBy=?', 'publishedAt=?', 'offlineReason=?',
        'offlineAt=?', 'requireName=?', 'requirePhone=?', 'updatedAt=NOW()'
      ]
      let updateValues = [
        p.title || '', p.description || '', p.coverImage || '', serialize(p.images),
        p.price || 0, p.originalPrice || 0, p.category || '', p.status || 'draft',
        p.managerId || '', p.stock || 0, serialize(p.options), p.publishedBy || '',
        formatDateTime(p.publishedAt), p.offlineReason || '', formatDateTime(p.offlineAt),
        p.requireName ? 1 : 0, p.requirePhone ? 1 : 0, p.id
      ]

      if (hasCategoryId) {
        updateColumns.push('categoryId=?')
        updateValues.splice(updateValues.length - 1, 0, p.categoryId || '')
      }
      if (hasCategoryNameSnapshot) {
        updateColumns.push('categoryNameSnapshot=?')
        updateValues.splice(updateValues.length - 1, 0, p.categoryNameSnapshot || '')
      }

      await query(
        `UPDATE products SET ${updateColumns.join(', ')} WHERE id=?`,
        updateValues
      )
    } else {
      let insertColumns = [
        'id', 'title', 'description', 'coverImage', 'images', 'price', 'originalPrice',
        'category', 'status', 'managerId', 'stock', 'options', 'publishedBy',
        'publishedAt', 'offlineReason', 'offlineAt', 'requireName', 'requirePhone', 'createdAt'
      ]
      let insertValues = [
        p.id, p.title || '', p.description || '', p.coverImage || '', serialize(p.images),
        p.price || 0, p.originalPrice || 0, p.category || '', p.status || 'draft',
        p.managerId || '', p.stock || 0, serialize(p.options), p.publishedBy || '',
        formatDateTime(p.publishedAt), p.offlineReason || '', formatDateTime(p.offlineAt),
        p.requireName ? 1 : 0, p.requirePhone ? 1 : 0
      ]
      let placeholders = Array(insertValues.length).fill('?')
      placeholders.push('NOW()')

      if (hasCategoryId) {
        insertColumns.push('categoryId')
        insertValues.push(p.categoryId || '')
        placeholders.push('?')
      }
      if (hasCategoryNameSnapshot) {
        insertColumns.push('categoryNameSnapshot')
        insertValues.push(p.categoryNameSnapshot || '')
        placeholders.push('?')
      }

      await query(
        `INSERT INTO products (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`,
        insertValues
      )
    }
  }
}

export async function insertProduct(p: any): Promise<void> {
  console.log('[insertProduct] Starting product insertion')
  console.log('[insertProduct] Input product data:', JSON.stringify({
    id: p.id,
    title: p.title,
    category: p.category,
    categoryId: p.categoryId,
    categoryNameSnapshot: p.categoryNameSnapshot,
    status: p.status,
    managerId: p.managerId
  }, null, 2))
  
  await ensureProductCategoryColumns()
  const hasCategoryId = await columnExists('products', 'categoryId')
  const hasCategoryNameSnapshot = await columnExists('products', 'categoryNameSnapshot')
  console.log('[insertProduct] hasCategoryId:', hasCategoryId, 'hasCategoryNameSnapshot:', hasCategoryNameSnapshot)

  // 基础字段
  const columns: string[] = ['id', 'title', 'description', 'coverImage', 'images', 'price', 'originalPrice', 'category']
  const values: any[] = [
    p.id,
    p.title || '',
    p.description || '',
    p.coverImage || '',
    serialize(p.images),
    p.price || 0,
    p.originalPrice || 0,
    p.category || ''
  ]

  // 分类关联字段
  if (hasCategoryId) {
    columns.push('categoryId')
    const categoryId = p.categoryId || ''
    values.push(categoryId)
    console.log('[insertProduct] Adding categoryId:', categoryId)
  }
  if (hasCategoryNameSnapshot) {
    columns.push('categoryNameSnapshot')
    const categoryNameSnapshot = p.categoryNameSnapshot || ''
    values.push(categoryNameSnapshot)
    console.log('[insertProduct] Adding categoryNameSnapshot:', categoryNameSnapshot)
  }

  // 产品状态和基础信息
  const productStatus = p.status || 'published'
  const publishedAtValue = (productStatus === 'published' && p.publishedAt) ? formatDateTime(p.publishedAt) : null

  columns.push('status', 'managerId', 'stock', 'options', 'publishedBy', 'publishedAt', 'requireName', 'requirePhone', 'createdAt')
  values.push(
    productStatus,
    p.managerId || '',
    p.stock || 0,
    serialize(p.options),
    p.publishedBy || '',
    publishedAtValue,
    p.requireName ? 1 : 0,
    p.requirePhone ? 1 : 0,
  )

  const placeholders = values.map(() => '?')
  placeholders.push('NOW()')

  if (columns.length !== placeholders.length) {
    console.error('[insertProduct] Columns and placeholders count mismatch!')
    console.error('[insertProduct] Columns:', columns)
    console.error('[insertProduct] Values count:', values.length)
    console.error('[insertProduct] Placeholders count:', placeholders.length)
    throw new Error('Database insert field mismatch')
  }

  const sqlQuery = `INSERT INTO products (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`
  console.log('[insertProduct] Final SQL columns:', columns)
  console.log('[insertProduct] Final values count:', values.length)

  await query(sqlQuery, values)
  console.log('[insertProduct] Product inserted successfully!')
  
  // 验证插入
  const inserted = await queryOne('SELECT * FROM products WHERE id = ?', [p.id])
  console.log('[insertProduct] Verification - inserted product:', {
    id: inserted?.id,
    title: inserted?.title,
    category: inserted?.category,
    categoryId: inserted?.categoryId,
    categoryNameSnapshot: inserted?.categoryNameSnapshot,
    status: inserted?.status,
    managerId: inserted?.managerId
  })
}

export async function updateProduct(id: string, fields: Record<string, any>): Promise<void> {
  await ensureProductCategoryColumns()
  const hasCategoryId = await columnExists('products', 'categoryId')
  const hasCategoryNameSnapshot = await columnExists('products', 'categoryNameSnapshot')

  const sets: string[] = []
  const values: any[] = []
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id' || key === 'updatedAt') continue
    if (key === 'categoryId' && !hasCategoryId) continue
    if (key === 'categoryNameSnapshot' && !hasCategoryNameSnapshot) continue
    
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

// ============ 优化的产品查询方法 ============

export async function getProductsPaginated(params: {
  managerId?: string
  category?: string
  status?: string
  page?: number
  pageSize?: number
  keyword?: string
  adminMode?: boolean
}): Promise<{ list: any[]; total: number }> {
  try {
    console.log('[getProductsPaginated] ==================== START ====================')
    console.log('[getProductsPaginated] Input params:', JSON.stringify(params, null, 2))
    
    const whereConditions: string[] = []
    const values: any[] = []

    const hasManagerId = params.managerId !== undefined && params.managerId !== null && params.managerId !== ''
    const isAdminMode = params.adminMode === true
    
    console.log('[getProductsPaginated] hasManagerId:', hasManagerId, 'isAdminMode:', isAdminMode)
    
    // Manager ID 过滤
    if (hasManagerId) {
      console.log('[getProductsPaginated] Manager query, managerId:', params.managerId)
      whereConditions.push('managerId = ?')
      values.push(params.managerId)
    } else if (!isAdminMode) {
      console.log('[getProductsPaginated] User query, filtering by manager existence')
      whereConditions.push('(managerId IS NOT NULL AND managerId != "")')
    } else {
      console.log('[getProductsPaginated] Admin mode, no manager filter')
    }

    // Category 过滤 - 支持动态分类，不再使用硬编码
    if (params.category && params.category !== '0') {
      if (params.category === 'uncategorized') {
        console.log('[getProductsPaginated] Filtering uncategorized products')
        whereConditions.push('(category IS NULL OR category = "" OR categoryId IS NULL OR categoryId = "")')
      } else {
        console.log('[getProductsPaginated] Filtering by category:', params.category)
        whereConditions.push('category = ?')
        values.push(params.category)
      }
    } else {
      console.log('[getProductsPaginated] No category filter applied')
    }

    // Status 过滤 - 关键逻辑
    if (params.status) {
      const normalizedStatus = params.status.toLowerCase().trim()
      console.log('[getProductsPaginated] Filtering by status:', normalizedStatus)
      whereConditions.push('status = ?')
      values.push(normalizedStatus)
    } else if (!hasManagerId) {
      // 只有在没有 managerId 且没有指定状态时（用户端），才默认只显示 published
      console.log('[getProductsPaginated] No status filter, default to published for user view')
      whereConditions.push('status = "published"')
    } else {
      // 经理端和管理员端，不过滤状态
      console.log('[getProductsPaginated] No status filter for manager/admin view')
    }

    // Keyword 过滤
    if (params.keyword) {
      console.log('[getProductsPaginated] Filtering by keyword:', params.keyword)
      whereConditions.push('(title LIKE ? OR description LIKE ?)')
      values.push(`%${params.keyword}%`, `%${params.keyword}%`)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    console.log('[getProductsPaginated] Final WHERE clause:', whereClause)
    console.log('[getProductsPaginated] Query values:', values)

    // Count query
    const countResult = await queryOne(`SELECT COUNT(*) as total FROM products ${whereClause}`, values)
    const total = Number(countResult?.total) || 0
    console.log('[getProductsPaginated] Total products found:', total)

    // Pagination
    const page = parseInt(String(params.page || 1), 10)
    const pageSize = parseInt(String(params.pageSize || 10), 10)
    const offset = (page - 1) * pageSize

    console.log('[getProductsPaginated] Pagination: page', page, 'pageSize', pageSize, 'offset', offset)

    // Main query
    const sql = `SELECT * FROM products ${whereClause} ORDER BY COALESCE(publishedAt, createdAt) DESC LIMIT ? OFFSET ?`
    const allValues = [...values, pageSize, offset]
    console.log('[getProductsPaginated] SQL values with types:', allValues.map((v, i) => `${i}: ${v} (${typeof v})`))
    console.log('[getProductsPaginated] Executing SQL:', sql)
    console.log('[getProductsPaginated] SQL values:', allValues)
    
    let products = await query(sql, allValues)
    console.log('[getProductsPaginated] Products retrieved:', (products as any[]).length)
    console.log('[getProductsPaginated] Product IDs:', (products as any[]).map(p => ({ id: p.id, title: p.title, status: p.status, managerId: p.managerId })))

    // Get sales counts
    const salesResult = await query(`
      SELECT productId, COUNT(*) as salesCount
      FROM orders
      WHERE deleted = 0
      GROUP BY productId
    `)
    const salesMap = new Map()
    ;(salesResult as any[]).forEach(item => {
      salesMap.set(item.productId, Number(item.salesCount) || 0)
    })

    console.log('[getProductsPaginated] ==================== END ====================')

    return {
      list: (products as any[]).map(product => ({
        ...product,
        price: Number(product.price) || 0,
        originalPrice: Number(product.originalPrice) || 0,
        stock: Number(product.stock) || 0,
        requireName: Boolean(Number(product.requireName)),
        requirePhone: Boolean(Number(product.requirePhone)),
        images: deserialize(product.images),
        options: deserialize(product.options),
        sales: salesMap.get(product.id) || 0,
      })),
      total,
    }
  } catch (error: any) {
    console.error('[产品查询] 数据库错误:', error.message)
    console.error('[产品查询] 错误堆栈:', error.stack)
    console.log('[产品查询] 尝试使用文件存储...')
    
    try {
      const { readProducts, readOrders } = await import('./data-memory.js')
      let products = await readProducts()
      
      if (params.category && params.category !== '0') {
        products = products.filter((p: any) => p.category === params.category)
      }
      if (params.status) {
        products = products.filter((p: any) => p.status === params.status)
      } else if (!params.managerId) {
        products = products.filter((p: any) => p.status === 'published')
      }
      if (params.keyword) {
        const keyword = params.keyword.toLowerCase()
        products = products.filter((p: any) => 
          p.title?.toLowerCase().includes(keyword) || 
          p.description?.toLowerCase().includes(keyword)
        )
      }
      
      const orders = await readOrders()
      const salesMap = new Map()
      orders.forEach((o: any) => {
        const count = salesMap.get(o.productId) || 0
        salesMap.set(o.productId, count + 1)
      })
      
      const total = products.length
      const page = params.page || 1
      const pageSize = parseInt(String(params.pageSize || 10), 10)
      const offset = (page - 1) * pageSize
      products = products.slice(offset, offset + pageSize)
      
      return {
        list: products.map((product: any) => ({
          ...product,
          price: Number(product.price) || 0,
          originalPrice: Number(product.originalPrice) || 0,
          stock: Number(product.stock) || 0,
          requireName: Boolean(Number(product.requireName)),
          requirePhone: Boolean(Number(product.requirePhone)),
          images: product.images || [],
          options: product.options || [],
          sales: salesMap.get(product.id) || 0,
        })),
        total,
      }
    } catch (fallbackError: any) {
      console.error('[产品查询] 文件存储也失败:', fallbackError.message)
      throw new Error('获取产品列表失败')
    }
  }
}

// ============ Managers ============

export async function readManagers(): Promise<any[]> {
  return await query('SELECT * FROM managers ORDER BY createdAt DESC')
}

export async function readManager(id: string): Promise<any> {
  return await queryOne('SELECT * FROM managers WHERE id = ?', [id])
}

export async function writeManagers(managers: any[]): Promise<void> {
  const hasRole = await columnExists('managers', 'role')
  
  for (const m of managers) {
    const existing = await queryOne('SELECT id FROM managers WHERE id = ?', [m.id])
    if (existing) {
      let updateColumns = ['username=?', 'password=?', 'name=?', 'phone=?', 'status=?', 'teamName=?', 'updatedAt=NOW()']
      let updateValues = [m.username || '', m.password || '', m.name || '', m.phone || '', m.status || 'active', m.teamName || '', m.id]
      
      if (hasRole) {
        updateColumns.splice(updateColumns.length - 2, 0, 'role=?')
        updateValues.splice(updateValues.length - 1, 0, m.role || 'manager')
      }
      
      await query(`UPDATE managers SET ${updateColumns.join(', ')} WHERE id=?`, updateValues)
    } else {
      let insertColumns = ['id', 'username', 'password', 'name', 'phone', 'status', 'teamName', 'createdAt']
      let insertValues = [m.id, m.username || '', m.password || '', m.name || '', m.phone || '', m.status || 'active', m.teamName || '']
      let placeholders = insertValues.map(() => '?')
      placeholders.push('NOW()')
      
      if (hasRole) {
        insertColumns.splice(insertColumns.length - 1, 0, 'role')
        insertValues.push(m.role || 'manager')
        placeholders.splice(placeholders.length - 1, 0, '?')
      }
      
      await query(`INSERT INTO managers (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`, insertValues)
    }
  }
}

export async function insertManager(m: any): Promise<void> {
  const hasRole = await columnExists('managers', 'role')
  
  let insertColumns = ['id', 'username', 'password', 'name', 'phone', 'status', 'teamName', 'createdAt']
  let insertValues = [m.id, m.username || '', m.password || '', m.name || '', m.phone || '', m.status || 'active', m.teamName || '']
  let placeholders = insertValues.map(() => '?')
  placeholders.push('NOW()')
  
  if (hasRole) {
    insertColumns.splice(insertColumns.length - 1, 0, 'role')
    insertValues.push(m.role || 'manager')
    placeholders.splice(placeholders.length - 1, 0, '?')
  }
  
  await query(`INSERT INTO managers (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`, insertValues)
}

export async function updateManager(id: string, fields: Record<string, any>): Promise<void> {
  const hasRole = await columnExists('managers', 'role')
  const sets: string[] = []
  const values: any[] = []
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id') continue
    if (key === 'role' && !hasRole) continue
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
  const hasRole = await columnExists('users', 'role')
  
  // 不再自动修复 loginMethods，避免触发错误
  // 如果需要修复，后续可以单独调用一个安全的修复函数
  
  for (const u of users) {
    const existing = await queryOne('SELECT id FROM users WHERE id = ?', [u.id])
    if (existing) {
      let updateColumns = ['phone=?', 'password=?', 'nickname=?', 'teamName=?', 'status=?', 'alipayUserId=?', 'wechatOpenId=?', 'loginMethods=?', 'updatedAt=NOW()']
      let updateValues = [u.phone || '', u.password || '', u.nickname || '', u.teamName || '', u.status || 'active', u.alipayUserId || '', u.wechatOpenId || '', serialize(u.loginMethods), u.id]
      
      if (hasRole) {
        updateColumns.splice(updateColumns.length - 3, 0, 'role=?')
        updateValues.splice(updateValues.length - 1, 0, u.role || 'user')
      }
      
      try {
        await query(`UPDATE users SET ${updateColumns.join(', ')} WHERE id=?`, updateValues)
      } catch (e) {
        console.error('[writeUsers] 更新用户失败', { userId: u.id, error: e })
        // 如果 loginMethods 导致错误，尝试不更新它
        try {
          const safeUpdateColumns = updateColumns.filter(c => c !== 'loginMethods=?')
          const safeUpdateValues = updateValues.filter((_, i) => updateColumns[i] !== 'loginMethods=?')
          await query(`UPDATE users SET ${safeUpdateColumns.join(', ')} WHERE id=?`, safeUpdateValues)
          console.log('[writeUsers] 安全更新成功（跳过 loginMethods）', { userId: u.id })
        } catch (e2) {
          console.error('[writeUsers] 安全更新也失败了', { userId: u.id, error: e2 })
          throw e2
        }
      }
    } else {
      let insertColumns = ['id', 'phone', 'password', 'nickname', 'teamName', 'status', 'alipayUserId', 'wechatOpenId', 'loginMethods', 'createdAt']
      let insertValues = [u.id, u.phone || '', u.password || '', u.nickname || '', u.teamName || '', u.status || 'active', u.alipayUserId || '', u.wechatOpenId || '', serialize(u.loginMethods)]
      let placeholders = insertValues.map(() => '?')
      placeholders.push('NOW()')
      
      if (hasRole) {
        insertColumns.splice(insertColumns.length - 2, 0, 'role')
        insertValues.push(u.role || 'user')
        placeholders.splice(placeholders.length - 1, 0, '?')
      }
      
      try {
        await query(`INSERT INTO users (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`, insertValues)
      } catch (e) {
        console.error('[writeUsers] 插入用户失败', { userId: u.id, error: e })
        // 如果 loginMethods 导致错误，尝试用默认值
        try {
          const safeInsertColumns = insertColumns.filter(c => c !== 'loginMethods')
          const safeInsertValues = insertValues.filter((_, i) => insertColumns[i] !== 'loginMethods')
          safeInsertColumns.push('loginMethods')
          safeInsertValues.push(JSON.stringify(["sms"]))
          const safePlaceholders = safeInsertValues.map(() => '?')
          safePlaceholders[safePlaceholders.length - 1] = 'NOW()'
          
          await query(`INSERT INTO users (${safeInsertColumns.join(', ')}) VALUES (${safePlaceholders.join(', ')})`, safeInsertValues)
          console.log('[writeUsers] 安全插入成功（使用默认 loginMethods）', { userId: u.id })
        } catch (e2) {
          console.error('[writeUsers] 安全插入也失败了', { userId: u.id, error: e2 })
          throw e2
        }
      }
    }
  }
}

export async function insertUser(u: any): Promise<void> {
  const hasRole = await columnExists('users', 'role')
  
  let insertColumns = ['id', 'phone', 'password', 'nickname', 'teamName', 'status', 'alipayUserId', 'wechatOpenId', 'loginMethods', 'createdAt']
  let insertValues = [u.id, u.phone || '', u.password || '', u.nickname || '', u.teamName || '', u.status || 'active', u.alipayUserId || '', u.wechatOpenId || '', serialize(u.loginMethods)]
  let placeholders = insertValues.map(() => '?')
  placeholders.push('NOW()')
  
  if (hasRole) {
    insertColumns.splice(insertColumns.length - 2, 0, 'role')
    insertValues.push(u.role || 'user')
    placeholders.splice(placeholders.length - 1, 0, '?')
  }
  
  await query(`INSERT INTO users (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')})`, insertValues)
}

export async function updateUser(id: string, fields: Record<string, any>): Promise<void> {
  const hasRole = await columnExists('users', 'role')
  const sets: string[] = []
  const values: any[] = []
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id') continue
    if (key === 'role' && !hasRole) continue
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

// ============ 优化的订单查询方法 ============

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

// ============ Employees (员工子账户) ============

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

// ============ QR Codes ============

export async function ensureQrCodesTable(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS qr_codes (
        id VARCHAR(100) PRIMARY KEY,
        url VARCHAR(500) NOT NULL,
        data_url TEXT NOT NULL,
        center_text VARCHAR(50) DEFAULT '',
        top_text VARCHAR(50) DEFAULT '',
        is_default TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY idx_url (url)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
    console.log('[DB] qr_codes table created/verified')
  } catch (e) {
    console.warn('[DB] qr_codes table creation failed:', e)
  }
}

export async function readQrCodes(): Promise<any[]> {
  const rows = await query('SELECT * FROM qr_codes ORDER BY created_at DESC')
  return (rows as any[]).map(row => ({
    id: row.id,
    url: row.url,
    dataUrl: row.data_url,
    centerText: row.center_text || '',
    topText: row.top_text || '',
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

export async function readQrCodeById(id: string): Promise<any> {
  const row = await queryOne('SELECT * FROM qr_codes WHERE id = ?', [id])
  if (!row) return null
  return {
    id: row.id,
    url: row.url,
    dataUrl: row.data_url,
    centerText: row.center_text || '',
    topText: row.top_text || '',
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export async function insertQrCode(qrCode: {
  id: string
  url: string
  dataUrl: string
  centerText?: string
  topText?: string
  isDefault?: boolean
}): Promise<void> {
  await ensureQrCodesTable()
  await query(
    `INSERT INTO qr_codes (id, url, data_url, center_text, top_text, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [qrCode.id, qrCode.url, qrCode.dataUrl, qrCode.centerText || '', qrCode.topText || '', qrCode.isDefault ? 1 : 0]
  )
}

export async function updateQrCode(id: string, fields: Record<string, any>): Promise<void> {
  const sets: string[] = []
  const values: any[] = []
  for (const [key, val] of Object.entries(fields)) {
    if (key === 'id') continue
    if (key === 'dataUrl') {
      sets.push('data_url = ?')
    } else if (key === 'centerText') {
      sets.push('center_text = ?')
    } else if (key === 'topText') {
      sets.push('top_text = ?')
    } else if (key === 'isDefault') {
      sets.push('is_default = ?')
      values.push(val ? 1 : 0)
      continue
    } else {
      sets.push(`${key} = ?`)
    }
    values.push(val ?? '')
  }
  if (sets.length === 0) return
  sets.push('updated_at = NOW()')
  values.push(id)
  await query(`UPDATE qr_codes SET ${sets.join(', ')} WHERE id = ?`, values)
}

export async function deleteQrCode(id: string): Promise<void> {
  await query('DELETE FROM qr_codes WHERE id = ?', [id])
}

export async function setDefaultQrCode(id: string): Promise<void> {
  await query('UPDATE qr_codes SET is_default = 0')
  await query('UPDATE qr_codes SET is_default = 1 WHERE id = ?', [id])
}

export async function readDefaultQrCode(): Promise<any> {
  const row = await queryOne('SELECT * FROM qr_codes WHERE is_default = 1 LIMIT 1')
  if (!row) return null
  return {
    id: row.id,
    url: row.url,
    dataUrl: row.data_url,
    centerText: row.center_text || '',
    topText: row.top_text || '',
    isDefault: true,
    createdAt: row.created_at,
    updatedAt: row.updated_at
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

  const pageNum = parseInt(String(params?.page || 1), 10)
  const pageSizeNum = parseInt(String(params?.pageSize || 20), 10)
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
