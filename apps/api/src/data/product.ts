
import { query, queryOne } from '../db.js'
import { deserialize, serialize, formatDateTime, columnExists, ensureProductCategoryColumns } from './utils.js'

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

    if (params.status) {
      const normalizedStatus = params.status.toLowerCase().trim()
      console.log('[getProductsPaginated] Filtering by status:', normalizedStatus)
      whereConditions.push('status = ?')
      values.push(normalizedStatus)
    } else if (!hasManagerId) {
      console.log('[getProductsPaginated] No status filter, default to published for user view')
      whereConditions.push('status = "published"')
    } else {
      console.log('[getProductsPaginated] No status filter for manager/admin view')
    }

    if (params.keyword) {
      console.log('[getProductsPaginated] Filtering by keyword:', params.keyword)
      whereConditions.push('(title LIKE ? OR description LIKE ?)')
      values.push(`%${params.keyword}%`, `%${params.keyword}%`)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    console.log('[getProductsPaginated] Final WHERE clause:', whereClause)
    console.log('[getProductsPaginated] Query values:', values)

    const countResult = await queryOne(`SELECT COUNT(*) as total FROM products ${whereClause}`, values)
    const total = Number(countResult?.total) || 0
    console.log('[getProductsPaginated] Total products found:', total)

    const page = parseInt(String(params.page || 1), 10)
    const pageSize = parseInt(String(params.pageSize || 10), 10)
    const offset = (page - 1) * pageSize

    console.log('[getProductsPaginated] Pagination: page', page, 'pageSize', pageSize, 'offset', offset)

    const sql = `SELECT * FROM products ${whereClause} ORDER BY COALESCE(publishedAt, createdAt) DESC LIMIT ? OFFSET ?`
    const allValues = [...values, pageSize, offset]
    console.log('[getProductsPaginated] SQL values with types:', allValues.map((v, i) => `${i}: ${v} (${typeof v})`))
    console.log('[getProductsPaginated] Executing SQL:', sql)
    console.log('[getProductsPaginated] SQL values:', allValues)
    
    let products = await query(sql, allValues)
    console.log('[getProductsPaginated] Products retrieved:', (products as any[]).length)
    console.log('[getProductsPaginated] Product IDs:', (products as any[]).map(p => ({ id: p.id, title: p.title, status: p.status, managerId: p.managerId })))

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
      const { readProducts, readOrders } = await import('../data-memory.js')
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
