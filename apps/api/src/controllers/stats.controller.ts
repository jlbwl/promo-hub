import logger from '../utils/logger.js'
import { Request, Response } from 'express'
import { getErrorMessage, type OrderStats } from '@promo/shared'
import { sendSuccess, sendError } from '../utils/response.js'
import type { OrderRow } from '../data-memory.js'
import { queryOne } from '../db.js'
import {
  getOrderStats,
  getUserOrderStats,
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

    // P1-7 / M9: 按登录角色强制覆盖查询身份，并清空低优先级参数，防止越权读取他人聚合
    if (currentUser?.role === 'user') {
      userId = currentUser.id
      employeeId = undefined
    } else if (currentUser?.role === 'manager') {
      managerId = currentUser.id
      userId = undefined
    } else if (currentUser?.role === 'employee') {
      employeeId = currentUser.id
      userId = undefined
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
      try {
        // M26：用户/员工维度直接走聚合 SQL，不再读取全表后在内存过滤
        stats = await getUserOrderStats(userId || '', employeeId)
      } catch (dbError2) {
        if (!allowMemoryFallback) throw dbError2
        logger.warn('[订单统计] 聚合查询失败，尝试降级:', { error: getErrorMessage(dbError2) })
        const { readOrders: memReadOrders } = await import('../data-memory.js')
        const orders: OrderRow[] = await memReadOrders()
        const filtered = orders.filter((o: OrderRow) => (employeeId ? o.employeeId === employeeId : o.userId === userId))
        stats = {
          total: filtered.length,
          pending: filtered.filter((o) => o.status === 'pending').length,
          approved: filtered.filter((o) => o.status === 'approved').length,
          pendingPayment: filtered.filter((o) => o.status === 'pending_payment').length,
          settled: filtered.filter((o) => o.status === 'settled').length,
          settledAmount: filtered
            .filter((o) => o.status === 'settled')
            .reduce((sum, o) => sum + (Number(o.productPrice) || 0), 0),
          rejected: filtered.filter((o) => o.status === 'rejected').length,
        }
      }
    }

    sendSuccess(res, stats)
  } catch (error) {
    logger.error('[订单统计] 最终错误:', { error: getErrorMessage(error) })
    // H15：生产环境禁止用全 0 伪装统计成功
    if (!allowMemoryFallback) {
      sendError(res, '获取统计失败', 500, 500)
      return
    }
    sendSuccess(res, { total: 0, pending: 0, approved: 0, pendingPayment: 0, settled: 0, settledAmount: 0, rejected: 0 })
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
    // M26：仪表盘统计改为聚合 SQL，避免每次请求读取 products/commissions 全表
    const productSql = managerId
      ? 'SELECT COUNT(*) AS total, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS published FROM products WHERE managerId = ?'
      : 'SELECT COUNT(*) AS total, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS published FROM products'
    const productStats = await queryOne<{ total?: number | string; published?: number | string }>(
      productSql,
      managerId ? ['published', managerId] : ['published']
    )

    // M13：已发放口径按订单 settled 汇总（佣金表仅作发放流水）；待发放仍取佣金 pending
    const pendingSql = managerId
      ? `SELECT SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pending FROM commissions WHERE managerId = ?`
      : `SELECT SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pending FROM commissions`
    const pendingStats = await queryOne<{ pending?: number | string }>(
      pendingSql,
      managerId ? [managerId] : []
    )

    const settledSql = managerId
      ? "SELECT SUM(productPrice) AS settled FROM orders WHERE deleted = 0 AND status = 'settled' AND managerId = ?"
      : "SELECT SUM(productPrice) AS settled FROM orders WHERE deleted = 0 AND status = 'settled'"
    const settledStats = await queryOne<{ settled?: number | string }>(
      settledSql,
      managerId ? [managerId] : []
    )

    const pendingCommissions = Number(pendingStats?.pending) || 0
    const totalCommissions = Number(settledStats?.settled) || 0

    sendSuccess(res, {
      totalProducts: Number(productStats?.total) || 0,
      publishedProducts: Number(productStats?.published) || 0,
      pendingCommissions: Math.round(pendingCommissions * 100) / 100,
      totalCommissions: Math.round(totalCommissions * 100) / 100,
    })
  } catch (error) {
    logger.error('[仪表盘统计] 错误:', { error: getErrorMessage(error) })
    sendError(res, getErrorMessage(error, '获取失败'), 500)
  }
}
