import { query, queryOne } from '../db.js'

export interface Category {
  id: string
  name: string
  value: string
  sort: number
  status: 'active' | 'archived'
  createdAt: string
  updatedAt: string
}

function generateId(): string {
  return `cat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 分类服务
 */
export class CategoryService {
  /**
   * 获取所有分类（按排序）
   */
  async getAllCategories(includeArchived = false): Promise<Category[]> {
    let sql = 'SELECT * FROM product_categories'
    const params: any[] = []

    if (!includeArchived) {
      sql += ' WHERE status = ?'
      params.push('active')
    }

    sql += ' ORDER BY sort ASC, id ASC'

    const rows = await query(sql, params)
    return rows as Category[]
  }

  /**
   * 根据ID获取分类
   */
  async getCategoryById(id: string): Promise<Category | null> {
    const row = await queryOne('SELECT * FROM product_categories WHERE id = ?', [id])
    return row as Category | null
  }

  /**
   * 创建分类
   */
  async createCategory(name: string, value: string, sort?: number): Promise<Category> {
    const id = generateId()
    const now = new Date().toISOString()

    await query(
      'INSERT INTO product_categories (id, name, value, sort, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, value, sort || 0, 'active', now, now]
    )

    return this.getCategoryById(id) as Promise<Category>
  }

  /**
   * 更新分类
   */
  async updateCategory(id: string, data: Partial<{ name: string; sort: number; status: 'active' | 'archived' }>): Promise<Category | null> {
    const category = await this.getCategoryById(id)
    if (!category) {
      return null
    }

    const updates: string[] = []
    const params: any[] = []

    if (data.name !== undefined) {
      updates.push('name = ?')
      params.push(data.name)

      // 同步更新所有产品的分类名称快照
      await query(
        'UPDATE products SET categoryNameSnapshot = ? WHERE categoryId = ?',
        [data.name, id]
      )
    }

    if (data.sort !== undefined) {
      updates.push('sort = ?')
      params.push(data.sort)
    }

    if (data.status !== undefined) {
      updates.push('status = ?')
      params.push(data.status)
    }

    if (updates.length === 0) {
      return category
    }

    updates.push('updatedAt = ?')
    params.push(new Date().toISOString())
    params.push(id)

    await query(`UPDATE product_categories SET ${updates.join(', ')} WHERE id = ?`, params)

    return this.getCategoryById(id)
  }

  /**
   * 删除分类（归档，不硬删除）
   */
  async archiveCategory(id: string): Promise<boolean> {
    const category = await this.getCategoryById(id)
    if (!category) {
      return false
    }

    await query('UPDATE product_categories SET status = ?, updatedAt = ? WHERE id = ?', [
      'archived',
      new Date().toISOString(),
      id
    ])

    return true
  }
}
