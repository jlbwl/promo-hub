import { Request, Response } from 'express'
import { CategoryService } from '../services/CategoryService.js'
import { sendSuccess, sendError } from '../utils/response.js'

const categoryService = new CategoryService()

/**
 * 获取所有分类
 */
export async function getCategories(req: Request, res: Response) {
  try {
    const includeArchived = req.query.includeArchived === 'true'
    const categories = await categoryService.getAllCategories(includeArchived)
    sendSuccess(res, { list: categories })
  } catch (err) {
    sendError(res, '获取分类失败')
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
