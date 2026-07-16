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
  query
} from '../data/index.js'
import { CacheService, CacheKeys, CacheTTL } from './cache/index.js'
import { DatabaseService } from './DatabaseService.js'
import { ErrorCode, throwNotFound, throwBadRequest, throwForbidden, throwConflict } from '@promo/shared'

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
    adminMode?: boolean
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

/**
 * 产品服务实现类（可注入版本）
 */
@injectable()
export class ProductServiceImpl implements ProductService {
  constructor(
    @inject(DatabaseService) private db: DatabaseService,
    @inject(CacheService) private cache: CacheService
  ) {}

  /**
   * 生成产品列表缓存键
   */
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

  /**
   * 根据分类值或分类ID获取分类信息
   */
  private async getCategoryInfo(categoryValue?: string, categoryId?: string) {
    console.log('[getCategoryInfo] 输入 - categoryValue:', categoryValue, 'categoryId:', categoryId)
    
    if (categoryId) {
      const category = await queryOne('SELECT * FROM product_categories WHERE id = ?', [categoryId])
      if (category) {
        console.log('[getCategoryInfo] 方式1成功 - 找到分类:', category.name)
        return category
      }
    }
    
    if (categoryValue) {
      const category = await queryOne('SELECT * FROM product_categories WHERE value = ? AND status = ?', [categoryValue, 'active'])
      if (category) {
        console.log('[getCategoryInfo] 方式2成功 - 找到分类:', category.name)
        return category
      }
    }
    
    if (categoryValue) {
      const category = await queryOne('SELECT * FROM product_categories WHERE value = ?', [categoryValue])
      if (category) {
        console.log('[getCategoryInfo] 方式3成功 - 找到分类（可能已归档）:', category.name)
        return category
      }
    }
    
    if (categoryValue) {
      const category = await queryOne('SELECT * FROM product_categories WHERE name LIKE ? AND status = ?', [`%${categoryValue}%`, 'active'])
      if (category) {
        console.log('[getCategoryInfo] 方式4成功 - 通过名称模糊匹配找到:', category.name)
        return category
      }
    }
    
    console.log('[getCategoryInfo] 未找到匹配的分类')
    return null
  }

  /**
   * 获取产品列表
   */
  async getProducts(params) {
    const { page = 1, pageSize = 10, category, status, managerId, keyword, adminMode } = params

    console.log('[getProducts] 输入参数:', { page, pageSize, category, status, managerId, keyword, adminMode })
    console.log('[getProducts] 直接查询数据库，确保数据最新')
    const result = await getProductsPaginated({
      page,
      pageSize,
      category,
      status,
      managerId,
      keyword,
      adminMode,
    })

    console.log('[getProducts] 查询完成，共', result.total, '条记录')
    console.log('[getProducts] 返回的产品列表:', JSON.stringify(result.list.map(p => ({ id: p.id, title: p.title, status: p.status, managerId: p.managerId })), null, 2))

    return result
  }

  /**
   * 获取单个产品详情
   */
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

  /**
   * 创建产品
   */
  async createProduct(productData) {
    const title = (productData.title || '').trim()
    console.log('[createProduct] 输入数据:', JSON.stringify(productData, null, 2))

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
    
    console.log('[createProduct] 经理验证通过，经理ID:', managerId, '状态:', manager.status)

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
    console.log('[createProduct] 状态标准化:', { input: productData.status, normalized: normalizedStatus, final: finalStatus })
    console.log('[createProduct] 创建的产品对象:', JSON.stringify(product, null, 2))

    await insertProduct(product)
    console.log('[createProduct] insertProduct 完成')
    
    const savedProduct = await readProduct(product.id)
    console.log('[createProduct] readProduct 返回:', JSON.stringify(savedProduct, null, 2))

    console.log('[createProduct] 开始清除缓存')
    try {
      await this.cache.flush()
      console.log('[createProduct] 完全清空所有缓存完成')
    } catch (cacheError) {
      console.error('[createProduct] 缓存清除失败，但产品已创建:', cacheError)
    }

    return savedProduct
  }

  /**
   * 更新产品
   */
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
    console.log('[updateProduct] 相关缓存已清除')

    return updated
  }

  /**
   * 删除产品
   */
  async deleteProduct(id, managerId) {
    console.log('[ProductService] 删除产品, ID:', id, 'ManagerId:', managerId)

    const products = await this.db.readProducts()
    const product = products.find((p: any) => p.id === id)

    if (!product) {
      console.log('[ProductService] 产品不存在:', id)
      throwNotFound('产品不存在', ErrorCode.PRODUCT_NOT_FOUND)
    }

    if (managerId && product.managerId !== managerId) {
      console.log('[ProductService] 无权删除, 请求者:', managerId, '所有者:', product.managerId)
      throwForbidden('无权操作此产品')
    }

    console.log('[ProductService] 开始删除, ID:', id)
    await deleteProduct(id)

    await this.cache.delete(CacheKeys.PRODUCT_DETAIL(id))
    await this.cache.deletePattern('product:list:*')
    console.log('[ProductService] 缓存已清除，删除成功, ID:', id)
  }
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
  const { page, pageSize, category, status, managerId, keyword, adminMode } = params
  // 确保缓存键格式一致，避免空字符串导致的连续冒号问题
  const pageStr = String(page || 1)
  const pageSizeStr = String(pageSize || 10)
  const categoryStr = category || 'all'
  const statusStr = status || 'all'
  const managerIdStr = managerId || 'all'
  const keywordStr = keyword || 'none'
  const adminModeStr = adminMode ? 'admin' : 'normal'
  
  return `:${pageStr}:${pageSizeStr}:${categoryStr}:${statusStr}:${managerIdStr}:${keywordStr}:${adminModeStr}`
}

/**
 * 根据分类值或分类ID获取分类信息
 * 增强：支持多种匹配方式，确保能找到正确的分类
 */
async function getCategoryInfo(categoryValue?: string, categoryId?: string) {
  console.log('[getCategoryInfo] 输入 - categoryValue:', categoryValue, 'categoryId:', categoryId)
  
  // 方式1：用 categoryId 查询
  if (categoryId) {
    const category = await queryOne('SELECT * FROM product_categories WHERE id = ?', [categoryId])
    if (category) {
      console.log('[getCategoryInfo] 方式1成功 - 找到分类:', category.name)
      return category
    }
  }
  
  // 方式2：用 categoryValue 查询（精确匹配）
  if (categoryValue) {
    const category = await queryOne('SELECT * FROM product_categories WHERE value = ? AND status = ?', [categoryValue, 'active'])
    if (category) {
      console.log('[getCategoryInfo] 方式2成功 - 找到分类:', category.name)
      return category
    }
  }
  
  // 方式3：用 categoryValue 查询（不区分状态）
  if (categoryValue) {
    const category = await queryOne('SELECT * FROM product_categories WHERE value = ?', [categoryValue])
    if (category) {
      console.log('[getCategoryInfo] 方式3成功 - 找到分类（可能已归档）:', category.name)
      return category
    }
  }
  
  // 方式4：用 categoryValue 模糊匹配 name
  if (categoryValue) {
    const category = await queryOne('SELECT * FROM product_categories WHERE name LIKE ? AND status = ?', [`%${categoryValue}%`, 'active'])
    if (category) {
      console.log('[getCategoryInfo] 方式4成功 - 通过名称模糊匹配找到:', category.name)
      return category
    }
  }
  
  console.log('[getCategoryInfo] 未找到匹配的分类')
  return null
}

/**
 * 产品服务实现
 */
export const productService: ProductService = {
  /**
   * 获取产品列表
   * 支持分页、分类筛选、状态筛选、经理筛选和关键词搜索
   * 每次都从数据库获取最新数据，确保数据一致性
   * @param params - 查询参数，包含分页和筛选条件
   * @returns 分页的产品列表和总数
   */
  async getProducts(params) {
    const { page = 1, pageSize = 10, category, status, managerId, keyword, adminMode } = params

    console.log('[getProducts] 输入参数:', { page, pageSize, category, status, managerId, keyword, adminMode })

    // 直接从数据库获取，确保获取最新数据
    console.log('[getProducts] 直接查询数据库，确保数据最新')
    const result = await getProductsPaginated({
      page,
      pageSize,
      category,
      status,
      managerId,
      keyword,
      adminMode,
    })

    console.log('[getProducts] 查询完成，共', result.total, '条记录')
    console.log('[getProducts] 返回的产品列表:', JSON.stringify(result.list.map(p => ({ id: p.id, title: p.title, status: p.status, managerId: p.managerId })), null, 2))

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
      throwNotFound('产品不存在', ErrorCode.PRODUCT_NOT_FOUND)
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
    console.log('[createProduct] 输入数据:', JSON.stringify(productData, null, 2))

    // 验证标题不能为空
    if (!title) {
      throwBadRequest('产品标题不能为空')
    }

    // 验证 managerId 不能为空且对应经理存在（经理端创建）
    const managerId = (productData.managerId || '').trim()
    if (!managerId) {
      throwBadRequest('经理信息缺失，请重新登录')
    }
    
    // 验证经理是否存在且状态正常
    const manager = await queryOne('SELECT id, status FROM managers WHERE id = ?', [managerId])
    if (!manager) {
      throwBadRequest('经理账户不存在，请重新登录')
    }
    
    if (manager.status !== 'active') {
      throwBadRequest('经理账户状态异常，无法创建产品')
    }
    
    console.log('[createProduct] 经理验证通过，经理ID:', managerId, '状态:', manager.status)

    // 检查标题唯一性
    const duplicate = await queryOne('SELECT id FROM products WHERE title = ?', [title])
    if (duplicate) {
      throwConflict('产品标题已存在，请修改后重新发布')
    }

    // 获取分类信息
    const categoryInfo = await getCategoryInfo(productData.category, productData.categoryId)
    
    // 创建产品对象
    const now = new Date().toISOString()
    // 标准化产品状态值
    const normalizedStatus = (productData.status || 'published').toLowerCase().trim()
    // 确保状态是有效值
    const validStatuses = ['draft', 'published', 'offline', 'admin_offline']
    const finalStatus = validStatuses.includes(normalizedStatus) ? normalizedStatus : 'published'
    
    const product = {
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...productData,
      managerId: managerId, // 确保 managerId 被正确设置
      categoryId: categoryInfo?.id || productData.categoryId || '',
      categoryNameSnapshot: categoryInfo?.name || productData.categoryNameSnapshot || '',
      status: finalStatus,
      publishedAt: finalStatus === 'published' ? now : undefined,
      createdAt: now,
      updatedAt: now,
    }
    console.log('[createProduct] 状态标准化:', { input: productData.status, normalized: normalizedStatus, final: finalStatus })
    console.log('[createProduct] 创建的产品对象:', JSON.stringify(product, null, 2))

    await insertProduct(product)
    console.log('[createProduct] insertProduct 完成')
    
    const savedProduct = await readProduct(product.id)
    console.log('[createProduct] readProduct 返回:', JSON.stringify(savedProduct, null, 2))

    // 清除所有产品相关缓存
    const cache = getCacheService()
    console.log('[createProduct] 开始清除缓存')
    
    try {
      // 完全清空所有缓存（最彻底的方式）
      await cache.flush()
      console.log('[createProduct] 完全清空所有缓存完成')
    } catch (cacheError) {
      console.error('[createProduct] 缓存清除失败，但产品已创建:', cacheError)
    }

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
      throwNotFound('产品不存在', ErrorCode.PRODUCT_NOT_FOUND)
    }

    // 验证归属权限
    if (updateData.managerId && existing.managerId !== updateData.managerId) {
      throwForbidden('无权操作此产品')
    }

    // 检查标题唯一性
    const title = (updateData.title || '').trim()
    if (title) {
      const duplicate = await queryOne('SELECT id FROM products WHERE title = ? AND id != ?', [title, id])
      if (duplicate) {
        throwConflict('产品标题已存在，请修改后重新发布')
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
    console.log('[updateProduct] 相关缓存已清除')

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
      throwNotFound('产品不存在', ErrorCode.PRODUCT_NOT_FOUND)
    }

    // 验证归属权限
    if (managerId && product.managerId !== managerId) {
      console.log('[ProductService] 无权删除, 请求者:', managerId, '所有者:', product.managerId)
      throwForbidden('无权操作此产品')
    }

    console.log('[ProductService] 开始删除, ID:', id)
    await deleteProduct(id)

    // 清除相关缓存
    const cache = getCacheService()
    await cache.delete(CacheKeys.PRODUCT_DETAIL(id))
    await cache.deletePattern('product:list:*')
    console.log('[ProductService] 缓存已清除，删除成功, ID:', id)
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
