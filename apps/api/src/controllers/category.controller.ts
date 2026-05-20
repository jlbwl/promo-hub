import { Request, Response } from 'express'
import { CategoryService } from '../services/CategoryService.js'
import { sendSuccess, sendError } from '../utils/response.js'
import * as dataMemory from '../data-memory.js'

const categoryService = new CategoryService()

/**
 * 获取所有分类
 */
export async function getCategories(req: Request, res: Response) {
  try {
    const includeArchived = req.query.includeArchived === 'true'
    let categories = await categoryService.getAllCategories(includeArchived)
    sendSuccess(res, { list: categories })
  } catch (dbError: any) {
    console.warn('[获取分类] 数据库查询失败，使用文件存储:', dbError)
    // 降级到文件存储
    const includeArchived = req.query.includeArchived === 'true'
    const categories = await dataMemory.readCategories(includeArchived)
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

    let category
    try {
      category = await categoryService.createCategory(name, value, sort)
    } catch {
      category = await dataMemory.createCategory(name, value, sort)
    }
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

    let category
    try {
      category = await categoryService.updateCategory(id, { name, sort, status })
    } catch {
      category = await dataMemory.updateCategory(id, { name, sort, status })
    }
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

    let successResult
    try {
      successResult = await categoryService.archiveCategory(id)
    } catch {
      successResult = await dataMemory.archiveCategory(id)
    }
    if (!successResult) {
      return sendError(res, '分类不存在', 404)
    }

    sendSuccess(res, null, '归档成功')
  } catch (err) {
    sendError(res, '归档分类失败')
  }
}
