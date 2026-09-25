import logger from '../utils/logger.js'
import { Request, Response } from 'express'
import { CommissionStatus, getErrorMessage, type Commission, type OrderStats, type Product } from '@promo/shared'
import { sendSuccess, sendError } from '../utils/response.js'
import type { OrderRow } from '../data-memory.js'
import {
  getOrderStats,
  readOrders,
  readOrder,
  readProducts,
  readCommissions,
  readProduct,
  readCommissionByOrderId,
  updateCommission,
  applyOrderReview,
  updateOrderIfStatus,
} from '../data/index.js'

/**
 * 获取订单统计
 * 统计订单总数、各状态数量（待审核、已通过、待发放、已发放、已驳回）
 * 支持按用户、经理或员工筛选
 * @param req - HTTP请求对象，包含用户ID、经理ID或员工ID
 * @param res - HTTP响应对象
 * @returns 订单统计数据
 */
export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    let { userId, managerId, employeeId } = req.query as Record<string, string | undefined>
    const currentUser = req.user

    // P1-7: 按登录角色强制覆盖查询身份，防止越权查看他人统计
    if (currentUser?.role === 'user') {
      userId = currentUser.id
    } else if (currentUser?.role === 'manager') {
      managerId = currentUser.id
    } else if (currentUser?.role === 'employee') {
      employeeId = currentUser.id
    }

    let stats: OrderStats | null = null
    try {
      stats = await getOrderStats(managerId as string)
    } catch (dbError) {
      logger.warn('[订单统计] 数据库查询失败，尝试降级到内存:', { error: getErrorMessage(dbError) })
      const { getOrderStats: memGetOrderStats } = await import('../data-memory.js')
      stats = await memGetOrderStats(managerId as string)
    }

    if (userId || employeeId) {
      let orders: OrderRow[] = []
      try {
        orders = await readOrders()
      } catch (dbError2) {
        logger.warn('[订单统计] readOrders 失败，尝试降级:', { error: getErrorMessage(dbError2) })
        const { readOrders: memReadOrders } = await import('../data-memory.js')
        orders = await memReadOrders()
      }
      
      const filteredOrders = orders.filter((o: OrderRow) => {
        if (employeeId) {
          return o.employeeId === employeeId
        }
        return o.userId === userId
      })
      
      const pending = filteredOrders.filter((o: OrderRow) => o.status === 'pending').length
      const approved = filteredOrders.filter((o: OrderRow) => o.status === 'approved').length
      const pendingPayment = filteredOrders.filter((o: OrderRow) => o.status === 'pending_payment').length
      const settled = filteredOrders.filter((o: OrderRow) => o.status === 'settled').length
      const rejected = filteredOrders.filter((o: OrderRow) => o.status === 'rejected').length
      sendSuccess(res, { total: filteredOrders.length, pending, approved, pendingPayment, settled, rejected })
    } else {
      sendSuccess(res, stats)
    }
  } catch (error) {
    logger.error('[订单统计] 最终错误:', { error: getErrorMessage(error) })
    sendSuccess(res, { total: 0, pending: 0, approved: 0, pendingPayment: 0, settled: 0, rejected: 0 })
  }
}

/**
 * 经理审核订单（通过/驳回）
 * 验证订单状态，更新订单状态，记录审核时间
 * 审核通过时创建佣金记录，审核驳回时恢复库存
 * @param req - HTTP请求对象，包含订单ID、审核动作（approve/reject）和驳回原因
 * @param res - HTTP响应对象
 * @returns 审核结果
 */
export const reviewOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = req.params.id as string
    const { action, reason } = req.body

    if (!action || !['approve', 'reject'].includes(action)) {
      return sendError(res, '无效的审核操作', 400)
    }

    const order = await readOrder(orderId)
    if (!order) {
      return sendError(res, '订单不存在', 404)
    }
    if (order.status !== 'pending') {
      return sendError(res, '该订单已审核', 400)
    }

    const now = new Date()
    // 转换为 MySQL DATETIME 格式（不接受 ISO 8601 带 Z 后缀）
    const nowMySQL = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0')

    let updated = false
    if (action === 'approve') {
      // 事务：更新订单 + 创建待发放佣金记录，原子提交
      updated = await applyOrderReview(orderId, { reviewedAt: nowMySQL }, 'pending', 'approved', {
        id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        orderId: order.id,
        userId: order.userId,
        managerId: order.managerId,
        productName: order.productName,
        amount: order.productPrice,
        status: CommissionStatus.PENDING,
      })
    } else {
      // 不限库存（stock 未设置或 -1）的产品驳回时不回补
      const product = order.productId ? await readProduct(order.productId) : null
      const shouldRestoreStock = !!product && product.stock !== undefined && product.stock >= 0
      // 事务：更新订单 + 库存回补，原子提交
      updated = await applyOrderReview(
        orderId,
        { reviewedAt: nowMySQL, rejectReason: reason || '推广无效' },
        'pending',
        'rejected',
        undefined,
        shouldRestoreStock ? product!.id : undefined
      )
    }

    if (!updated) {
      // 并发下订单已被审核
      return sendError(res, '该订单已审核', 400)
    }

    sendSuccess(
      res,
      {
        ...order,
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewedAt: nowMySQL,
        ...(action === 'reject' ? { rejectReason: reason || '推广无效' } : {}),
      },
      action === 'approve' ? '审核通过' : '已驳回'
    )
  } catch (error) {
    logger.error('[审核订单] 错误:', { error: getErrorMessage(error) })
    sendError(res, getErrorMessage(error, '操作失败'), 500)
  }
}

/**
 * 经理结算操作（添加到待付款 / 确认已付款）
 */
export const settleOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = req.params.id as string
    const { action } = req.body

    if (!action || !['pending_payment', 'paid'].includes(action)) {
      return sendError(res, '无效的结算操作', 400)
    }

    const order = await readOrder(orderId)
    if (!order) {
      return sendError(res, '订单不存在', 404)
    }

    if (action === 'pending_payment') {
      if (order.status !== 'approved') {
        return sendError(res, '仅已通过的订单可添加到待付款', 400)
      }
      // 转换为 MySQL DATETIME 格式
      const now = new Date()
      const addedToPaymentAt = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0') + ' ' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0') + ':' +
        String(now.getSeconds()).padStart(2, '0')
      const updated = await updateOrderIfStatus(orderId, { status: 'pending_payment', addedToPaymentAt }, 'approved')
      if (!updated) {
        return sendError(res, '订单状态已变化，请刷新后重试', 400)
      }
      sendSuccess(res, { ...order, status: 'pending_payment', addedToPaymentAt }, '已添加到待付款')
    } else {
      if (order.status !== 'pending_payment') {
        return sendError(res, '仅待付款的订单可确认结算', 400)
      }
      // 转换为 MySQL DATETIME 格式
      const now = new Date()
      const settledAt = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0') + ' ' +
        String(now.getHours()).padStart(2, '0') + ':' +
        String(now.getMinutes()).padStart(2, '0') + ':' +
        String(now.getSeconds()).padStart(2, '0')
      const updated = await updateOrderIfStatus(orderId, { status: 'settled', settledAt }, 'pending_payment')
      if (!updated) {
        return sendError(res, '订单状态已变化，请刷新后重试', 400)
      }
      const commission = await readCommissionByOrderId(orderId)
      if (commission) {
        await updateCommission(commission.id, { status: CommissionStatus.PAID, paidAt: settledAt })
      }
      sendSuccess(res, { ...order, status: 'settled', settledAt }, '已确认结算')
    }
  } catch (error) {
    logger.error('[结算订单] 错误:', { error: getErrorMessage(error) })
    sendError(res, getErrorMessage(error, '操作失败'), 500)
  }
}

/**
 * 获取经理仪表盘统计
 */
export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const managerId = req.query.managerId as string
    const products = await readProducts()
    const commissions = await readCommissions()

    const myProducts = managerId
      ? products.filter((p: Product) => p.managerId === managerId)
      : products

    const totalProducts = myProducts.length
    const publishedProducts = myProducts.filter((p: Product) => p.status === 'published').length

    const myProductIds = new Set(myProducts.map((p: Product) => p.id))
    const myCommissions = managerId
      ? commissions.filter((c: Commission) => myProductIds.has(c.productId as string))
      : commissions

    const pendingCommissions = myCommissions
      .filter((c: Commission) => c.status === 'pending')
      .reduce((sum: number, c: Commission) => sum + (c.amount || 0), 0)

    const totalCommissions = myCommissions
      .filter((c: Commission) => c.status === 'paid')
      .reduce((sum: number, c: Commission) => sum + (c.amount || 0), 0)

    sendSuccess(res, {
      totalProducts,
      publishedProducts,
      pendingCommissions: Math.round(pendingCommissions * 100) / 100,
      totalCommissions: Math.round(totalCommissions * 100) / 100,
    })
  } catch (error) {
    logger.error('[仪表盘统计] 错误:', { error: getErrorMessage(error) })
    sendError(res, getErrorMessage(error, '获取失败'), 500)
  }
}
