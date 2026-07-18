import { Request, Response } from 'express'
import { sendSuccess, sendError, sendPagination } from '../utils/response.js'
import { orderService } from '../services/index.js'
import { insertOperationLog } from '../data/index.js'

/**
 * 做单（创建订单）
 * 验证产品存在性和状态，检查库存，扣减库存，创建订单记录
 * 支持用户做单和员工代做单两种模式
 * 
 * 安全设计：
 * - userId 不从客户端 body 取，强制使用 req.user.id（已认证用户）
 * - employeeId 仅当登录身份为 employee 时使用，其他角色传入将被忽略
 * - 防止用户伪造 userId 偷取他人业绩
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

    // P0-2: 强制使用 req.user.id 作为用户身份，忽略客户端传入的 userId/employeeId
    const currentUser = (req as any).user
    if (!currentUser || !currentUser.id) {
      return sendError(res, '未登录', 401)
    }

    // 根据登录角色确定 userId 和 employeeId
    let realUserId: string | undefined
    let realEmployeeId: string | undefined

    if (currentUser.role === 'employee') {
      // 员工代做单：使用员工关联的 userId
      realEmployeeId = currentUser.id
      realUserId = currentUser.userId  // 员工关联的真实用户ID
      if (!realUserId) {
        return sendError(res, '员工账户未关联用户，无法做单', 403)
      }
    } else if (currentUser.role === 'user' || currentUser.role === 'manager' || currentUser.role === 'admin') {
      // 普通用户/经理/管理员做单
      realUserId = currentUser.id
    } else {
      return sendError(res, '不支持的用户角色', 403)
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
  } catch (error: any) {
    sendError(res, error.message || '做单失败', error.code || 500)
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

    // P1-7: 根据登录角色强制覆盖查询参数，防止越权访问他人订单
    const currentUser = (req as any).user
    if (!currentUser || !currentUser.id) {
      return sendError(res, '未登录', 401)
    }

    let queryUserId: string | undefined
    let queryManagerId: string | undefined
    let queryEmployeeId: string | undefined

    if (currentUser.role === 'admin') {
      // 管理员：可查询所有订单，支持手动筛选
      queryUserId = req.query.userId as string | undefined
      queryManagerId = req.query.managerId as string | undefined
      queryEmployeeId = req.query.employeeId as string | undefined
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

    let result: { list: any[]; total: number }
    try {
      result = await orderService.getOrders({
        userId: queryUserId,
        managerId: queryManagerId,
        employeeId: queryEmployeeId,
        status: status as string,
        managedBy: managedBy as string,
        keyword: keyword as string,
        page: pageNum,
        pageSize: pageSizeNum,
      })
    } catch (dbError: any) {
      console.warn('[获取订单] 数据库查询失败，尝试降级到内存:', dbError)
      const { getOrdersPaginated } = await import('../data-memory.js')
      result = await getOrdersPaginated({
        userId: queryUserId,
        managerId: queryManagerId,
        employeeId: queryEmployeeId,
        status: status as string,
        managedBy: managedBy as string,
        keyword: keyword as string,
        page: pageNum,
        pageSize: pageSizeNum,
      })
    }

    sendPagination(res, result.list, result.total, pageNum, pageSizeNum)
  } catch (error: any) {
    console.error('[获取订单] 错误:', error)
    sendError(res, error.message || '获取失败', 500)
  }
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
    const { reason, adminId, adminPhone, adminName } = req.body

    await orderService.adminDeleteOrder(orderId, { reason, adminId, adminPhone, adminName })

    // 记录操作日志
    await insertOperationLog({
      adminId: adminId || '',
      adminPhone: adminPhone || '',
      adminName: adminName || '未知管理员',
      operationType: 'delete',
      targetType: 'order',
      targetId: orderId,
      targetName: '订单',
      reason: reason || '',
      detail: '',
    })

    sendSuccess(res, null, '删除成功')
  } catch (error: any) {
    sendError(res, error.message || '删除失败', error.code || 500)
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
    const { userId } = req.body

    await orderService.deleteUserOrder(id, userId)

    sendSuccess(res, null, '已移至回收站')
  } catch (error: any) {
    sendError(res, error.message || '删除失败', error.code || 500)
  }
}

/**
 * 获取用户已删除的订单（回收站）
 * 查询指定用户的回收站订单列表
 * @param req - HTTP请求对象，包含用户ID（req.query.userId）
 * @param res - HTTP响应对象
 * @returns 回收站订单列表
 */
export const getDeletedOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.query
    const orders = await orderService.getDeletedOrders(userId as string)
    sendSuccess(res, orders)
  } catch (error: any) {
    sendError(res, error.message || '获取失败', error.code || 500)
  }
}

/**
 * 恢复订单（从回收站找回）
 * 验证订单归属权限，将订单从回收站恢复到正常状态
 * @param req - HTTP请求对象，包含订单ID（req.params.id）和用户ID（req.body.userId）
 * @param res - HTTP响应对象
 * @returns 恢复操作结果
 */
export const restoreUserOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string
    const { userId } = req.body

    await orderService.restoreOrder(id, userId)

    sendSuccess(res, null, '恢复成功')
  } catch (error: any) {
    sendError(res, error.message || '恢复失败', error.code || 500)
  }
}

/**
 * 提交资金号
 * 用户为订单提交资金账户信息，用于资金追踪
 * @param req - HTTP请求对象，包含用户ID、订单ID和资金号
 * @param res - HTTP响应对象
 * @returns 提交结果
 */
export const submitFundAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, orderId, fundAccount } = req.body

    if (!userId || !orderId || !fundAccount) {
      return sendError(res, '缺少必要参数', 400)
    }

    await orderService.submitFundAccount(orderId, userId, fundAccount)

    sendSuccess(res, null, '提交成功')
  } catch (error: any) {
    sendError(res, error.message || '提交失败', error.code || 500)
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

    await orderService.reviewOrder(orderId, { action, reason })

    const message = action === 'approve' ? '审核通过' : '已驳回'
    sendSuccess(res, null, message)
  } catch (error: any) {
    sendError(res, error.message || '审核失败', error.code || 500)
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

    await orderService.settleOrder(orderId, { action })

    const message = action === 'pending_payment' ? '已添加到待发放' : '已结算'
    sendSuccess(res, null, message)
  } catch (error: any) {
    sendError(res, error.message || '结算失败', error.code || 500)
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

    await orderService.updateOrderTeamName(orderId, teamName)

    sendSuccess(res, null, '团队名称更新成功')
  } catch (error: any) {
    sendError(res, error.message || '更新失败', error.code || 500)
  }
}
