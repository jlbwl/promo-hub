import { Router } from 'express'
import { requireAuth, requireManager } from '../middleware/auth.js'
import {
  getStats,
  getDashboardStats,
} from '../controllers/stats.controller.js'

const router: Router = Router()

// 审核与结算路由由 order.routes.ts 注册（此处原为被遮蔽的死路由，已移除）
// 订单统计：所有已登录用户可访问（controller 层按角色强制过滤）
router.get('/orders/stats', requireAuth, getStats)
// 仪表盘统计：仅经理与管理员可访问（manager 角色强制取本人数据）
router.get('/stats/dashboard', requireManager, getDashboardStats)

export default router
