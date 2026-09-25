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
  updateOrder,
  insertOrder,
  deleteOrder,
  getOrdersPaginated,
  readOrderUserOptions,
  type OrderUserOption,
} from '../data/index.js'
import type { OrderRow } from '../data-memory.js'
import { query } from '../db.js'
import { DatabaseService } from './DatabaseService.js'
import { ErrorCode, throwNotFound, throwBadRequest, throwForbidden } from '@promo/shared'

export interface OrderListParams {
  page?: number
  pageSize?: number
  userId?: string
  /** 与 userId 之间为 OR 关系：用户端按本人手机号关联注册前的访客做单 */
  matchUserPhone?: string
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

  submitFundAccount(orderId: string, userId: string, fundAccount: string): Promise<void>

  reviewOrder(orderId: string, params: OrderReviewParams): Promise<void>

  settleOrder(orderId: string, params: OrderSettleParams): Promise<void>

  updateOrderTeamName(orderId: string, teamName: string): Promise<void>
}

@injectable()
export class OrderServiceImpl implements OrderService {
  constructor(
    @inject(DatabaseService) private db: DatabaseService
  ) {}

  async getOrders(params: OrderListParams) {
    const { page = 1, pageSize = 20, userId, matchUserPhone, managerId, employeeId, status, userPhone, teamName, keyword, managedBy } = params
    return await getOrdersPaginated({ page, pageSize, userId, matchUserPhone, managerId, employeeId, status, userPhone, teamName, keyword, managedBy })
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

    // P1-1: 使用乐观锁扣减库存，防止并发超卖
    // SQL 条件: WHERE stock > 0，确保不会扣成负数
    let remainingStock: number
    if (product.stock && product.stock > 0) {
      const [updateResult] = (await query(
        'UPDATE products SET stock = stock - 1, updatedAt = NOW() WHERE id = ? AND stock > 0',
        [product.id]
      )) as { affectedRows?: number }[]
      if (!updateResult || updateResult.affectedRows === 0) {
        // 库存已被其他请求抢光
        throwBadRequest('库存不足，商品已被抢光', ErrorCode.INSUFFICIENT_STOCK)
      }
      remainingStock = (product.stock || 0) - 1
    } else {
      // 无库存限制或无限库存
      remainingStock = product.stock ?? -1
    }

    // P0-2: 强制使用服务端传入的 userId（来自 req.user.id）
    // 忽略客户端传入的 userId，防止业绩污染
    let finalUserId = userId || 'guest'
    if (employeeId) {
      const employee = await readEmployeeById(employeeId)
      if (employee) {
        finalUserId = employee.userId
      }
    }

    if (sharerId && finalUserId === 'guest') {
      finalUserId = sharerId
    }

    let teamName = ''
    if (finalUserId !== 'guest') {
      const user = await readUser(finalUserId)
      if (user) {
        teamName = user.teamName || ''
      }
    }

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
      userName: userName || '',
      userPhone: userPhone || '',
      teamName,
      sharerId: sharerId || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    await insertOrder(order)

    return { order, remainingStock }
  }

  async adminDeleteOrder(orderId: string, adminInfo: AdminDeleteInfo) {
    const { reason } = adminInfo

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

  async reviewOrder(orderId: string, params: OrderReviewParams) {
    const { action, reason } = params
    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }

    if (order.status !== 'pending') {
      throwBadRequest('订单状态不允许审核操作')
    }

    const now = new Date()
    const mysqlDateTime = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0')

    if (action === 'approve') {
      await updateOrder(orderId, { status: 'approved', reviewedAt: mysqlDateTime })
    } else if (action === 'reject') {
      await updateOrder(orderId, { status: 'rejected', rejectReason: reason || '', reviewedAt: mysqlDateTime })
    } else {
      throwBadRequest('无效的审核操作')
    }
  }

  async settleOrder(orderId: string, params: OrderSettleParams) {
    const { action } = params
    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }

    const now = new Date()
    const mysqlDateTime = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0') + ':' +
      String(now.getSeconds()).padStart(2, '0')

    if (action === 'pending_payment') {
      if (order.status !== 'approved') {
        throwBadRequest('订单状态不允许添加到待发放')
      }
      await updateOrder(orderId, { status: 'pending_payment', settledAt: mysqlDateTime })
    } else if (action === 'paid') {
      if (order.status !== 'pending_payment') {
        throwBadRequest('订单状态不允许结算')
      }
      await updateOrder(orderId, { status: 'settled', settledAt: mysqlDateTime })
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