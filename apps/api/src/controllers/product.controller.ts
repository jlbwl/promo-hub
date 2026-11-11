import { Request, Response } from 'express'
import { getErrorMessage } from '@promo/shared'
import { sendSuccess, sendError, sendPagination, sendServerError } from '../utils/response.js'
import { parsePage, parsePageSize } from '../utils/pagination.js'
import { sanitizeRichText } from '../utils/sanitize.js'
import { productService } from '../services/index.js'
import logger from '../utils/logger.js'
import { ResourcePermissionChecker } from '../middleware/resourcePermission.js'

/**
 * 获取产品列表
 * 支持分页、分类筛选、状态筛选、经理筛选和关键词搜索
 * @param req - HTTP请求对象，包含查询参数（page, pageSize, category, status, managerId, keyword）
 * @param res - HTTP响应对象
 */
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user
    const { page = '1', pageSize = '10', category, categories, status, keyword, adminMode } = req.query
    const pageNum = parsePage(page)
    const pageSizeNum = parsePageSize(pageSize)

    // 用户端归并分类组：多个二级分类值以逗号分隔；显式传空表示该组暂无分类
    const categoryValues = typeof categories === 'string'
      ? categories.split(',').map(v => v.trim()).filter(Boolean)
      : undefined

    // 根据用户角色自动设置managerId
    let managerId = req.query.managerId as string
    if (user && user.role === 'manager') {
      // 经理只能查看自己的产品
      managerId = user.id
    }

    logger.info('[ProductController] 获取产品列表', {
      userId: user?.id,
      role: user?.role,
      managerId,
      category,
      status,
      keyword
    })

    // M10：仅管理员/经理可查看非上架产品；访客与普通用户强制只看已上架
    const canViewUnpublished = user?.role === 'admin' || user?.role === 'manager'
    const effectiveStatus = canViewUnpublished ? (status as string) : 'published'

    const { list, total } = await productService.getProducts({
      page: pageNum,
      pageSize: pageSizeNum,
      category: category as string,
      categories: categoryValues,
      status: effectiveStatus,
      managerId,
      keyword: keyword as string,
      // 仅管理员可开启管理视图，避免普通用户/经理通过 query 参数绕过可见性限制
      adminMode: user?.role === 'admin' && String(adminMode).toLowerCase() === 'true',
    })

    sendPagination(res, list, total, pageNum, pageSizeNum)
  } catch (error) {
    logger.error('[ProductController] 获取产品列表失败', {
      error: getErrorMessage(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    sendServerError(res, error, '获取失败')
  }
}

/**
 * 获取单个产品详情
 * 根据产品ID查询产品信息，并统计该产品的做单量
 * @param req - HTTP请求对象，包含产品ID（req.params.id）
 * @param res - HTTP响应对象
 * @returns 产品详细信息，包含销售数量
 */
export const getProductById = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string
  try {
    const user = req.user
    
    logger.info('[ProductController] 获取产品详情', {
      productId: id,
      userId: user?.id,
      role: user?.role
    })

    // 使用资源权限检查器进行二次验证（可选，因为中间件已经检查过）
    if (user && user.role !== 'admin') {
      const check = await ResourcePermissionChecker.checkProduct(user.id, user.role, id, 'read')
      if (!check.allowed) {
        return sendError(res, check.message || '无权访问', 403)
      }
    }

    const { product, sales } = await productService.getProductById(id)

    // M10：访客/普通用户不允许读取草稿或下架产品，返回明确文案供前端友好提示
    const canViewUnpublished = user?.role === 'admin' || user?.role === 'manager'
    if (!canViewUnpublished && product.status !== 'published') {
      return sendError(res, '该产品已下架', 403)
    }

    product.sales = sales
    sendSuccess(res, product)
  } catch (error) {
    logger.error('[ProductController] 获取产品详情失败', {
      productId: id,
      error: getErrorMessage(error)
    })
    sendServerError(res, error, '获取失败')
  }
}

/**
 * 创建产品
 * 验证产品标题唯一性，生成产品ID，并保存到数据库
 * @param req - HTTP请求对象，包含产品数据（title, description, price等）
 * @param res - HTTP响应对象
 * @returns 新创建的产品信息
 */
/**
 * M5：价格/库存入参校验。
 * - 价格必须是有限数字，0 ≤ 价格 ≤ 10000，且最多两位小数
 * - 库存必须是整数，且落在 [-1, 1000000]（-1/0 的历史语义保持不变）
 * @returns 错误文案；合法返回 null
 */
function validateProductFields(body: Record<string, unknown>): string | null {
  if (body.productPrice !== undefined && body.productPrice !== null && body.productPrice !== '') {
    const price = Number(body.productPrice)
    if (!Number.isFinite(price) || price < 0 || price > 10000) {
      return '产品价格需在 0-10000 之间'
    }
    if (Math.round(price * 100) !== price * 100) {
      return '产品价格最多保留两位小数'
    }
  }
  if (body.stock !== undefined && body.stock !== null && body.stock !== '') {
    const stock = Number(body.stock)
    if (!Number.isInteger(stock) || stock < -1 || stock > 1000000) {
      return '库存必须为不小于 -1 的整数'
    }
  }
  return null
}

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user
    const invalid = validateProductFields(req.body as Record<string, unknown>)
    if (invalid) {
      return sendError(res, invalid, 400)
    }
    // 富文本描述入库前净化，防存储型 XSS（用户端 v-html 渲染）
    if (typeof req.body.description === 'string') {
      req.body.description = sanitizeRichText(req.body.description)
    }
    const productData = {
      ...req.body,
      // 确保managerId是当前用户的ID（经理自己创建自己的产品）
      managerId: user?.role === 'manager' ? user.id : req.body.managerId
    }

    logger.info('[ProductController] 创建产品', {
      userId: user?.id,
      role: user?.role,
      managerId: productData.managerId
    })

    const savedProduct = await productService.createProduct(productData)
    logger.info('[ProductController] 产品创建成功', { productId: savedProduct.id })
    sendSuccess(res, savedProduct, '创建成功')
  } catch (error) {
    logger.error('[ProductController] 创建产品失败', {
      error: getErrorMessage(error)
    })
    sendServerError(res, error, '创建失败')
  }
}

/**
 * 更新产品信息
 * 验证产品存在性和归属权限，检查标题唯一性，更新产品数据
 * @param req - HTTP请求对象，包含产品ID（req.params.id）和更新数据
 * @param res - HTTP响应对象
 * @returns 更新后的产品信息
 */
export const updateProductById = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string
  try {
    const user = req.user
    const invalid = validateProductFields(req.body as Record<string, unknown>)
    if (invalid) {
      return sendError(res, invalid, 400)
    }
    // 从用户信息中获取managerId（中间件已经验证了权限）
    const managerId = user?.role === 'manager' ? user.id : (req.body.managerId || '')

    // 富文本描述入库前净化，防存储型 XSS（用户端 v-html 渲染）
    if (typeof req.body.description === 'string') {
      req.body.description = sanitizeRichText(req.body.description)
    }

    logger.info('[ProductController] 更新产品', {
      productId: id,
      userId: user?.id,
      role: user?.role
    })

    const updated = await productService.updateProduct(id, managerId, req.body)
    logger.info('[ProductController] 产品更新成功', { productId: id })
    sendSuccess(res, updated, '更新成功')
  } catch (error) {
    logger.error('[ProductController] 更新产品失败', {
      productId: id,
      error: getErrorMessage(error)
    })
    sendServerError(res, error, '更新失败')
  }
}

/**
 * 删除产品
 * 验证产品存在性和归属权限，只有产品所有者才能删除
 * @param req - HTTP请求对象，包含产品ID（req.params.id）和经理ID（req.query.managerId）
 * @param res - HTTP响应对象
 * @returns 删除操作结果
 */
export const deleteProductById = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string
  try {
    const user = req.user
    
    // 从用户信息中获取managerId
    const managerId = user?.role === 'manager' ? user.id : (req.query.managerId as string || '')

    logger.info('[ProductController] 删除产品', {
      productId: id,
      userId: user?.id,
      role: user?.role,
      managerId
    })

    await productService.deleteProduct(id, managerId)
    logger.info('[ProductController] 产品删除成功', { productId: id })
    sendSuccess(res, null, '删除成功')
  } catch (error) {
    logger.error('[ProductController] 删除产品失败', {
      productId: id,
      error: getErrorMessage(error)
    })
    sendServerError(res, error, '删除失败')
  }
}

