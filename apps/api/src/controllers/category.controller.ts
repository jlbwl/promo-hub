import { Request, Response } from 'express'
import { CategoryService, type Category } from '../services/CategoryService.js'
import { sendSuccess, sendError } from '../utils/response.js'
import * as dataMemory from '../data-memory.js'
import { logAdminOperation } from '../utils/auditLog.js'
import { buildAuditDetail, type AuditChangeInput } from '../utils/auditDetail.js'
import logger from '../utils/logger.js'

const categoryService = new CategoryService()

/** 分类状态展示文案 */
const categoryStatusLabel = (status?: string): string =>
  status === 'active' ? '启用' : status === 'archived' ? '已归档' : status || '-'

/** 记录分类创建日志；写入失败由 logAdminOperation 内部兜底，不影响主流程 */
async function logCategoryCreated(
  req: Request,
  category: { id: string; name: string; value: string; sort: number; status: string }
): Promise<void> {
  await logAdminOperation(req, {
    operationType: 'create',
    targetType: 'category',
    targetId: category.id,
    targetName: category.name,
    detail: buildAuditDetail({
      summary: `创建分类「${category.name}」`,
      meta: {
        分类ID: category.id,
        分类值: category.value,
        排序: category.sort,
        状态: categoryStatusLabel(category.status),
      },
    }),
  })
}

/**
 * 获取所有分类
 */
export async function getCategories(req: Request, res: Response) {
  const includeArchived = req.query.includeArchived === 'true'
  
  try {
    const categories = await categoryService.getAllCategories(includeArchived)
    sendSuccess(res, { list: categories })
    return
  } catch (dbError) {
    logger.logError(dbError as Error, 'GET', '/api/categories', req.ip, '')
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

  // 日志写在创建成功之后、独立的语句中，避免日志异常触发降级逻辑造成重复创建
  let category: Category | null = null
  try {
    category = await categoryService.createCategory(name, value, sort)
  } catch (dbError) {
    logger.logError(dbError as Error, 'POST', '/api/categories', req.ip, '')
  }

  if (category) {
    await logCategoryCreated(req, category)
    return sendSuccess(res, category, '创建成功')
  }

  // 降级到文件存储
  let fallbackCategory: Category | null = null
  try {
    fallbackCategory = await dataMemory.createCategory(name, value, sort)
  } catch (fallbackErr) {
    logger.logError(fallbackErr as Error, 'POST', '/api/categories', req.ip, '')
    return sendError(res, '创建分类失败', 500, 500)
  }

  await logCategoryCreated(req, fallbackCategory)
  sendSuccess(res, fallbackCategory, '创建成功')
}

/**
 * 更新分类
 */
export async function updateCategory(req: Request, res: Response) {
  const id = req.params.id as string
  const { name, sort, status } = req.body

  let category: Category | null = null

  // 读取更新前的分类快照，用于记录旧值；读取失败时旧值以 '-' 呈现
  let before: Category | null = null
  try {
    before = await categoryService.getCategoryById(id)
  } catch {
    // 旧值读取失败不影响更新流程
  }
  
  try {
    category = await categoryService.updateCategory(id, { name, sort, status })
  } catch (dbError) {
    logger.logError(dbError as Error, 'PUT', `/api/categories/${id}`, req.ip, '')
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

  // 仅记录本次实际提交且发生变化的字段
  const changes: AuditChangeInput[] = []
  if (name !== undefined && before?.name !== category.name) {
    changes.push({ field: 'name', label: '分类名称', from: before?.name, to: category.name })
  }
  if (sort !== undefined && before?.sort !== category.sort) {
    changes.push({ field: 'sort', label: '排序', from: before?.sort, to: category.sort })
  }
  if (status !== undefined && before?.status !== category.status) {
    changes.push({
      field: 'status',
      label: '状态',
      from: before ? categoryStatusLabel(before.status) : '-',
      to: categoryStatusLabel(category.status),
    })
  }

  await logAdminOperation(req, {
    operationType: 'update',
    targetType: 'category',
    targetId: id,
    targetName: category.name,
    detail: buildAuditDetail({
      summary: `更新分类「${category.name}」${changes.length ? `（${changes.length} 项变更）` : ''}`,
      meta: {
        分类ID: category.id,
        分类值: category.value,
        排序: category.sort,
        状态: categoryStatusLabel(category.status),
      },
      changes,
    }),
  })

  sendSuccess(res, category, '更新成功')
}

/**
 * 归档分类
 */
export async function archiveCategory(req: Request, res: Response) {
  const id = req.params.id as string
  let successResult = false
  let categoryName = ''

  try {
    const category = await categoryService.getCategoryById(id)
    categoryName = category?.name || ''
  } catch {
    // 读取分类名失败不影响归档流程
  }

  try {
    successResult = await categoryService.archiveCategory(id)
  } catch (dbError) {
    logger.logError(dbError as Error, 'DELETE', `/api/categories/${id}`, req.ip, '')
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

  await logAdminOperation(req, {
    operationType: 'delete',
    targetType: 'category',
    targetId: id,
    targetName: categoryName || id,
    reason: '管理员归档分类',
    detail: '分类已归档（软删除）'
  })

  sendSuccess(res, null, '归档成功')
}
