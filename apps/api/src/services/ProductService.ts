/**
 * ProductService - 产品业务逻辑层
 * 负责处理产品相关的所有业务逻辑，包括创建、更新、删除、查询等
 * 集成了Redis缓存以提升性能
 */
import {
  readProduct,
  readProducts,
  readOrders,
  insertProduct,
  updateProduct,
  deleteProduct,
  getProductsPaginated,
  queryOne,
  query
} from '../data.js'
import { CacheService, CacheKeys, CacheTTL } from './cache/index.js'

/**
 * 产品服务接口
 */
export interface ProductService {
  /**
   * 获取产品列表（支持分页和筛选）
   */
  getProducts(params: {
    page?: number
    pageSize?: number
    category?: string
    status?: string
    managerId?: string
    keyword?: string
  }): Promise<{ list: any[]; total: number }>

  /**
   * 获取单个产品详情
   */
  getProductById(id: string): Promise<{ product: any; sales: number }>

  /**
   * 创建产品
   */
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

  /**
   * 更新产品
   */
  updateProduct(id: string, managerId: string, updateData: any): Promise<any>

  /**
   * 删除产品
   */
  deleteProduct(id: string, managerId: string): Promise<void>
}

// 缓存服务实例（延迟初始化）
let cacheService: CacheService | null = null

/**
 * 获取缓存服务实例
 */
function getCacheService(): CacheService {
  if (!cacheService) {
    cacheService = new CacheService()
  }
  return cacheService
}

/**
 * 生成产品列表缓存键
 */
function getProductListCacheKey(params: any): string {
  const { page, pageSize, category, status, managerId, keyword } = params
  return `list:${page}:${pageSize}:${category || 'all'}:${status || 'all'}:${managerId || 'all'}:${keyword || 'none'}`
}

/**
 * 根据分类值或分类ID获取分类信息
 */
async function getCategoryInfo(categoryValue?: string, categoryId?: string) {
  if (categoryId) {
    const category = await queryOne('SELECT * FROM product_categories WHERE id = ?', [categoryId])
    if (category) {
      return category
    }
  }
  if (categoryValue) {
    const category = await queryOne('SELECT * FROM product_categories WHERE value = ? AND status = ?', [categoryValue, 'active'])
    if (category) {
      return category
    }
  }
  return null
}

/**
 * 产品服务实现
 */
export const productService: ProductService = {
  /**
   * 获取产品列表
   * 支持分页、分类筛选、状态筛选、经理筛选和关键词搜索
   * 使用Redis缓存提升性能
   * @param params - 查询参数，包含分页和筛选条件
   * @returns 分页的产品列表和总数
   */
  async getProducts(params) {
    const { page = 1, pageSize = 10, category, status, managerId, keyword } = params
    const cacheKey = getProductListCacheKey(params)
    const cache = getCacheService()

    // 尝试从缓存获取
    const cached = await cache.get<{ list: any[]; total: number }>(CacheKeys.PRODUCT_LIST + cacheKey)
    if (cached) {
      return cached
    }

    // 缓存未命中，从数据库获取
    const result = await getProductsPaginated({
      page,
      pageSize,
      category,
      status,
      managerId,
      keyword,
    })

    // 设置缓存
    await cache.set(CacheKeys.PRODUCT_LIST + cacheKey, result, CacheTTL.MEDIUM)

    return result
  },

  /**
   * 获取单个产品详情
   * 根据产品ID查询产品信息，并统计该产品的做单量
   * 使用Redis缓存提升性能
   * @param id - 产品ID
   * @returns 产品详细信息和销售数量
   * @throws 产品不存在时抛出错误
   */
  async getProductById(id) {
    const cache = getCacheService()
    const cacheKey = CacheKeys.PRODUCT_DETAIL(id)

    // 尝试从缓存获取
    const cached = await cache.get<{ product: any; sales: number }>(cacheKey)
    if (cached) {
      return cached
    }

    // 缓存未命中
    const products = await readProducts()
    const product = products.find((p: any) => p.id === id)

    if (!product) {
      const error = new Error('产品不存在')
      ;(error as any).code = 404
      throw error
    }

    // 统计做单量
    const orders = await readOrders()
    const sales = orders.filter((o: any) => o.productId === product.id).length

    const result = { product, sales }

    // 设置缓存
    await cache.set(cacheKey, result, CacheTTL.MEDIUM)

    return result
  },

  /**
   * 创建产品
   * 验证产品标题唯一性，生成产品ID，并保存到数据库
   * @param productData - 产品数据
   * @returns 新创建的产品信息
   * @throws 标题为空或已存在时抛出错误
   */
  async createProduct(productData) {
    const title = (productData.title || '').trim()

    // 验证标题不能为空
    if (!title) {
      const error = new Error('产品标题不能为空')
      ;(error as any).code = 400
      throw error
    }

    // 检查标题唯一性
    const duplicate = await queryOne('SELECT id FROM products WHERE title = ?', [title])
    if (duplicate) {
      const error = new Error('产品标题已存在，请修改后重新发布')
      ;(error as any).code = 409
      throw error
    }

    // 获取分类信息
    const categoryInfo = await getCategoryInfo(productData.category, productData.categoryId)
    
    // 创建产品对象
    const now = new Date().toISOString()
    const product = {
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...productData,
      categoryId: categoryInfo?.id || productData.categoryId || '',
      categoryNameSnapshot: categoryInfo?.name || productData.categoryNameSnapshot || '',
      status: productData.status || 'published',
      publishedAt: productData.status === 'published' ? now : undefined,
      createdAt: now,
      updatedAt: now,
    }

    await insertProduct(product)
    const savedProduct = await readProduct(product.id)

    // 清除产品列表缓存
    const cache = getCacheService()
    await cache.deletePattern('product:list:*')

    return savedProduct
  },

  /**
   * 更新产品
   * 验证产品存在性和归属权限，检查标题唯一性，更新产品数据
   * @param id - 产品ID
   * @param managerId - 经理ID（用于权限验证）
   * @param updateData - 更新数据
   * @returns 更新后的产品信息
   * @throws 产品不存在、无权操作或标题已存在时抛出错误
   */
  async updateProduct(id, managerId, updateData) {
    // 检查产品是否存在
    const existing = await queryOne('SELECT * FROM products WHERE id = ?', [id])
    if (!existing) {
      const error = new Error('产品不存在')
      ;(error as any).code = 404
      throw error
    }

    // 验证归属权限
    if (updateData.managerId && existing.managerId !== updateData.managerId) {
      const error = new Error('无权操作此产品')
      ;(error as any).code = 403
      throw error
    }

    // 检查标题唯一性
    const title = (updateData.title || '').trim()
    if (title) {
      const duplicate = await queryOne('SELECT id FROM products WHERE title = ? AND id != ?', [title, id])
      if (duplicate) {
        const error = new Error('产品标题已存在，请修改后重新发布')
        ;(error as any).code = 409
        throw error
      }
    }

    // 如果更新了分类，更新分类快照
    let updatedFields = { ...updateData }
    if (updateData.category || updateData.categoryId) {
      const categoryInfo = await getCategoryInfo(updateData.category, updateData.categoryId)
      if (categoryInfo) {
        updatedFields.categoryId = categoryInfo.id
        updatedFields.categoryNameSnapshot = categoryInfo.name
        if (!updateData.category) {
          updatedFields.category = categoryInfo.value
        }
      }
    }

    // 构建更新字段
    const now = new Date()
    const nowStr = now.toISOString().replace('T', ' ').substring(0, 19)
    updatedFields.publishedAt = updateData.status === 'published' && !existing.publishedAt ? nowStr : existing.publishedAt

    await updateProduct(id, updatedFields)
    const updated = await readProduct(id)

    // 清除相关缓存
    const cache = getCacheService()
    await cache.delete(CacheKeys.PRODUCT_DETAIL(id))
    await cache.deletePattern('product:list:*')

    return updated
  },

  /**
   * 删除产品
   * 验证产品存在性和归属权限，只有产品所有者才能删除
   * @param id - 产品ID
   * @param managerId - 经理ID（用于权限验证）
   * @throws 产品不存在或无权操作时抛出错误
   */
  async deleteProduct(id, managerId) {
    console.log('[ProductService] 删除产品, ID:', id, 'ManagerId:', managerId)

    const products = await readProducts()
    const product = products.find((p: any) => p.id === id)

    if (!product) {
      console.log('[ProductService] 产品不存在:', id)
      const error = new Error('产品不存在')
      ;(error as any).code = 404
      throw error
    }

    // 验证归属权限
    if (managerId && product.managerId !== managerId) {
      console.log('[ProductService] 无权删除, 请求者:', managerId, '所有者:', product.managerId)
      const error = new Error('无权操作此产品')
      ;(error as any).code = 403
      throw error
    }

    console.log('[ProductService] 开始删除, ID:', id)
    await deleteProduct(id)

    // 清除相关缓存
    const cache = getCacheService()
    await cache.delete(CacheKeys.PRODUCT_DETAIL(id))
    await cache.deletePattern('product:list:*')

    console.log('[ProductService] 删除成功, ID:', id)
  },
}

/**
 * 初始化缓存服务
 */
export async function initializeCache(): Promise<void> {
  const cache = getCacheService()
  await cache.connect()
  console.log('[ProductService] 缓存服务初始化完成')
}

/**
 * 关闭缓存服务
 */
export async function closeCache(): Promise<void> {
  if (cacheService) {
    await cacheService.disconnect()
    cacheService = null
  }
}
