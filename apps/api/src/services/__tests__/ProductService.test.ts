import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { productService } from '../ProductService.js'

// Mock cache module
vi.mock('../cache/index.js', () => ({
  CacheService: class {
    get = vi.fn().mockResolvedValue(null)
    set = vi.fn().mockResolvedValue(undefined)
    delete = vi.fn().mockResolvedValue(undefined)
    deletePattern = vi.fn().mockResolvedValue(undefined)
    connect = vi.fn().mockResolvedValue(undefined)
    disconnect = vi.fn().mockResolvedValue(undefined)
    getStats = vi.fn().mockReturnValue({ redisConnected: false, memoryCacheSize: 0, memoryCacheKeys: [] })
  },
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
vi.mock('../../data.js', () => ({
  readProducts: vi.fn(),
  readOrders: vi.fn(),
  queryOne: vi.fn(),
  insertProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  getProductsPaginated: vi.fn()
}))

import {
  readProducts,
  readOrders,
  queryOne,
  insertProduct,
  updateProduct,
  deleteProduct,
  getProductsPaginated
} from '../../data.js'

describe('ProductService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
