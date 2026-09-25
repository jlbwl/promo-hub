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
import { ErrorCode, throwNotFound, throwBadRequest, throwForbidden, throwConflict, type Product } from '@promo/shared'

/** 携带做单量的产品（列表场景） */
export type ProductWithSales = Product & { sales: number }

/** 产品详情（允许写入 sales 供响应组装） */
export type ProductDetail = Product & { sales?: number }

export interface ProductListParams {
  page?: number
  pageSize?: number
  category?: string
  status?: string
  managerId?: string
  keyword?: string
  adminMode?: boolean
}

export interface ProductCreateData {
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
  options?: unknown[]
}

export interface ProductUpdateData {
  title?: string
  description?: string
  price?: number
  originalPrice?: number
  category?: string
  categoryId?: string
  categoryNameSnapshot?: string
  status?: string
  managerId?: string
  coverImage?: string
  images?: string[]
  stock?: number
  options?: unknown[]
  publishedAt?: string | Date | null
  [key: string]: unknown
}

/** product_categories 表行结构 */
interface CategoryRow {
  id: string
  name: string
  value: string
}

/** managers 表行中本服务消费的字段 */
interface ManagerStatusRow {
  id: string
  status: string
}

/** products 表行中仅取 id 的场景（标题重复检查） */
interface ProductIdRow {
  id: string
}

/** products 表原始行中 updateProduct 消费的字段 */
interface ProductExistingRow {
  managerId?: string
  publishedAt?: string | Date | null
}

export interface ProductService {
  getProducts(params: ProductListParams): Promise<{ list: ProductWithSales[]; total: number }>

  getProductById(id: string): Promise<{ product: ProductDetail; sales: number }>

  createProduct(productData: ProductCreateData): Promise<Product>

  updateProduct(id: string, managerId: string, updateData: ProductUpdateData): Promise<Product | null>

  deleteProduct(id: string, managerId: string): Promise<void>
}

@injectable()
export class ProductServiceImpl implements ProductService {
  constructor(
    @inject(DatabaseService) private db: DatabaseService,
    @inject(CacheService) private cache: CacheService
  ) {}

  private getProductListCacheKey(params: ProductListParams): string {
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

  private async getCategoryInfo(categoryValue?: string, categoryId?: string): Promise<CategoryRow | null> {
    if (categoryId) {
      const category = await queryOne<CategoryRow>('SELECT * FROM product_categories WHERE id = ?', [categoryId])
      if (category) return category
    }

    if (categoryValue) {
      const category = await queryOne<CategoryRow>('SELECT * FROM product_categories WHERE value = ? AND status = ?', [categoryValue, 'active'])
      if (category) return category
    }

    if (categoryValue) {
      const category = await queryOne<CategoryRow>('SELECT * FROM product_categories WHERE value = ?', [categoryValue])
      if (category) return category
    }

    if (categoryValue) {
      const category = await queryOne<CategoryRow>('SELECT * FROM product_categories WHERE name LIKE ? AND status = ?', [`%${categoryValue}%`, 'active'])
      if (category) return category
    }
    
    return null
  }

  async getProducts(params: ProductListParams) {
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

  async getProductById(id: string) {
    const cacheKey = CacheKeys.PRODUCT_DETAIL(id)

    const cached = await this.cache.get<{ product: ProductDetail; sales: number }>(cacheKey)
    if (cached) {
      return cached
    }

    const products = await this.db.readProducts()
    const product = products.find((p) => p.id === id)

    if (!product) {
      throwNotFound('产品不存在', ErrorCode.PRODUCT_NOT_FOUND)
    }

    const orders = await this.db.readOrders()
    const sales = orders.filter((o) => o.productId === product.id).length
    const result = { product, sales }

    await this.cache.set(cacheKey, result, CacheTTL.MEDIUM)
    return result
  }

  async createProduct(productData: ProductCreateData) {
    const title = (productData.title || '').trim()

    if (!title) {
      throwBadRequest('产品标题不能为空')
    }

    const managerId = (productData.managerId || '').trim()
    if (!managerId) {
      throwBadRequest('经理信息缺失，请重新登录')
    }
    
    const manager = await queryOne<ManagerStatusRow>('SELECT id, status FROM managers WHERE id = ?', [managerId])
    if (!manager) {
      throwBadRequest('经理账户不存在，请重新登录')
    }
    
    if (manager.status !== 'active') {
      throwBadRequest('经理账户状态异常，无法创建产品')
    }

    const duplicate = await queryOne<ProductIdRow>('SELECT id FROM products WHERE title = ?', [title])
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

    await insertProduct(product as Product)

    const savedProduct = await readProduct(product.id)

    try {
      await this.cache.flush()
    } catch {
    }

    return savedProduct as Product
  }

  async updateProduct(id: string, managerId: string, updateData: ProductUpdateData) {
    const existing = await queryOne<ProductExistingRow>('SELECT * FROM products WHERE id = ?', [id])
    if (!existing) {
      throwNotFound('产品不存在', ErrorCode.PRODUCT_NOT_FOUND)
    }

    if (updateData.managerId && existing.managerId !== updateData.managerId) {
      throwForbidden('无权操作此产品')
    }

    const title = (updateData.title || '').trim()
    if (title) {
      const duplicate = await queryOne<ProductIdRow>('SELECT id FROM products WHERE title = ? AND id != ?', [title, id])
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

  async deleteProduct(id: string, managerId: string) {
    const products = await this.db.readProducts()
    const product = products.find((p) => p.id === id)

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
const db: DatabaseService = {
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
}

export const productService: ProductService = new ProductServiceImpl(db, cache)

export async function initializeCache(): Promise<void> {
  await cache.connect()
}

export async function closeCache(): Promise<void> {
  await cache.disconnect()
}
