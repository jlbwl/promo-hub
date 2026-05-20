import { Router, Router as ExpressRouter } from 'express'
import {
  getCategories,
  createCategory,
  updateCategory,
  archiveCategory
} from '../controllers/category.controller.js'
import { requireAdmin } from '../middleware/auth.js'

const router: ExpressRouter = Router()

// 获取所有分类（无需认证）
router.get('/categories', getCategories)

// 创建分类（仅管理员）
router.post('/categories', requireAdmin, createCategory)

// 更新分类（仅管理员）
router.put('/categories/:id', requireAdmin, updateCategory)

// 归档分类（仅管理员）
router.delete('/categories/:id', requireAdmin, archiveCategory)

export default router
