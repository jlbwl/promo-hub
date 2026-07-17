/**
 * OrderService - 订单业务逻辑层
 * 负责处理订单相关的所有业务逻辑，包括创建订单、审核、删除、恢复等
 */
import { injectable, inject } from 'tsyringe'
import {
  readProducts,
  readEmployeeById,
  readUser,
  readOrder,
  readDeletedOrders,
  restoreOrder,
  updateOrder,
  insertOrder,
  deleteOrder,
  getOrdersPaginated,
} from '../data/index.js'
import { updateProduct } from '../data/product.js'
import { DatabaseService } from './DatabaseService.js'
import { ErrorCode, throwNotFound, throwBadRequest, throwForbidden } from '@promo/shared'

export interface OrderService {
  getOrders(params: {
    page?: number
    pageSize?: number
    userId?: string
    managerId?: string
    employeeId?: string
    status?: string
    keyword?: string
    managedBy?: string
  }): Promise<{ list: any[]; total: number }>

  createOrder(orderData: {
    productId: string
    userId?: string
    employeeId?: string
    optionLabel?: string
    redirectUrl?: string
    userName?: string
    userPhone?: string
    sharerId?: string
  }): Promise<{ order: any; remainingStock: number }>

  adminDeleteOrder(orderId: string, adminInfo: {
    reason?: string
    adminId?: string
    adminPhone?: string
    adminName?: string
  }): Promise<void>

  deleteUserOrder(orderId: string, userId: string): Promise<void>

  getDeletedOrders(userId: string): Promise<any[]>

  restoreOrder(orderId: string, userId: string): Promise<void>

  submitFundAccount(orderId: string, userId: string, fundAccount: string): Promise<void>

  reviewOrder(orderId: string, params: {
    action: 'approve' | 'reject'
    reason?: string
  }): Promise<void>

  settleOrder(orderId: string, params: {
    action: 'pending_payment' | 'paid'
  }): Promise<void>

  updateOrderTeamName(orderId: string, teamName: string): Promise<void>
}

@injectable()
export class OrderServiceImpl implements OrderService {
  constructor(
    @inject(DatabaseService) private db: DatabaseService
  ) {}

  async getOrders(params) {
    const { page = 1, pageSize = 20, userId, managerId, employeeId, status, keyword, managedBy } = params
    return await getOrdersPaginated({ page, pageSize, userId, managerId, employeeId, status, keyword, managedBy })
  }

  async createOrder(orderData) {
    const { productId, userId, employeeId, optionLabel, redirectUrl, userName, userPhone, sharerId } = orderData

    const products = await this.db.readProducts()
    const index = products.findIndex((p: any) => p.id === productId)
    if (index === -1) {
      throwNotFound('产品不存在', ErrorCode.PRODUCT_NOT_FOUND)
    }

    const product = products[index]

    if (product.status !== 'published') {
      throwBadRequest('该产品已下架')
    }

    if (product.stock && product.stock > 0) {
      if (product.stock < 1) {
        throwBadRequest('库存不足', ErrorCode.INSUFFICIENT_STOCK)
      }
      await updateProduct(product.id, { stock: product.stock - 1, updatedAt: new Date().toISOString() })
    }

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

    const order = {
      id: `o_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      productId,
      userId: finalUserId,
      managerId: product.managerId,
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

    const remainingStock = product.stock && product.stock > 0 ? product.stock - 1 : (product.stock || -1)
    return { order, remainingStock }
  }

  async adminDeleteOrder(orderId, adminInfo) {
    const { reason } = adminInfo

    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }

    await deleteOrder(orderId)
  }

  async deleteUserOrder(orderId, userId) {
    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }

    if (order.userId !== userId) {
      throwForbidden('无权操作此订单')
    }

    await deleteOrder(orderId)
  }

  async getDeletedOrders(userId) {
    return await readDeletedOrders(userId)
  }

  async restoreOrder(orderId, userId) {
    const orders = await readDeletedOrders(userId)
    const order = orders.find((o: any) => o.id === orderId)

    if (!order) {
      throwNotFound('订单不存在或不在回收站')
    }

    if (order.userId !== userId) {
      throwForbidden('无权操作此订单')
    }

    await restoreOrder(orderId)
  }

  async submitFundAccount(orderId, userId, fundAccount) {
    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }

    if (order.userId !== userId) {
      throwForbidden('无权操作此订单')
    }

    await updateOrder(orderId, { fundAccount })
  }

  async reviewOrder(orderId, params) {
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

  async settleOrder(orderId, params) {
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

const db = {
  readProducts,
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
} as any

export const orderService: OrderService = new OrderServiceImpl(db)