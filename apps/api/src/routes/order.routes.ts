import { Router } from 'express'
import { requireAdmin, requireAuth, requireManager } from '../middleware/auth.js'
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

// 订单创建 - 支持登录用户和访客模式
router.post('/orders', createOrder)
// 订单列表 - 所有已登录用户均可（controller 层根据 role 强制过滤）
router.get('/orders', requireAuth, getOrders)
// 管理员删除订单
router.delete('/orders/:id', requireAdmin, adminDeleteOrder)
// 用户删除自己的订单（软删除）
router.delete('/user/orders/:id', requireAuth, deleteUserOrder)
// 用户查看回收站
router.get('/user/orders/deleted', requireAuth, getDeletedOrders)
// 用户从回收站恢复订单
router.post('/user/orders/:id/restore', requireAuth, restoreUserOrder)
// 用户提交资金号
router.post('/user/orders/fund-account', requireAuth, submitFundAccount)
// 经理/管理员审核订单
router.put('/orders/:id/review', requireManager, reviewOrder)
// 经理/管理员结算订单
router.put('/orders/:id/settle', requireManager, settleOrder)
// 管理员更新订单团队名称
router.put('/orders/:id/team-name', requireAdmin, updateOrderTeamName)

export default router
