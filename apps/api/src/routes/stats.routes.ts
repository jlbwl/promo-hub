import { Router } from 'express'
import {
  getStats,
  getDashboardStats,
} from '../controllers/stats.controller.js'

const router: Router = Router()

// 审核与结算路由由 order.routes.ts 注册（此处原为被遮蔽的死路由，已移除）
router.get('/orders/stats', getStats)
router.get('/stats/dashboard', getDashboardStats)

export default router
