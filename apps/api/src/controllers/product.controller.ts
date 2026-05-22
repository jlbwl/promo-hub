import { Request, Response } from 'express'
import { sendSuccess, sendError, sendPagination } from '../utils/response.js'
import { productService } from '../services/index.js'

/**
 * 获取产品列表
 * 支持分页、分类筛选、状态筛选、经理筛选和关键词搜索
 * @param req - HTTP请求对象，包含查询参数（page, pageSize, category, status, managerId, keyword）
 * @param res - HTTP响应对象
 */
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', pageSize = '10', category, status, managerId, keyword, adminMode } = req.query

    const { list, total } = await productService.getProducts({
      page: parseInt(page as string, 10),
      pageSize: parseInt(pageSize as string, 10),
      category: category as string,
      status: status as string,
      managerId: managerId as string,
      keyword: keyword as string,
      adminMode: adminMode === 'true' || adminMode === true,
    })

    sendPagination(res, list, total, parseInt(page as string, 10), parseInt(pageSize as string, 10))
  } catch (error: any) {
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
  try {
    const id = req.params.id as string
    const { product, sales } = await productService.getProductById(id)
    product.sales = sales
    sendSuccess(res, product)
  } catch (error: any) {
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
    const savedProduct = await productService.createProduct(req.body)
    sendSuccess(res, savedProduct, '创建成功')
  } catch (error: any) {
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
  try {
    const id = req.params.id as string
    const managerId = req.body.managerId || ''
    const updated = await productService.updateProduct(id, managerId, req.body)
    sendSuccess(res, updated, '更新成功')
  } catch (error: any) {
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
  try {
    const id = req.params.id as string
    const managerId = req.query.managerId as string
    await productService.deleteProduct(id, managerId)
    sendSuccess(res, null, '删除成功')
  } catch (error: any) {
    sendError(res, error.message || '删除失败', error.code || 500)
  }
}
