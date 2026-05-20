import { Request, Response } from 'express'
import { CategoryService } from '../services/CategoryService.js'
import { sendSuccess, sendError } from '../utils/response.js'

const categoryService = new CategoryService()

// 默认分类数据（用于降级）
const defaultCategories = [
  { id: 'cat_1', name: '综合-立返', value: 'comprehensive-instant', sort: 1, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cat_2', name: '综合-数据', value: 'comprehensive-data', sort: 2, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cat_3', name: '个养和加挂', value: 'personal-insurance', sort: 3, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cat_4', name: '限三-立返', value: 'limit3-instant', sort: 4, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cat_5', name: '限三-数据', value: 'limit3-data', sort: 5, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cat_6', name: '不限三-立返', value: 'unlimit3-instant', sort: 6, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cat_7', name: '不限三-数据', value: 'unlimit3-data', sort: 7, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
]

/**
 * 获取所有分类
 */
export async function getCategories(req: Request, res: Response) {
  try {
    const includeArchived = req.query.includeArchived === 'true'
    let categories = await categoryService.getAllCategories(includeArchived)
    sendSuccess(res, { list: categories })
  } catch (dbError: any) {
    console.warn('[获取分类] 数据库查询失败，使用默认数据:', dbError)
    // 降级到默认分类数据
    const includeArchived = req.query.includeArchived === 'true'
    const categories = includeArchived ? defaultCategories : defaultCategories.filter(c => c.status === 'active')
    sendSuccess(res, { list: categories })
  }
}

/**
 * 创建分类
 */
export async function createCategory(req: Request, res: Response) {
  try {
    const { name, value, sort } = req.body

    if (!name) {
      return sendError(res, '分类名称不能为空')
    }
    if (!value) {
      return sendError(res, '分类值不能为空')
    }

    const category = await categoryService.createCategory(name, value, sort)
    sendSuccess(res, category, '创建成功')
  } catch (err) {
    sendError(res, '创建分类失败')
  }
}

/**
 * 更新分类
 */
export async function updateCategory(req: Request, res: Response) {
  try {
    const id = req.params.id as string
    const { name, sort, status } = req.body

    const category = await categoryService.updateCategory(id, { name, sort, status })
    if (!category) {
      return sendError(res, '分类不存在', 404)
    }

    sendSuccess(res, category, '更新成功')
  } catch (err) {
    sendError(res, '更新分类失败')
  }
}

/**
 * 归档分类
 */
export async function archiveCategory(req: Request, res: Response) {
  try {
    const id = req.params.id as string

    const successResult = await categoryService.archiveCategory(id)
    if (!successResult) {
      return sendError(res, '分类不存在', 404)
    }

    sendSuccess(res, null, '归档成功')
  } catch (err) {
    sendError(res, '归档分类失败')
  }
}
