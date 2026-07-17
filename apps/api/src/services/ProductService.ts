/**
 * ProductService - 产品业务逻辑层
 * 负责处理产品相关的所有业务逻辑，包括创建、更新、删除、查询等
 * 集成了Redis缓存以提升性能
 */
import { injectable, inject } from 'tsyringe'
import {
  readProduct,
  readProducts,
  readOrders,
  insertProduct,
  updateProduct,
  deleteProduct,
  getProductsPaginated,
  queryOne,
} from '../data/index.js'
import { CacheService, CacheKeys, CacheTTL, getCacheService as getGlobalCacheService } from './cache/index.js'
import { DatabaseService } from './DatabaseService.js'
import { ErrorCode, throwNotFound, throwBadRequest, throwForbidden, throwConflict } from '@promo/shared'

export interface ProductService {
  getProducts(params: {
    page?: number
    pageSize?: number
    category?: string
    status?: string
    managerId?: string
    keyword?: string
    adminMode?: boolean
  }): Promise<{ list: any[]; total: number }>

  getProductById(id: string): Promise<{ product: any; sales: number }>

  createProduct(productData: {
    title: string
    description?: string
    price?: number
    category?: string
    categoryId?: string
    categoryNameSnapshot?: string
    status?: string
    managerId?: string
    coverImage?: string
    images?: string[]
    stock?: number
    options?: any[]
  }): Promise<any>

  updateProduct(id: string, managerId: string, updateData: any): Promise<any>

  deleteProduct(id: string, managerId: string): Promise<void>
}

@injectable()
export class ProductServiceImpl implements ProductService {
  constructor(
    @inject(DatabaseService) private db: DatabaseService,
    @inject(CacheService) private cache: CacheService
  ) {}

  private getProductListCacheKey(params: any): string {
    const { page, pageSize, category, status, managerId, keyword, adminMode } = params
    const pageStr = String(page || 1)
    const pageSizeStr = String(pageSize || 10)
    const categoryStr = category || 'all'
    const statusStr = status || 'all'
    const managerIdStr = managerId || 'all'
    const keywordStr = keyword || 'none'
    const adminModeStr = adminMode ? 'admin' : 'normal'
    
    return `:${pageStr}:${pageSizeStr}:${categoryStr}:${statusStr}:${managerIdStr}:${keywordStr}:${adminModeStr}`
  }

  private async getCategoryInfo(categoryValue?: string, categoryId?: string) {
    if (categoryId) {
      const category = await queryOne('SELECT * FROM product_categories WHERE id = ?', [categoryId])
      if (category) return category
    }
    
    if (categoryValue) {
      const category = await queryOne('SELECT * FROM product_categories WHERE value = ? AND status = ?', [categoryValue, 'active'])
      if (category) return category
    }
    
    if (categoryValue) {
      const category = await queryOne('SELECT * FROM product_categories WHERE value = ?', [categoryValue])
      if (category) return category
    }
    
    if (categoryValue) {
      const category = await queryOne('SELECT * FROM product_categories WHERE name LIKE ? AND status = ?', [`%${categoryValue}%`, 'active'])
      if (category) return category
    }
    
    return null
  }

  async getProducts(params) {
    const { page = 1, pageSize = 10, category, status, managerId, keyword, adminMode } = params

    const result = await getProductsPaginated({
      page,
      pageSize,
      category,
      status,
      managerId,
      keyword,
      adminMode,
    })

    return result
  }

  async getProductById(id) {
    const cacheKey = CacheKeys.PRODUCT_DETAIL(id)

    const cached = await this.cache.get<{ product: any; sales: number }>(cacheKey)
    if (cached) {
      return cached
    }

    const products = await this.db.readProducts()
    const product = products.find((p: any) => p.id === id)

    if (!product) {
      throwNotFound('产品不存在', ErrorCode.PRODUCT_NOT_FOUND)
    }

    const orders = await this.db.readOrders()
    const sales = orders.filter((o: any) => o.productId === product.id).length
    const result = { product, sales }

    await this.cache.set(cacheKey, result, CacheTTL.MEDIUM)
    return result
  }

  async createProduct(productData) {
    const title = (productData.title || '').trim()

    if (!title) {
      throwBadRequest('产品标题不能为空')
    }

    const managerId = (productData.managerId || '').trim()
    if (!managerId) {
      throwBadRequest('经理信息缺失，请重新登录')
    }
    
    const manager = await queryOne('SELECT id, status FROM managers WHERE id = ?', [managerId])
    if (!manager) {
      throwBadRequest('经理账户不存在，请重新登录')
    }
    
    if (manager.status !== 'active') {
      throwBadRequest('经理账户状态异常，无法创建产品')
    }

    const duplicate = await queryOne('SELECT id FROM products WHERE title = ?', [title])
    if (duplicate) {
      throwConflict('产品标题已存在，请修改后重新发布')
    }

    const categoryInfo = await this.getCategoryInfo(productData.category, productData.categoryId)
    
    const now = new Date().toISOString()
    const normalizedStatus = (productData.status || 'published').toLowerCase().trim()
    const validStatuses = ['draft', 'published', 'offline', 'admin_offline']
    const finalStatus = validStatuses.includes(normalizedStatus) ? normalizedStatus : 'published'
    
    const product = {
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...productData,
      managerId: managerId,
      categoryId: categoryInfo?.id || productData.categoryId || '',
      categoryNameSnapshot: categoryInfo?.name || productData.categoryNameSnapshot || '',
      status: finalStatus,
      publishedAt: finalStatus === 'published' ? now : undefined,
      createdAt: now,
      updatedAt: now,
    }

    await insertProduct(product)
    
    const savedProduct = await readProduct(product.id)

    try {
      await this.cache.flush()
    } catch {
    }

    return savedProduct
  }

  async updateProduct(id, managerId, updateData) {
    const existing = await queryOne('SELECT * FROM products WHERE id = ?', [id])
    if (!existing) {
      throwNotFound('产品不存在', ErrorCode.PRODUCT_NOT_FOUND)
    }

    if (updateData.managerId && existing.managerId !== updateData.managerId) {
      throwForbidden('无权操作此产品')
    }

    const title = (updateData.title || '').trim()
    if (title) {
      const duplicate = await queryOne('SELECT id FROM products WHERE title = ? AND id != ?', [title, id])
      if (duplicate) {
        throwConflict('产品标题已存在，请修改后重新发布')
      }
    }

    let updatedFields = { ...updateData }
    if (updateData.category || updateData.categoryId) {
      const categoryInfo = await this.getCategoryInfo(updateData.category, updateData.categoryId)
      if (categoryInfo) {
        updatedFields.categoryId = categoryInfo.id
        updatedFields.categoryNameSnapshot = categoryInfo.name
        if (!updateData.category) {
          updatedFields.category = categoryInfo.value
        }
      }
    }

    const now = new Date()
    const nowStr = now.toISOString().replace('T', ' ').substring(0, 19)
    updatedFields.publishedAt = updateData.status === 'published' && !existing.publishedAt ? nowStr : existing.publishedAt

    await updateProduct(id, updatedFields)
    const updated = await readProduct(id)

    await this.cache.delete(CacheKeys.PRODUCT_DETAIL(id))
    await this.cache.deletePattern('product:list:*')

    return updated
  }

  async deleteProduct(id, managerId) {
    const products = await this.db.readProducts()
    const product = products.find((p: any) => p.id === id)

    if (!product) {
      throwNotFound('产品不存在', ErrorCode.PRODUCT_NOT_FOUND)
    }

    if (managerId && product.managerId !== managerId) {
      throwForbidden('无权操作此产品')
    }

    await deleteProduct(id)

    await this.cache.delete(CacheKeys.PRODUCT_DETAIL(id))
    await this.cache.deletePattern('product:list:*')
  }
}

const cache = getGlobalCacheService()
const db = {
  readProducts,
  readOrders,
  readUsers: async () => [],
  writeUsers: async () => {},
  writeProducts: async () => {},
  readEmployees: async () => [],
  writeEmployees: async () => {},
  writeOrders: async () => {},
  readCommissions: async () => [],
  writeCommissions: async () => {},
  readManagers: async () => [],
  writeManagers: async () => {},
} as any

export const productService: ProductService = new ProductServiceImpl(db, cache)

export async function initializeCache(): Promise<void> {
  await cache.connect()
}

export async function closeCache(): Promise<void> {
  await cache.disconnect()
}
