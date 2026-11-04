/**
 * OrderService - 订单业务逻辑层
 * 负责处理订单相关的所有业务逻辑，包括创建订单、审核、删除、恢复等
 */
import { injectable, inject } from 'tsyringe'
import {
  readProducts,
  readOrders,
  readEmployeeById,
  readUser,
  readOrder,
  readDeletedOrders,
  restoreOrder,
  purgeOrder,
  updateOrder,
  insertOrder,
  deleteOrder,
  getOrdersPaginated,
  readOrderUserOptions,
  readProduct,
  readCommissionByOrderId,
  updateCommission,
  applyOrderReview,
  updateOrderIfStatus,
  type OrderUserOption,
} from '../data/index.js'
import type { OrderRow } from '../data-memory.js'
import { query } from '../db.js'
import { DatabaseService } from './DatabaseService.js'
import { ErrorCode, throwNotFound, throwBadRequest, throwForbidden, CommissionStatus } from '@promo/shared'
import { formatMySQLDateTime } from '../data/utils.js'

export interface OrderListParams {
  page?: number
  pageSize?: number
  userId?: string
  managerId?: string
  employeeId?: string
  status?: string
  userPhone?: string
  teamName?: string
  keyword?: string
  managedBy?: string
}

export interface OrderCreateData {
  productId: string
  userId?: string
  employeeId?: string
  optionLabel?: string
  redirectUrl?: string
  userName?: string
  userPhone?: string
  sharerId?: string
}

export interface AdminDeleteInfo {
  reason?: string
  adminId?: string
  adminPhone?: string
  adminName?: string
}

export interface OrderReviewParams {
  action: 'approve' | 'reject'
  reason?: string
}

export interface OrderSettleParams {
  action: 'pending_payment' | 'paid'
}

export interface OrderService {
  getOrders(params: OrderListParams): Promise<{ list: OrderRow[]; total: number }>

  getOrderUserOptions(): Promise<OrderUserOption[]>

  createOrder(orderData: OrderCreateData): Promise<{ order: OrderRow; remainingStock: number }>

  adminDeleteOrder(orderId: string, adminInfo: AdminDeleteInfo): Promise<void>

  deleteUserOrder(orderId: string, userId: string): Promise<void>

  getDeletedOrders(userId: string): Promise<OrderRow[]>

  restoreOrder(orderId: string, userId: string): Promise<void>

  purgeOrder(orderId: string, userId: string): Promise<void>

  submitFundAccount(orderId: string, userId: string, fundAccount: string): Promise<void>

  reviewOrder(orderId: string, params: OrderReviewParams): Promise<OrderRow>

  settleOrder(orderId: string, params: OrderSettleParams): Promise<OrderRow>

  updateOrderTeamName(orderId: string, teamName: string): Promise<void>
}

@injectable()
export class OrderServiceImpl implements OrderService {
  constructor(
    @inject(DatabaseService) private db: DatabaseService
  ) {}

  async getOrders(params: OrderListParams) {
    const { page = 1, pageSize = 20, userId, managerId, employeeId, status, userPhone, teamName, keyword, managedBy } = params
    return await getOrdersPaginated({ page, pageSize, userId, managerId, employeeId, status, userPhone, teamName, keyword, managedBy })
  }

  async getOrderUserOptions() {
    return await readOrderUserOptions()
  }

  async createOrder(orderData: OrderCreateData) {
    const { productId, userId, employeeId, optionLabel, redirectUrl, userName, userPhone, sharerId } = orderData

    const products = await this.db.readProducts()
    const index = products.findIndex((p) => p.id === productId)
    if (index === -1) {
      throwNotFound('产品不存在', ErrorCode.PRODUCT_NOT_FOUND)
    }

    const product = products[index]

    if (product.status !== 'published') {
      throwBadRequest('该产品已下架')
    }

    // 业务规则：做单必须填写客户姓名和手机号（做单记录仅收录完整提交的订单）。
    // 在库存扣减之前校验，校验失败不消耗库存；接口直调/旧缓存客户端也无法绕过
    const cleanName = (userName || '').trim()
    if (!cleanName) {
      throwBadRequest('请填写姓名')
    }
    const cleanPhone = (userPhone || '').trim()
    if (!/^1[3-9]\d{9}$/.test(cleanPhone)) {
      throwBadRequest('请填写正确的手机号')
    }

    // P1-1: 使用乐观锁扣减库存，防止并发超卖
    // SQL 条件: WHERE stock > 0，确保不会扣成负数
    // 注意：db.ts 的 query() 返回 rows 本身（UPDATE 为 ResultSetHeader），不可数组解构
    let remainingStock: number
    if (product.stock && product.stock > 0) {
      const updateResult = (await query(
        'UPDATE products SET stock = stock - 1, updatedAt = NOW() WHERE id = ? AND stock > 0',
        [product.id]
      )) as { affectedRows?: number }
      if (!updateResult || updateResult.affectedRows === 0) {
        // 库存已被其他请求抢光
        throwBadRequest('库存不足，商品已被抢光', ErrorCode.INSUFFICIENT_STOCK)
      }
      remainingStock = (product.stock || 0) - 1
    } else {
      // 无库存限制或无限库存
      remainingStock = product.stock ?? -1
    }

    // P0-2: 强制使用服务端传入的 userId（来自 req.user.id 或分享归因）
    // 忽略客户端传入的 userId，防止业绩污染
    // 防御兜底：controller 已 401 拦截无归属请求，此处二次防线，严禁生成无归属订单
    if (!userId) {
      throwForbidden('订单缺少归属人，禁止创建')
    }
    let finalUserId = userId
    if (employeeId) {
      const employee = await readEmployeeById(employeeId)
      if (employee) {
        finalUserId = employee.userId
      }
    }

    const user = await readUser(finalUserId)
    const teamName = user?.teamName || ''

    const cleanRedirectUrl = (redirectUrl || '').replace(/`/g, '')

    const order: OrderRow = {
      id: `o_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      productId,
      userId: finalUserId,
      managerId: product.managerId as string,
      employeeId: employeeId || '',
      productName: product.title,
      productPrice: product.price,
      optionLabel: optionLabel || '',
      redirectUrl: cleanRedirectUrl,
      userName: cleanName,
      userPhone: cleanPhone,
      teamName,
      sharerId: sharerId || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    await insertOrder(order)

    return { order, remainingStock }
  }

  async adminDeleteOrder(orderId: string, _adminInfo: AdminDeleteInfo) {
    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }

    await deleteOrder(orderId)
  }

  async deleteUserOrder(orderId: string, userId: string) {
    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }

    if (order.userId !== userId) {
      throwForbidden('无权操作此订单')
    }

    await deleteOrder(orderId)
  }

  async getDeletedOrders(userId: string) {
    return await readDeletedOrders(userId)
  }

  async restoreOrder(orderId: string, userId: string) {
    const orders = await readDeletedOrders(userId)
    const order = orders.find((o) => o.id === orderId)

    if (!order) {
      throwNotFound('订单不存在或不在回收站')
    }

    if (order.userId !== userId) {
      throwForbidden('无权操作此订单')
    }

    await restoreOrder(orderId)
  }

  /** 永久删除订单（物理删除，仅限本人回收站中的订单，不可恢复） */
  async purgeOrder(orderId: string, userId: string) {
    const orders = await readDeletedOrders(userId)
    const order = orders.find((o) => o.id === orderId)

    if (!order) {
      throwNotFound('订单不存在或不在回收站')
    }

    if (order.userId !== userId) {
      throwForbidden('无权操作此订单')
    }

    await purgeOrder(orderId)
  }

  async submitFundAccount(orderId: string, userId: string, fundAccount: string) {
    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }

    if (order.userId !== userId) {
      throwForbidden('无权操作此订单')
    }

    await updateOrder(orderId, { fundAccount })
  }

  async reviewOrder(orderId: string, params: OrderReviewParams): Promise<OrderRow> {
    const { action, reason } = params
    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }

    if (order.status !== 'pending') {
      throwBadRequest('该订单已审核')
    }

    const nowMySQL = formatMySQLDateTime(new Date())!

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
    } else if (action === 'reject') {
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
    } else {
      throwBadRequest('无效的审核操作')
    }

    if (!updated) {
      // 并发下订单已被审核
      throwBadRequest('该订单已审核')
    }

    return {
      ...order,
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewedAt: nowMySQL,
      ...(action === 'reject' ? { rejectReason: reason || '推广无效' } : {}),
    }
  }

  async settleOrder(orderId: string, params: OrderSettleParams): Promise<OrderRow> {
    const { action } = params
    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }

    const nowMySQL = formatMySQLDateTime(new Date())!

    if (action === 'pending_payment') {
      if (order.status !== 'approved') {
        throwBadRequest('仅已通过的订单可添加到待付款')
      }
      const updated = await updateOrderIfStatus(orderId, { status: 'pending_payment', addedToPaymentAt: nowMySQL }, 'approved')
      if (!updated) {
        throwBadRequest('订单状态已变化，请刷新后重试')
      }
      return { ...order, status: 'pending_payment', addedToPaymentAt: nowMySQL }
    } else if (action === 'paid') {
      if (order.status !== 'pending_payment') {
        throwBadRequest('仅待付款的订单可确认结算')
      }
      const updated = await updateOrderIfStatus(orderId, { status: 'settled', settledAt: nowMySQL }, 'pending_payment')
      if (!updated) {
        throwBadRequest('订单状态已变化，请刷新后重试')
      }
      const commission = await readCommissionByOrderId(orderId)
      if (commission) {
        await updateCommission(commission.id, { status: CommissionStatus.PAID, paidAt: nowMySQL })
      }
      return { ...order, status: 'settled', settledAt: nowMySQL }
    } else {
      throwBadRequest('无效的结算操作')
    }
  }

  async updateOrderTeamName(orderId: string, teamName: string): Promise<void> {
    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }
    await updateOrder(orderId, { teamName })
  }
}

const db: DatabaseService = {
  readProducts,
  readOrders,
  readUsers: async () => [],
  writeUsers: async () => {},
  writeProducts: async () => {},
  readEmployees: async () => [],
  writeEmployees: async () => {},
  writeOrders: async () => {},
  readCommissions: async () => [],
  writeCommissions: async () => {},
  readManagers: async () => [],
  writeManagers: async () => {},
}

export const orderService: OrderService = new OrderServiceImpl(db)