import { Request, Response } from 'express'
import { sendSuccess, sendError, sendPagination } from '../utils/response.js'
import {
  readProduct,
  insertProduct,
  updateProduct,
  deleteProduct,
  getProductsPaginated,
  queryOne
} from '../data.js'

/**
 * 获取产品列表（用户端只看已发布的且经理在白名单中的，经理端看自己的）
 * 优化版本：使用数据库级别的筛选和分页
 */
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', pageSize = '10', category, status, managerId, keyword } = req.query
    
    const { list, total } = await getProductsPaginated({
      page: parseInt(page as string, 10),
      pageSize: parseInt(pageSize as string, 10),
      category: category as string,
      status: status as string,
      managerId: managerId as string,
      keyword: keyword as string,
    })

    sendPagination(res, list, total, parseInt(page as string, 10), parseInt(pageSize as string, 10))
  } catch (error: any) {
    sendError(res, error.message || '获取失败', 500)
  }
}

/**
 * 获取单个产品详情
 */
export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string
    const products = await readProducts()
    const product = products.find((p: any) => p.id === id)
    if (!product) {
      return sendError(res, '产品不存在', 404)
    }
    // 统计做单量
    const orders = await readOrders()
    product.sales = orders.filter((o: any) => o.productId === product.id).length
    sendSuccess(res, product)
  } catch (error: any) {
    sendError(res, error.message || '获取失败', 500)
  }
}

/**
 * 创建产品
 */
export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const title = (req.body.title || '').trim()

    if (!title) {
      return sendError(res, '产品标题不能为空', 400)
    }

    const duplicate = await queryOne('SELECT id FROM products WHERE title = ?', [title])
    if (duplicate) {
      return sendError(res, '产品标题已存在，请修改后重新发布', 409)
    }

    const now = new Date().toISOString()
    const product = {
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...req.body,
      status: req.body.status || 'published',
      publishedAt: req.body.status === 'published' ? now : undefined,
      createdAt: now,
      updatedAt: now,
    }
    await insertProduct(product)
    const savedProduct = await readProduct(product.id)
    sendSuccess(res, savedProduct, '创建成功')
  } catch (error: any) {
    sendError(res, error.message || '创建失败', 500)
  }
}

/**
 * 更新产品
 */
export const updateProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string
    const existing = await queryOne('SELECT * FROM products WHERE id = ?', [id])
    if (!existing) {
      return sendError(res, '产品不存在', 404)
    }

    if (req.body.managerId && existing.managerId !== req.body.managerId) {
      return sendError(res, '无权操作此产品', 403)
    }

    const title = (req.body.title || '').trim()
    if (title) {
      const duplicate = await queryOne('SELECT id FROM products WHERE title = ? AND id != ?', [title, id])
      if (duplicate) {
        return sendError(res, '产品标题已存在，请修改后重新发布', 409)
      }
    }

    const now = new Date()
    const nowStr = now.toISOString().replace('T', ' ').substring(0, 19)
    const updatedFields: Record<string, any> = {
      ...req.body,
      publishedAt: req.body.status === 'published' && !existing.publishedAt ? nowStr : existing.publishedAt,
    }
    await updateProduct(id, updatedFields)

    const updated = await readProduct(id)
    sendSuccess(res, updated, '更新成功')
  } catch (error: any) {
    sendError(res, error.message || '更新失败', 500)
  }
}

/**
 * 删除产品
 */
export const deleteProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('[删除产品] 收到请求, ID:', req.params.id, 'ManagerId:', req.query.managerId)
    const id = req.params.id as string

    const products = await readProducts()
    const product = products.find((p: any) => p.id === id)
    if (!product) {
      console.log('[删除产品] 产品不存在:', id)
      return sendError(res, '产品不存在', 404)
    }

    console.log('[删除产品] 找到产品:', product.title, 'managerId:', product.managerId)

    // 校验产品归属
    const managerId = req.query.managerId as string
    if (managerId && product.managerId !== managerId) {
      console.log('[删除产品] 无权删除, 请求者:', managerId, '所有者:', product.managerId)
      return sendError(res, '无权操作此产品', 403)
    }

    console.log('[删除产品] 开始删除, ID:', id)
    await deleteProduct(id)
    console.log('[删除产品] 删除成功, ID:', id)
    sendSuccess(res, null, '删除成功')
  } catch (error: any) {
    console.error('[删除产品] 错误:', error)
    sendError(res, error.message || '删除失败', 500)
  }
}
