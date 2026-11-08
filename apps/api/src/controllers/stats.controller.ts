import logger from '../utils/logger.js'
import { Request, Response } from 'express'
import { getErrorMessage, type OrderStats, type Product, type Commission } from '@promo/shared'
import { sendSuccess, sendError } from '../utils/response.js'
import type { OrderRow } from '../data-memory.js'
import {
  getOrderStats,
  readOrders,
  readProducts,
  readCommissions,
} from '../data/index.js'

// H15：生产环境禁止把数据库失败静默降级为内存数据
const allowMemoryFallback = process.env.NODE_ENV !== 'production'

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
      if (!allowMemoryFallback) throw dbError
      logger.warn('[订单统计] 数据库查询失败，尝试降级到内存:', { error: getErrorMessage(dbError) })
      const { getOrderStats: memGetOrderStats } = await import('../data-memory.js')
      stats = await memGetOrderStats(managerId as string)
    }

    if (userId || employeeId) {
      let orders: OrderRow[] = []
      try {
        orders = await readOrders()
      } catch (dbError2) {
        if (!allowMemoryFallback) throw dbError2
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
    // H15：生产环境禁止用全 0 伪装统计成功
    if (!allowMemoryFallback) {
      sendError(res, '获取统计失败', 500, 500)
      return
    }
    sendSuccess(res, { total: 0, pending: 0, approved: 0, pendingPayment: 0, settled: 0, rejected: 0 })
  }
}

/**
 * 获取经理仪表盘统计
 */
export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    // P1-7: 经理只能查看本人数据，忽略客户端传入的 managerId；管理员可筛选指定经理
    let managerId = req.query.managerId as string | undefined
    if (req.user?.role === 'manager') {
      managerId = req.user.id
    }
    const products = await readProducts()
    const commissions = await readCommissions()

    const myProducts = managerId
      ? products.filter((p: Product) => p.managerId === managerId)
      : products

    const totalProducts = myProducts.length
    const publishedProducts = myProducts.filter((p: Product) => p.status === 'published').length

    // H5：commissions 表无 productId 列，按 managerId 过滤；DECIMAL 返回字符串需转 Number
    const myCommissions = managerId
      ? commissions.filter((c: Commission) => c.managerId === managerId)
      : commissions

    const pendingCommissions = myCommissions
      .filter((c: Commission) => c.status === 'pending')
      .reduce((sum: number, c: Commission) => sum + (Number(c.amount) || 0), 0)

    const totalCommissions = myCommissions
      .filter((c: Commission) => c.status === 'paid')
      .reduce((sum: number, c: Commission) => sum + (Number(c.amount) || 0), 0)

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
