import { Request, Response } from 'express'
import { CategoryService } from '../services/CategoryService.js'
import { sendSuccess, sendError } from '../utils/response.js'
import * as dataMemory from '../data-memory.js'
import logger from '../utils/logger.js'

const categoryService = new CategoryService()

/**
 * 获取所有分类
 */
export async function getCategories(req: Request, res: Response) {
  const includeArchived = req.query.includeArchived === 'true'
  
  try {
    const categories = await categoryService.getAllCategories(includeArchived)
    sendSuccess(res, { list: categories })
    return
  } catch (dbError: any) {
    logger.logError(dbError, 'GET', '/api/categories', req.ip, '')
  }

  // 降级到文件存储
  try {
    const categories = await dataMemory.readCategories(includeArchived)
    sendSuccess(res, { list: categories })
  } catch (fallbackErr) {
    logger.logError(fallbackErr as Error, 'GET', '/api/categories', req.ip, '')
    sendError(res, '获取分类失败', 500, 500)
  }
}

/**
 * 创建分类
 */
export async function createCategory(req: Request, res: Response) {
  const { name, value, sort } = req.body

  if (!name) {
    return sendError(res, '分类名称不能为空')
  }
  if (!value) {
    return sendError(res, '分类值不能为空')
  }

  try {
    const category = await categoryService.createCategory(name, value, sort)
    sendSuccess(res, category, '创建成功')
    return
  } catch (dbError: any) {
    logger.logError(dbError, 'POST', '/api/categories', req.ip, '')
  }

  // 降级到文件存储
  try {
    const category = await dataMemory.createCategory(name, value, sort)
    sendSuccess(res, category, '创建成功')
  } catch (fallbackErr) {
    logger.logError(fallbackErr as Error, 'POST', '/api/categories', req.ip, '')
    sendError(res, '创建分类失败', 500, 500)
  }
}

/**
 * 更新分类
 */
export async function updateCategory(req: Request, res: Response) {
  const id = req.params.id as string
  const { name, sort, status } = req.body

  let category = null
  
  try {
    category = await categoryService.updateCategory(id, { name, sort, status })
  } catch (dbError: any) {
    logger.logError(dbError, 'PUT', `/api/categories/${id}`, req.ip, '')
  }

  if (!category) {
    try {
      category = await dataMemory.updateCategory(id, { name, sort, status })
    } catch (fallbackErr) {
      logger.logError(fallbackErr as Error, 'PUT', `/api/categories/${id}`, req.ip, '')
    }
  }

  if (!category) {
    return sendError(res, '分类不存在', 404, 404)
  }

  sendSuccess(res, category, '更新成功')
}

/**
 * 归档分类
 */
export async function archiveCategory(req: Request, res: Response) {
  const id = req.params.id as string
  let successResult = false

  try {
    successResult = await categoryService.archiveCategory(id)
  } catch (dbError: any) {
    logger.logError(dbError, 'DELETE', `/api/categories/${id}`, req.ip, '')
  }

  if (!successResult) {
    try {
      successResult = await dataMemory.archiveCategory(id)
    } catch (fallbackErr) {
      logger.logError(fallbackErr as Error, 'DELETE', `/api/categories/${id}`, req.ip, '')
    }
  }

  if (!successResult) {
    return sendError(res, '分类不存在', 404, 404)
  }

  sendSuccess(res, null, '归档成功')
}
