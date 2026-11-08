import logger from '../utils/logger.js'
import { Request, Response } from 'express'
import { getErrorMessage } from '@promo/shared'
import { sendSuccess, sendError, sendPagination } from '../utils/response.js'
import { MAX_PAGE_SIZE } from '../utils/pagination.js'
import { orderService } from '../services/index.js'
import { logAdminOperation } from '../utils/auditLog.js'
import { buildAuditDetail, maskPhone } from '../utils/auditDetail.js'
import { readUser } from '../data/index.js'
import type { OrderRow } from '../data-memory.js'

/**
 * 解析订单归属的用户ID（用于用户端订单操作）：
 * - user/manager/admin：归属当前登录人（req.user.id）
 * - employee：归属其关联的主账户（req.user.userId）
 * 一律以会话身份为准，忽略请求体/查询中的 userId，防止越权操作他人订单。
 */
function resolveOrderUserId(req: Request): string | undefined {
  const u = req.user
  if (!u || !u.id) return undefined
  if (u.role === 'employee') return u.userId
  return u.id
}

/**
 * 做单（创建订单）—— 代客下单模式
 * 验证产品存在性和状态，检查库存，扣减库存，创建订单记录
 *
 * 归属规则（业绩归属唯一且由服务端裁决）：
 * - 登录推广人员（user/manager/admin）：userId 强制 = req.user.id（当前登录的推广人员）
 * - 员工子账号代做单：userId = 关联的主用户，employeeId = 员工本人
 * - 访客：仅当携带 sharerId（分享链接归因）时允许，业绩归属分享的推广人员
 * - 无任何归属依据：401 拒绝，严禁生成无归属订单
 *
 * 安全设计：
 * - 严禁使用前端传来的手机号（userPhone）匹配或推断用户ID
 * - 忽略客户端传入的任何 userId，防止业绩污染
 * - 前端传来的 name/phone 是终端客户信息，仅作为 userName/userPhone 落库
 *
 * @param req - HTTP请求对象，包含产品ID、产品选项等信息
 * @param res - HTTP响应对象
 * @returns 订单信息及剩余库存
 */
export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, optionLabel, redirectUrl, userName, userPhone, sharerId } = req.body

    if (!productId) {
      return sendError(res, '缺少产品ID', 400)
    }

    // H12：对齐数据库列宽做长度/类型校验，避免超长字段写入失败或截断
    if (sharerId !== undefined && sharerId !== null) {
      if (typeof sharerId !== 'string' || sharerId.length > 100) {
        return sendError(res, '分享人ID格式不正确', 400)
      }
    }
    if (optionLabel !== undefined && optionLabel !== null) {
      if (typeof optionLabel !== 'string' || optionLabel.length > 500) {
        return sendError(res, '产品选项过长', 400)
      }
    }
    if (redirectUrl !== undefined && redirectUrl !== null) {
      if (typeof redirectUrl !== 'string' || redirectUrl.length > 2000) {
        return sendError(res, '跳转链接过长', 400)
      }
    }
    if (userName !== undefined && userName !== null) {
      if (typeof userName !== 'string' || userName.length > 200) {
        return sendError(res, '客户姓名过长', 400)
      }
    }

    // 归属裁决：userId 一律由服务端按登录态/分享归因生成，绝不取自请求体
    const currentUser = req.user
    let realUserId: string | undefined
    let realEmployeeId: string | undefined

    if (currentUser && currentUser.id) {
      if (currentUser.role === 'employee') {
        // 员工代做单：业绩归属员工关联的主用户
        realEmployeeId = currentUser.id
        realUserId = currentUser.userId
        if (!realUserId) {
          return sendError(res, '员工账户未关联用户，无法做单', 403)
        }
      } else if (currentUser.role === 'manager') {
        // H10：经理账号不得做单，避免“自建产品 → 自做单 → 自审 → 自打款”闭环
        return sendError(res, '经理账号不可直接做单，请使用推广人员账号下单', 403)
      } else if (currentUser.role === 'user' || currentUser.role === 'admin') {
        // 推广人员做单：业绩强制归属当前登录人
        realUserId = currentUser.id
      } else {
        return sendError(res, '不支持的用户角色', 403)
      }
    } else if (sharerId) {
      // 访客 + 分享链接：归属分享的推广人员（H12：分享人必须真实存在且启用）
      const sharer = await readUser(sharerId)
      if (!sharer || sharer.status !== 'active') {
        return sendError(res, '分享人不存在或已失效', 400)
      }
      realUserId = sharerId
    } else {
      // 无归属人不允许下单
      return sendError(res, '请先登录后再下单', 401)
    }

    const { order, remainingStock } = await orderService.createOrder({
      productId,
      userId: realUserId,
      employeeId: realEmployeeId,
      optionLabel,
      redirectUrl,
      userName,
      userPhone,
      sharerId,
    })

    sendSuccess(res, { order, remainingStock }, '做单成功')
  } catch (error) {
    sendError(res, getErrorMessage(error, '做单失败'), (error as { code?: number }).code || 500)
  }
}

/**
 * 获取订单列表
 * 支持分页、用户筛选、经理筛选、员工筛选、状态筛选和管理类型筛选
 * 使用数据库级别的分页和筛选优化性能
 * 
 * 安全设计（P1-7）：
 * - user 角色：强制 userId = req.user.id，只能查自己的订单
 * - employee 角色：强制 userId = req.user.userId，只能查所属用户的订单
 * - manager 角色：强制 managerId = req.user.id，只能查自己团队的订单
 * - admin 角色：无限制，可查询所有订单
 * 
 * @param req - HTTP请求对象，包含查询参数（page, pageSize, status, keyword）
 * @param res - HTTP响应对象
 * @returns 分页的订单列表和总数
 */
export const getOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, page = '1', pageSize = '20', keyword, managedBy } = req.query

    const pageNum = parseInt(page as string, 10)
    const pageSizeNum = parseInt(pageSize as string, 10)

    if (isNaN(pageNum) || pageNum < 1) {
      return sendError(res, 'page参数无效', 400)
    }
    if (isNaN(pageSizeNum) || pageSizeNum < 1) {
      return sendError(res, 'pageSize参数无效', 400)
    }
    // 单页条数收敛到上限，避免导出/列表类请求放大内存
    const clampedPageSize = Math.min(pageSizeNum, MAX_PAGE_SIZE)

    // P1-7: 根据登录角色强制覆盖查询参数，防止越权访问他人订单
    const currentUser = req.user
    if (!currentUser || !currentUser.id) {
      return sendError(res, '未登录', 401)
    }

    let queryUserId: string | undefined
    let queryManagerId: string | undefined
    let queryEmployeeId: string | undefined
    let queryUserPhone: string | undefined
    let queryTeamName: string | undefined

    if (currentUser.role === 'admin') {
      // 管理员：可查询所有订单，支持手动筛选
      queryUserId = req.query.userId as string | undefined
      queryManagerId = req.query.managerId as string | undefined
      queryEmployeeId = req.query.employeeId as string | undefined
      queryUserPhone = req.query.userPhone as string | undefined
      queryTeamName = req.query.teamName as string | undefined
    } else if (currentUser.role === 'manager') {
      // 经理：强制只查自己团队的订单，忽略客户端传入的 userId/managerId
      queryManagerId = currentUser.id
    } else if (currentUser.role === 'employee') {
      // 员工：强制只查所属用户的订单
      if (!currentUser.userId) {
        return sendError(res, '员工账户未关联用户', 403)
      }
      queryUserId = currentUser.userId
      queryEmployeeId = currentUser.id
    } else if (currentUser.role === 'user') {
      // 普通用户：强制只查自己的订单
      queryUserId = currentUser.id
    } else {
      return sendError(res, '不支持的用户角色', 403)
    }

    let result: { list: OrderRow[]; total: number }
    try {
      result = await orderService.getOrders({
        userId: queryUserId,
        managerId: queryManagerId,
        employeeId: queryEmployeeId,
        status: status as string,
        userPhone: queryUserPhone,
        teamName: queryTeamName,
        keyword: keyword as string,
        managedBy: managedBy as string,
        page: pageNum,
        pageSize: clampedPageSize,
      })
    } catch (dbError) {
      logger.warn('[获取订单] 数据库查询失败，尝试降级到内存:', { error: getErrorMessage(dbError) })
      const { getOrdersPaginated } = await import('../data-memory.js')
      result = await getOrdersPaginated({
        userId: queryUserId,
        managerId: queryManagerId,
        employeeId: queryEmployeeId,
        status: status as string,
        userPhone: queryUserPhone,
        teamName: queryTeamName,
        keyword: keyword as string,
        managedBy: managedBy as string,
        page: pageNum,
        pageSize: clampedPageSize,
      })
    }

    sendPagination(res, result.list, result.total, pageNum, clampedPageSize)
  } catch (error) {
    logger.error('[获取订单] 错误:', { error: getErrorMessage(error) })
    sendError(res, getErrorMessage(error, '获取失败'), 500)
  }
}

/**
 * 获取订单中"用户+团队名称"去重组合（管理员筛选用户下拉选项）
 */
export const getOrderUserOptions = async (_req: Request, res: Response): Promise<void> => {
  try {
    const list = await orderService.getOrderUserOptions()
    sendSuccess(res, list, 'success')
  } catch (error) {
    logger.error('[获取用户选项] 错误:', { error: getErrorMessage(error) })
    sendError(res, getErrorMessage(error, '获取失败'), 500)
  }
}

/** 订单状态文案，用于审计日志中的可读展示 */
const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  pending_payment: '待发放',
  settled: '已发放',
  rejected: '已驳回',
}

/**
 * 管理后台删除订单
 * 管理员可删除任意订单，记录操作日志
 * @param req - HTTP请求对象，包含订单ID（req.params.id）和删除原因
 * @param res - HTTP响应对象
 * @returns 删除操作结果
 */
export const adminDeleteOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = req.params.id as string
    // 操作人身份只取服务端会话，禁止信任请求体里的 adminId/adminPhone/adminName
    const { reason } = req.body

    const order = await orderService.adminDeleteOrder(orderId)

    // 日志需可定位到具体订单：写入客户、产品与金额，而不是固定字符串「订单」
    // 客户手机号落库即脱敏，避免审计日志暴露完整号码
    const customer = order.userName || (order.userPhone ? maskPhone(order.userPhone) : '') || '未知客户'
    const amount = `¥${Number(order.productPrice || 0).toFixed(2)}`
    const targetName = `${customer} · ${order.productName || '未命名产品'} · ${amount}`

    // detail 统一存结构化 JSON，前端按 summary/meta 渲染，兼容后续扩展 changes
    const detail = buildAuditDetail({
      summary: `删除订单 ${order.id}（客户：${customer}，产品：${order.productName || '-'}，金额：${amount}）`,
      meta: {
        订单号: order.id,
        客户: customer,
        客户手机号: maskPhone(order.userPhone),
        产品: order.productName || '-',
        金额: amount,
        原状态: ORDER_STATUS_LABELS[order.status] || order.status,
        所属团队: order.teamName || '-',
      },
    })

    await logAdminOperation(req, {
      operationType: 'delete',
      targetType: 'order',
      targetId: order.id,
      targetName,
      reason: reason || '',
      detail,
    })

    sendSuccess(res, null, '删除成功')
  } catch (error) {
    sendError(res, getErrorMessage(error, '删除失败'), (error as { code?: number }).code || 500)
  }
}

/**
 * 用户端删除订单（软删除）
 * 验证订单归属权限，将订单移入回收站
 * @param req - HTTP请求对象，包含订单ID（req.params.id）和用户ID（req.body.userId）
 * @param res - HTTP响应对象
 * @returns 删除操作结果
 */
export const deleteUserOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string
    const userId = resolveOrderUserId(req)
    if (!userId) {
      return sendError(res, '未登录或会话已过期', 401)
    }

    await orderService.deleteUserOrder(id, userId)

    // M3：删除动作留痕（软删除可从回收站恢复，仍需可追溯）
    await logAdminOperation(req, {
      operationType: 'delete',
      targetType: 'order',
      targetId: id,
      targetName: `订单 ${id}`,
      detail: '用户将订单移入回收站（软删除）',
    })

    sendSuccess(res, null, '已移至回收站')
  } catch (error) {
    sendError(res, getErrorMessage(error, '删除失败'), (error as { code?: number }).code || 500)
  }
}

/**
 * 获取用户已删除的订单（回收站）
 * 仅返回当前登录用户（或员工所属主账户）的回收站订单
 */
export const getDeletedOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = resolveOrderUserId(req)
    if (!userId) {
      return sendError(res, '未登录或会话已过期', 401)
    }
    const orders = await orderService.getDeletedOrders(userId)
    sendSuccess(res, orders)
  } catch (error) {
    sendError(res, getErrorMessage(error, '获取失败'), (error as { code?: number }).code || 500)
  }
}

/**
 * 恢复订单（从回收站找回）
 */
export const restoreUserOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string
    const userId = resolveOrderUserId(req)
    if (!userId) {
      return sendError(res, '未登录或会话已过期', 401)
    }

    await orderService.restoreOrder(id, userId)

    sendSuccess(res, null, '恢复成功')
  } catch (error) {
    sendError(res, getErrorMessage(error, '恢复失败'), (error as { code?: number }).code || 500)
  }
}

/**
 * 永久删除订单（物理删除，不可恢复）
 * 仅允许订单归属人删除其回收站中的订单，身份以登录态为准
 */
export const purgeUserOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string
    const userId = resolveOrderUserId(req)
    if (!userId) {
      return sendError(res, '未登录或会话已过期', 401)
    }

    await orderService.purgeOrder(id, userId)

    // M3：物理删除不可恢复，必须留痕
    await logAdminOperation(req, {
      operationType: 'delete',
      targetType: 'order',
      targetId: id,
      targetName: `订单 ${id}`,
      detail: '用户永久删除回收站订单（物理删除）',
    })

    sendSuccess(res, null, '已永久删除')
  } catch (error) {
    sendError(res, getErrorMessage(error, '删除失败'), (error as { code?: number }).code || 500)
  }
}

/**
 * 提交资金号
 * 用户为订单提交资金账户信息，用于资金追踪。userId 以登录态为准。
 */
export const submitFundAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = resolveOrderUserId(req)
    const { orderId, fundAccount } = req.body

    if (!userId || !orderId || !fundAccount) {
      return sendError(res, '缺少必要参数', 400)
    }

    await orderService.submitFundAccount(orderId, userId, fundAccount)

    sendSuccess(res, null, '提交成功')
  } catch (error) {
    sendError(res, getErrorMessage(error, '提交失败'), (error as { code?: number }).code || 500)
  }
}

/**
 * 订单审核（通过/驳回）
 * 渠道经理审核订单，决定是否通过或驳回
 * @param req - HTTP请求对象，包含订单ID（req.params.id）和审核参数（action, reason）
 * @param res - HTTP响应对象
 * @returns 审核结果
 */
export const reviewOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = req.params.id as string
    const { action, reason } = req.body

    if (!action || (action !== 'approve' && action !== 'reject')) {
      return sendError(res, '无效的审核操作', 400)
    }

    // 归属校验：经理只能操作本团队订单（service 层依据 operator 判定）
    const order = await orderService.reviewOrder(orderId, {
      action,
      reason,
      // M1：前端人工确认重单后带 force=true 重发
      force: req.body?.force === true,
      ...(req.user ? { operator: { id: req.user.id, role: req.user.role } } : {}),
    })

    // M3：资金相关动作必须留审计轨迹（谁、何时、对哪一单、批/驳原因）
    const customer = order.userName || (order.userPhone ? maskPhone(order.userPhone) : '') || '未知客户'
    const amount = `¥${Number(order.productPrice || 0).toFixed(2)}`
    await logAdminOperation(req, {
      operationType: 'update',
      targetType: 'order',
      targetId: order.id,
      targetName: `${customer} · ${order.productName || '未命名产品'} · ${amount}`,
      reason: action === 'reject' ? (reason || '推广无效') : '',
      detail: buildAuditDetail({
        summary: `${action === 'approve' ? '审核通过' : '订单驳回'} ${order.id}`,
        meta: {
          订单号: order.id,
          客户: customer,
          产品: order.productName || '-',
          金额: amount,
          审核结果: action === 'approve' ? '通过' : '驳回',
          ...(action === 'reject' ? { 驳回原因: reason || '推广无效' } : {}),
        },
      }),
    })

    const message = action === 'approve' ? '审核通过' : '已驳回'
    sendSuccess(res, null, message)
  } catch (error) {
    // M1：409 时把冲突订单摘要一并返回，前端据此二次确认
    const err = error as { code?: number; data?: unknown }
    sendError(res, getErrorMessage(error, '审核失败'), err.code || 500, undefined, err.data ?? null)
  }
}

/**
 * 订单结算（添加到待发放/已付款）
 * 渠道经理将订单添加到待发放列表，或标记为已付款
 * @param req - HTTP请求对象，包含订单ID（req.params.id）和结算参数（action）
 * @param res - HTTP响应对象
 * @returns 结算结果
 */
export const settleOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = req.params.id as string
    const { action } = req.body

    if (!action || (action !== 'pending_payment' && action !== 'paid')) {
      return sendError(res, '无效的结算操作', 400)
    }

    // 归属校验：经理只能操作本团队订单（service 层依据 operator 判定）
    const order = await orderService.settleOrder(orderId, {
      action,
      ...(req.user ? { operator: { id: req.user.id, role: req.user.role } } : {}),
    })

    // M3：结算/待发放同样涉及资金状态流转，必须留审计轨迹
    const customer = order.userName || (order.userPhone ? maskPhone(order.userPhone) : '') || '未知客户'
    const amount = `¥${Number(order.productPrice || 0).toFixed(2)}`
    await logAdminOperation(req, {
      operationType: 'update',
      targetType: 'order',
      targetId: order.id,
      targetName: `${customer} · ${order.productName || '未命名产品'} · ${amount}`,
      detail: buildAuditDetail({
        summary: `${action === 'pending_payment' ? '加入待发放' : '确认结算'} ${order.id}`,
        meta: {
          订单号: order.id,
          客户: customer,
          产品: order.productName || '-',
          金额: amount,
          结算动作: action === 'pending_payment' ? '加入待发放' : '确认结算',
        },
      }),
    })

    const message = action === 'pending_payment' ? '已添加到待发放' : '已结算'
    sendSuccess(res, null, message)
  } catch (error) {
    sendError(res, getErrorMessage(error, '结算失败'), (error as { code?: number }).code || 500)
  }
}

/**
 * 更新订单团队名称
 * 管理员可手动修改订单的团队名称
 * @param req - HTTP请求对象，包含订单ID（req.params.id）和团队名称（req.body.teamName）
 * @param res - HTTP响应对象
 * @returns 更新结果
 */
export const updateOrderTeamName = async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = req.params.id as string
    const { teamName } = req.body

    const order = await orderService.updateOrderTeamName(orderId, teamName)

    // 记录团队名称变更：旧值来自更新前的订单快照
    const customer = order.userName || (order.userPhone ? maskPhone(order.userPhone) : '') || '未知客户'
    await logAdminOperation(req, {
      operationType: 'update',
      targetType: 'order',
      targetId: order.id,
      targetName: `${customer} · ${order.productName || '未命名产品'}`,
      detail: buildAuditDetail({
        summary: `订单团队名称：${order.teamName || '-'} → ${teamName || '-'}`,
        meta: {
          订单号: order.id,
          客户: customer,
          产品: order.productName || '-',
        },
        changes: [
          { field: 'teamName', label: '团队名称', from: order.teamName, to: teamName },
        ],
      }),
    })

    sendSuccess(res, null, '团队名称更新成功')
  } catch (error) {
    sendError(res, getErrorMessage(error, '更新失败'), (error as { code?: number }).code || 500)
  }
}
