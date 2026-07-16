import { Router } from 'express'
import { requireAdmin } from '../middleware/auth.js'
import {
  createOrder,
  getOrders,
  adminDeleteOrder,
  deleteUserOrder,
  getDeletedOrders,
  restoreUserOrder,
  submitFundAccount,
  reviewOrder,
  settleOrder,
  updateOrderTeamName,
} from '../controllers/order.controller.js'

const router: Router = Router()

router.post('/orders', createOrder)
router.get('/orders', getOrders)
router.delete('/orders/:id', requireAdmin, adminDeleteOrder)
router.delete('/user/orders/:id', deleteUserOrder)
router.get('/user/orders/deleted', getDeletedOrders)
router.post('/user/orders/:id/restore', restoreUserOrder)
router.post('/user/orders/fund-account', submitFundAccount)
router.put('/orders/:id/review', reviewOrder)
router.put('/orders/:id/settle', settleOrder)
router.put('/orders/:id/team-name', requireAdmin, updateOrderTeamName)

export default router
