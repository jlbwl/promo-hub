import { Request, Response } from 'express'
import { sendSuccess, sendError } from '../utils/response.js'
import {
  getOrderStats,
  readOrders,
  readCommissions,
  readProducts,
  writeCommissions,
  writeProducts,
} from '../data.js'

/**
 * 获取订单统计
 * 统计订单总数、各状态数量（待审核、已通过、待发放、已发放、已驳回）
 * 支持按用户或经理筛选
 * @param req - HTTP请求对象，包含用户ID或经理ID
 * @param res - HTTP响应对象
 * @returns 订单统计数据
 */
export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, managerId } = req.query

    let stats: any = null
    try {
      stats = await getOrderStats(managerId as string)
    } catch (dbError: any) {
      console.warn('[订单统计] 数据库查询失败，尝试降级到内存:', dbError)
      const { getOrderStats: memGetOrderStats } = await import('../data-memory.js')
      stats = await memGetOrderStats(managerId as string)
    }

    if (userId) {
      let orders: any[] = []
      try {
        orders = await readOrders()
      } catch (dbError2: any) {
        console.warn('[订单统计] readOrders 失败，尝试降级:', dbError2)
        const { readOrders: memReadOrders } = await import('../data-memory.js')
        orders = await memReadOrders()
      }
      const filteredOrders = orders.filter((o: any) => o.userId === userId)
      const pending = filteredOrders.filter((o: any) => o.status === 'pending').length
      const approved = filteredOrders.filter((o: any) => o.status === 'approved').length
      const pendingPayment = filteredOrders.filter((o: any) => o.status === 'pending_payment').length
      const settled = filteredOrders.filter((o: any) => o.status === 'settled').length
      const rejected = filteredOrders.filter((o: any) => o.status === 'rejected').length
      sendSuccess(res, { total: filteredOrders.length, pending, approved, pendingPayment, settled, rejected })
    } else {
      sendSuccess(res, stats)
    }
  } catch (error: any) {
    console.error('[订单统计] 最终错误:', error)
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

    let orders = await readOrders()
    const index = orders.findIndex((o: any) => o.id === orderId)
    if (index === -1) {
      return sendError(res, '订单不存在', 404)
    }

    const order = orders[index]
    if (order.status !== 'pending') {
      return sendError(res, '该订单已审核', 400)
    }

    const now = new Date().toISOString()
    if (action === 'approve') {
      order.status = 'approved'
      order.reviewedAt = now
      const commissions = await readCommissions()
      commissions.push({
        id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        orderId: order.id,
        userId: order.userId,
        managerId: order.managerId,
        productName: order.productName,
        amount: order.productPrice,
        status: 'pending',
        createdAt: now,
      })
      await writeCommissions(commissions)
    } else {
      order.status = 'rejected'
      order.rejectReason = reason || '推广无效'
      order.reviewedAt = now
      let products = await readProducts()
      const pIdx = products.findIndex((p: any) => p.id === order.productId)
      if (pIdx !== -1 && products[pIdx].stock >= 0) {
        products[pIdx].stock = (products[pIdx].stock || 0) + 1
        await writeProducts(products)
      }
    }

    orders[index] = order
    const { writeOrders } = await import('../data.js')
    await writeOrders(orders)

    sendSuccess(res, order, action === 'approve' ? '审核通过' : '已驳回')
  } catch (error: any) {
    console.error('[审核订单] 错误:', error)
    sendError(res, error.message || '操作失败', 500)
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

    let orders = await readOrders()
    const index = orders.findIndex((o: any) => o.id === orderId)
    if (index === -1) {
      return sendError(res, '订单不存在', 404)
    }

    const order = orders[index]

    if (action === 'pending_payment') {
      if (order.status !== 'approved') {
        return sendError(res, '仅已通过的订单可添加到待付款', 400)
      }
      order.status = 'pending_payment'
      order.addedToPaymentAt = new Date().toISOString()
    } else {
      if (order.status !== 'pending_payment') {
        return sendError(res, '仅待付款的订单可确认结算', 400)
      }
      order.status = 'settled'
      order.settledAt = new Date().toISOString()
      let commissions = await readCommissions()
      const cIdx = commissions.findIndex((c: any) => c.orderId === order.id)
      if (cIdx !== -1) {
        commissions[cIdx].status = 'paid'
        commissions[cIdx].paidAt = order.settledAt
        await writeCommissions(commissions)
      }
    }

    orders[index] = order
    const { writeOrders } = await import('../data.js')
    await writeOrders(orders)

    const msg = action === 'pending_payment' ? '已添加到待付款' : '已确认结算'
    sendSuccess(res, order, msg)
  } catch (error: any) {
    console.error('[结算订单] 错误:', error)
    sendError(res, error.message || '操作失败', 500)
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
      ? products.filter((p: any) => p.managerId === managerId)
      : products

    const totalProducts = myProducts.length
    const publishedProducts = myProducts.filter((p: any) => p.status === 'published').length

    const myProductIds = new Set(myProducts.map((p: any) => p.id))
    const myCommissions = managerId
      ? commissions.filter((c: any) => myProductIds.has(c.productId))
      : commissions

    const pendingCommissions = myCommissions
      .filter((c: any) => c.status === 'pending')
      .reduce((sum: number, c: any) => sum + (c.amount || 0), 0)

    const totalCommissions = myCommissions
      .filter((c: any) => c.status === 'paid')
      .reduce((sum: number, c: any) => sum + (c.amount || 0), 0)

    sendSuccess(res, {
      totalProducts,
      publishedProducts,
      pendingCommissions: Math.round(pendingCommissions * 100) / 100,
      totalCommissions: Math.round(totalCommissions * 100) / 100,
    })
  } catch (error: any) {
    console.error('[仪表盘统计] 错误:', error)
    sendError(res, error.message || '获取失败', 500)
  }
}
