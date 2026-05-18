import { Router } from 'express'
import {
  getStats,
  reviewOrder,
  settleOrder,
  getDashboardStats,
} from '../controllers/stats.controller.js'

const router: Router = Router()

router.get('/orders/stats', getStats)
router.get('/stats/dashboard', getDashboardStats)
router.put('/orders/:id/review', reviewOrder)
router.put('/orders/:id/settle', settleOrder)

export default router
