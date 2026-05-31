import { Request, Response } from 'express'
import { sendSuccess, sendError, sendPagination } from '../utils/response.js'
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
    const user = (req as any).user
    const { page = '1', pageSize = '10', category, status, keyword, adminMode } = req.query
    
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

    const { list, total } = await productService.getProducts({
      page: parseInt(page as string, 10),
      pageSize: parseInt(pageSize as string, 10),
      category: category as string,
      status: status as string,
      managerId,
      keyword: keyword as string,
      adminMode: String(adminMode).toLowerCase() === 'true',
    })

    sendPagination(res, list, total, parseInt(page as string, 10), parseInt(pageSize as string, 10))
  } catch (error: any) {
    logger.error('[ProductController] 获取产品列表失败', {
      error: error.message,
      stack: error.stack
    })
    sendError(res, error.message || '获取失败', error.code || 500)
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
    const user = (req as any).user
    
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
    product.sales = sales
    sendSuccess(res, product)
  } catch (error: any) {
    logger.error('[ProductController] 获取产品详情失败', {
      productId: id,
      error: error.message
    })
    sendError(res, error.message || '获取失败', error.code || 500)
  }
}

/**
 * 创建产品
 * 验证产品标题唯一性，生成产品ID，并保存到数据库
 * @param req - HTTP请求对象，包含产品数据（title, description, price等）
 * @param res - HTTP响应对象
 * @returns 新创建的产品信息
 */
export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
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
  } catch (error: any) {
    logger.error('[ProductController] 创建产品失败', {
      error: error.message
    })
    sendError(res, error.message || '创建失败', error.code || 500)
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
    const user = (req as any).user
    
    // 从用户信息中获取managerId（中间件已经验证了权限）
    const managerId = user?.role === 'manager' ? user.id : (req.body.managerId || '')

    logger.info('[ProductController] 更新产品', {
      productId: id,
      userId: user?.id,
      role: user?.role
    })

    const updated = await productService.updateProduct(id, managerId, req.body)
    logger.info('[ProductController] 产品更新成功', { productId: id })
    sendSuccess(res, updated, '更新成功')
  } catch (error: any) {
    logger.error('[ProductController] 更新产品失败', {
      productId: id,
      error: error.message
    })
    sendError(res, error.message || '更新失败', error.code || 500)
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
    const user = (req as any).user
    
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
  } catch (error: any) {
    logger.error('[ProductController] 删除产品失败', {
      productId: id,
      error: error.message
    })
    sendError(res, error.message || '删除失败', error.code || 500)
  }
}

