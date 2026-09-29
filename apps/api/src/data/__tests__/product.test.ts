import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock 数据库连接层：data/product.ts 与 data/utils.ts（columnExists）均依赖 ../db.js
vi.mock('../../db.js', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  withTransaction: vi.fn(),
}))

import { query, queryOne } from '../../db.js'
import {
  updateProduct,
  insertProduct,
  readProducts,
  readProduct,
  incrementProductStock,
  deleteProduct,
} from '../product.js'

// 通过 INFORMATION_SCHEMA 查询的参数控制 columnExists 结果：
// params = [tableName, columnName]，仅 categoryId 列视为存在
const mockQueryOne = vi.mocked(queryOne)
const mockQuery = vi.mocked(query)

function setupColumnExists(options: { categoryId?: boolean; categoryNameSnapshot?: boolean } = {}) {
  mockQueryOne.mockImplementation(async (sql: string, params?: unknown[]) => {
    if (sql.includes('INFORMATION_SCHEMA')) {
      const column = params?.[1]
      if (column === 'categoryId') return options.categoryId ? { COLUMN_NAME: 'categoryId' } : null
      if (column === 'categoryNameSnapshot')
        return options.categoryNameSnapshot ? { COLUMN_NAME: 'categoryNameSnapshot' } : null
      return null
    }
    return null
  })
}

const lastSql = (): string => {
  const calls = mockQuery.mock.calls
  const last = calls[calls.length - 1]
  return String(last?.[0])
}

const lastParams = (): unknown[] => {
  const calls = mockQuery.mock.calls
  const last = calls[calls.length - 1]
  return (last?.[1] as unknown[]) ?? []
}

describe('data/product.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockResolvedValue({ affectedRows: 1 })
  })

  describe('updateProduct 动态 UPDATE', () => {
    it('普通字段生成参数化 SET 子句并追加 updatedAt = NOW()', async () => {
      setupColumnExists()
      await updateProduct('p_1', { title: '新产品', price: 199 })

      const sql = lastSql()
      expect(sql).toContain('UPDATE products SET')
      expect(sql).toContain('title = ?')
      expect(sql).toContain('price = ?')
      expect(sql).toContain('updatedAt = NOW()')
      expect(sql).toContain('WHERE id = ?')
      // 参数顺序：SET 值在前，id 在最后
      expect(lastParams()).toEqual(['新产品', 199, 'p_1'])
    })

    it('images/options 字段经 serialize 序列化为 JSON 字符串', async () => {
      setupColumnExists()
      await updateProduct('p_1', { images: ['https://a.png'], options: [{ label: '红' }] })

      expect(lastParams()[0]).toBe(JSON.stringify(['https://a.png']))
      expect(lastParams()[1]).toBe(JSON.stringify([{ label: '红' }]))
    })

    it('publishedAt/offlineAt 经 formatDateTime 转为 DATETIME 格式，null 保持 null', async () => {
      setupColumnExists()
      await updateProduct('p_1', {
        publishedAt: '2026-09-29T08:30:00.000Z',
        offlineAt: null,
      })

      expect(lastParams()[0]).toBe('2026-09-29 08:30:00')
      expect(lastParams()[1]).toBeNull()
    })

    it('布尔字段与 requireName/requirePhone 转换为 1/0', async () => {
      setupColumnExists()
      await updateProduct('p_1', { requireName: true, requirePhone: false })

      expect(lastParams()).toEqual([1, 0, 'p_1'])
    })

    it('null 值普通字段写入空字符串', async () => {
      setupColumnExists()
      await updateProduct('p_1', { offlineReason: null })

      expect(lastParams()).toEqual(['', 'p_1'])
    })

    it('id 与 updatedAt 字段被跳过，不允许更新主键和时间戳', async () => {
      setupColumnExists()
      await updateProduct('p_1', {
        id: 'p_hacked',
        updatedAt: '2026-01-01',
        title: '正常标题',
      } as Record<string, unknown>)

      const sql = lastSql()
      expect(sql).toContain('updatedAt = NOW()')
      // id 仅出现在 WHERE 子句，SET 子句中不含 id/updatedAt 字段
      expect(sql).not.toContain('id = ?,')
      expect(sql).not.toContain('updatedAt = ?')
      expect(lastParams()).toEqual(['正常标题', 'p_1'])
    })

    it('全部字段被跳过时（仅 id/updatedAt）不执行 SQL', async () => {
      setupColumnExists()
      await updateProduct('p_1', { id: 'p_hacked', updatedAt: '2026-01-01' } as Record<string, unknown>)

      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('categoryId 列不存在时跳过该字段', async () => {
      setupColumnExists({ categoryId: false })
      await updateProduct('p_1', { categoryId: 'c_1', title: '标题' })

      expect(lastSql()).not.toContain('categoryId')
      expect(lastParams()).toEqual(['标题', 'p_1'])
    })

    it('categoryId 列存在时正常更新', async () => {
      setupColumnExists({ categoryId: true })
      await updateProduct('p_1', { categoryId: 'c_1' })

      expect(lastSql()).toContain('categoryId = ?')
      expect(lastParams()).toEqual(['c_1', 'p_1'])
    })

    it('空更新对象不执行 SQL', async () => {
      setupColumnExists()
      await updateProduct('p_1', {})

      expect(mockQuery).not.toHaveBeenCalled()
    })

    it('非白名单字段被过滤，不拼进 SQL', async () => {
      setupColumnExists()
      await updateProduct('p_1', {
        title: '正常标题',
        createdAt: '2026-01-01',
        deleted: 1,
        malicious: 'x',
      })

      const sql = lastSql()
      expect(sql).toContain('title = ?')
      expect(sql).not.toContain('createdAt')
      expect(sql).not.toContain('deleted')
      expect(sql).not.toContain('malicious')
      expect(lastParams()).toEqual(['正常标题', 'p_1'])
    })
  })

  describe('insertProduct', () => {
    it('列数与占位符数一致，categoryId 列存在时纳入插入字段', async () => {
      setupColumnExists({ categoryId: true })
      await insertProduct({
        id: 'p_new',
        title: '测试产品',
        price: 100,
        images: [],
        options: [],
      } as unknown as Parameters<typeof insertProduct>[0])

      const sql = lastSql()
      expect(sql).toContain('INSERT INTO products')
      const columnPart = sql.match(/\(([^)]+)\)/)?.[1] ?? ''
      const columns = columnPart.split(',').map(c => c.trim())
      const placeholderPart = sql.match(/VALUES \(([^)]+)\)/)?.[1] ?? ''
      const placeholders = placeholderPart.split(',').map(p => p.trim())
      expect(columns.length).toBe(placeholders.length)
      expect(columns).toContain('categoryId')
      expect(lastParams()).toContain('p_new')
    })

    it('published 状态时 publishedAt 格式化为 DATETIME，draft 时为 null', async () => {
      setupColumnExists()
      await insertProduct({
        id: 'p_pub',
        title: '上架产品',
        status: 'published',
        publishedAt: '2026-09-29T08:00:00.000Z',
        images: [],
        options: [],
      } as unknown as Parameters<typeof insertProduct>[0])
      expect(lastParams()).toContain('2026-09-29 08:00:00')

      mockQuery.mockClear()
      await insertProduct({
        id: 'p_draft',
        title: '草稿产品',
        status: 'draft',
        publishedAt: '2026-09-29T08:00:00.000Z',
        images: [],
        options: [],
      } as unknown as Parameters<typeof insertProduct>[0])
      expect(lastParams()).toContain(null)
    })
  })

  describe('行读取映射', () => {
    const mockRow = {
      id: 'p_1',
      title: '产品',
      price: '99.9',
      originalPrice: null,
      stock: '5',
      requireName: 1,
      requirePhone: 0,
      images: '["https://a.png"]',
      options: null,
    }

    it('readProducts 将字符串数字转 Number、JSON 列反序列化、0/1 转 boolean', async () => {
      setupColumnExists()
      mockQueryOne.mockReset()
      mockQuery.mockResolvedValue([mockRow])

      const result = await readProducts()
      expect(result).toHaveLength(1)
      const p = result[0]
      expect(p.price).toBe(99.9)
      expect(p.stock).toBe(5)
      expect(p.originalPrice).toBe(0)
      expect(p.requireName).toBe(true)
      expect(p.requirePhone).toBe(false)
      expect(p.images).toEqual(['https://a.png'])
      expect(p.options).toEqual([])
    })

    it('readProduct 不存在时返回 null', async () => {
      setupColumnExists()
      mockQueryOne.mockResolvedValue(null)

      const result = await readProduct('p_missing')
      expect(result).toBeNull()
    })
  })

  describe('库存与删除', () => {
    it('incrementProductStock 使用 COALESCE 原子自增', async () => {
      await incrementProductStock('p_1', -2)

      expect(mockQuery).toHaveBeenCalledTimes(1)
      expect(lastSql()).toContain('stock = COALESCE(stock, 0) + ?')
      expect(lastParams()).toEqual([-2, 'p_1'])
    })

    it('deleteProduct 执行物理删除', async () => {
      await deleteProduct('p_1')

      expect(lastSql()).toBe('DELETE FROM products WHERE id = ?')
      expect(lastParams()).toEqual(['p_1'])
    })
  })
})
