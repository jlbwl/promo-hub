import { describe, it, expect, vi, beforeEach } from 'vitest'
import { productService } from '../ProductService.js'

// Mock console to keep test output clean
vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

/**
 * 带真实键空间语义的假缓存：按 'promo:' 前缀存取，
 * 让"发布产品是否会误删 refresh token / 黑名单等令牌类键"可以被真实验证。
 */
const cacheMock = vi.hoisted(() => {
  const PREFIX = 'promo:'
  const store = new Map<string, unknown>()
  const full = (key: string) => `${PREFIX}${key}`

  return {
    store,
    seed: (key: string, value: unknown) => {
      store.set(full(key), value)
    },
    has: (key: string) => store.has(full(key)),
    get: vi.fn(async (key: string) => store.get(full(key)) ?? null),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(full(key), value)
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(full(key))
    }),
    deletePattern: vi.fn(async (pattern: string) => {
      const prefix = full(pattern.replace(/\*$/, ''))
      for (const key of Array.from(store.keys())) {
        if (key.startsWith(prefix)) store.delete(key)
      }
    }),
    flush: vi.fn(async () => {
      store.clear()
    }),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn(() => ({ redisConnected: false, memoryCacheSize: store.size, memoryCacheKeys: [] })),
    isRedisAvailable: vi.fn(() => false),
  }
})

// Mock cache module
vi.mock('../cache/index.js', () => ({
  CacheService: class {},
  getCacheService: vi.fn(() => cacheMock),
  initCacheService: vi.fn().mockResolvedValue(undefined),
  closeCacheService: vi.fn().mockResolvedValue(undefined),
  CacheKeys: {
    PRODUCT: 'product',
    PRODUCT_LIST: 'product:list',
    PRODUCT_DETAIL: (id: string) => `product:${id}`
  },
  CacheTTL: {
    SHORT: 60,
    MEDIUM: 300,
    LONG: 1800
  }
}))

// Mock data module
vi.mock('../../data/index.js', () => ({
  readProduct: vi.fn(),
  readProducts: vi.fn(),
  readOrders: vi.fn(),
  queryOne: vi.fn(),
  insertProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  getProductsPaginated: vi.fn()
}))

import {
  readProduct,
  readProducts,
  readOrders,
  queryOne,
  insertProduct,
  updateProduct,
  deleteProduct,
  getProductsPaginated
} from '../../data/index.js'

describe('ProductService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cacheMock.store.clear()
  })

  describe('getProducts', () => {
    it('should get products with pagination', async () => {
      const mockData = {
        list: [{ id: 'p1', title: '测试产品' }],
        total: 10
      }
      vi.mocked(getProductsPaginated).mockResolvedValue(mockData)

      const result = await productService.getProducts({ page: 1, pageSize: 10 })

      expect(result).toEqual(mockData)
      expect(getProductsPaginated).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10
      })
    })
  })

  describe('getProductById', () => {
    it('should get product by id with sales count', async () => {
      const mockProduct = { id: 'p1', title: '测试产品' }
      const mockOrders = [
        { id: 'o1', productId: 'p1' },
        { id: 'o2', productId: 'p1' },
        { id: 'o3', productId: 'p2' }
      ]

      vi.mocked(readProducts).mockResolvedValue([mockProduct])
      vi.mocked(readOrders).mockResolvedValue(mockOrders)

      const result = await productService.getProductById('p1')

      expect(result.product).toEqual(mockProduct)
      expect(result.sales).toBe(2)
    })

    it('should throw error when product not found', async () => {
      vi.mocked(readProducts).mockResolvedValue([])

      await expect(productService.getProductById('p999')).rejects.toThrow('产品不存在')
    })
  })

  describe('createProduct', () => {
    it('should throw error when title is empty', async () => {
      await expect(productService.createProduct({ title: '', managerId: 'm1' })).rejects.toThrow('产品标题不能为空')
    })

    it('should throw error when title already exists', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({ id: 'm1', status: 'active' }) // 经理验证
      vi.mocked(queryOne).mockResolvedValueOnce({ id: 'existing' }) // 产品标题验证

      await expect(productService.createProduct({ title: '已存在', managerId: 'm1' })).rejects.toThrow('产品标题已存在')
    })

    it('发布产品时只失效产品缓存，不得清空 refresh token / token 黑名单 / 管理员单设备令牌', async () => {
      // 预置与鉴权相关的缓存键（真实键名形如 promo:refresh_token:xxx）
      cacheMock.seed('refresh_token:user-refresh', { id: 'u1', role: 'user' })
      cacheMock.seed('access_token_blacklist:revoked-jwt', '1')
      cacheMock.seed('admin_active_token:admin1', 'admin-refresh')
      // 预置另一个产品的详情缓存，验证是"精准失效"而非整域清空
      cacheMock.seed('product:p_other', { product: { id: 'p_other' }, sales: 1 })

      vi.mocked(queryOne).mockResolvedValueOnce({ id: 'm1', status: 'active' })
      vi.mocked(queryOne).mockResolvedValueOnce(null)
      vi.mocked(insertProduct).mockResolvedValue(undefined)
      const inserted = { id: 'p_new', title: '新产品', managerId: 'm1' }
      vi.mocked(readProduct).mockResolvedValue(inserted)

      await productService.createProduct({ title: '新产品', managerId: 'm1' })

      // 核心回归：不允许走 flush()（其实现为 Redis FLUSHDB）
      expect(cacheMock.flush).not.toHaveBeenCalled()
      expect(cacheMock.has('refresh_token:user-refresh')).toBe(true)
      expect(cacheMock.has('access_token_blacklist:revoked-jwt')).toBe(true)
      expect(cacheMock.has('admin_active_token:admin1')).toBe(true)
      // 产品域缓存仍需正确失效（id 由服务端生成，从 insertProduct 入参取回）
      const created = vi.mocked(insertProduct).mock.calls[0][0] as { id: string }
      expect(cacheMock.delete).toHaveBeenCalledWith(`product:${created.id}`)
      expect(cacheMock.deletePattern).toHaveBeenCalledWith('product:list:*')
      expect(cacheMock.has('product:p_other')).toBe(true)
    })
  })

  describe('updateProduct', () => {
    it('should throw error when product not found', async () => {
      vi.mocked(queryOne).mockResolvedValue(null)

      await expect(productService.updateProduct('p999', 'm1', {})).rejects.toThrow('产品不存在')
    })
  })

  describe('deleteProduct', () => {
    it('should throw error when product not found', async () => {
      vi.mocked(readProducts).mockResolvedValue([])

      await expect(productService.deleteProduct('p999', 'm1')).rejects.toThrow('产品不存在')
    })

    it('should throw error when no permission', async () => {
      vi.mocked(readProducts).mockResolvedValue([{ id: 'p1', managerId: 'm2' }])

      await expect(productService.deleteProduct('p1', 'm1')).rejects.toThrow('无权操作此产品')
    })
  })
})
