/**
 * OrderService - 订单业务逻辑层
 * 负责处理订单相关的所有业务逻辑，包括创建订单、审核、删除、恢复等
 */
import { injectable, inject } from 'tsyringe'
import {
  readProducts,
  readProduct,
  updateProduct,
  readEmployeeById,
  readUser,
  readOrder,
  readOrders,
  readDeletedOrders,
  restoreOrder,
  updateOrder,
  insertOrder,
  deleteOrder,
  getOrdersPaginated,
} from '../data/index.js'
import { DatabaseService } from './DatabaseService.js'
import { ErrorCode, throwNotFound, throwBadRequest, throwForbidden } from '@promo/shared'

/**
 * 订单服务接口
 */
export interface OrderService {
  /**
   * 获取订单列表（支持分页和筛选）
   */
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

  /**
   * 创建订单（做单）
   */
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

  /**
   * 管理员删除订单
   */
  adminDeleteOrder(orderId: string, adminInfo: {
    reason?: string
    adminId?: string
    adminPhone?: string
    adminName?: string
  }): Promise<void>

  /**
   * 用户删除订单（软删除）
   */
  deleteUserOrder(orderId: string, userId: string): Promise<void>

  /**
   * 获取用户已删除的订单（回收站）
   */
  getDeletedOrders(userId: string): Promise<any[]>

  /**
   * 恢复订单（从回收站找回）
   */
  restoreOrder(orderId: string, userId: string): Promise<void>

  /**
   * 提交资金号
   */
  submitFundAccount(orderId: string, userId: string, fundAccount: string): Promise<void>

  /**
   * 订单审核（通过/驳回）
   */
  reviewOrder(orderId: string, params: {
    action: 'approve' | 'reject'
    reason?: string
  }): Promise<void>

  /**
   * 订单结算（添加到待付款/已付款）
   */
  settleOrder(orderId: string, params: {
    action: 'pending_payment' | 'paid'
  }): Promise<void>

  /**
   * 更新订单团队名称
   */
  updateOrderTeamName(orderId: string, teamName: string): Promise<void>
}

/**
 * 订单服务实现类（可注入版本）
 */
@injectable()
export class OrderServiceImpl implements OrderService {
  constructor(
    @inject(DatabaseService) private db: DatabaseService
  ) {}

  /**
   * 获取订单列表
   */
  async getOrders(params) {
    const { page = 1, pageSize = 20, userId, managerId, employeeId, status, keyword, managedBy } = params
    return await getOrdersPaginated({ page, pageSize, userId, managerId, employeeId, status, keyword, managedBy })
  }

  /**
   * 创建订单（做单）
   */
  async createOrder(orderData) {
    const { productId, userId, employeeId, optionLabel, redirectUrl, userName, userPhone, sharerId } = orderData
    console.log('[OrderService] 创建订单, productId:', productId)

    const products = await this.db.readProducts()
    const index = products.findIndex((p: any) => p.id === productId)
    if (index === -1) {
      throwNotFound('产品不存在', ErrorCode.PRODUCT_NOT_FOUND)
    }

    const product = products[index]
    console.log('[OrderService] 产品信息:', { title: product.title, options: product.options, managerId: product.managerId })

    if (product.status !== 'published') {
      throwBadRequest('该产品已下架')
    }

    if (product.stock && product.stock > 0) {
      if (product.stock < 1) {
        throwBadRequest('库存不足', ErrorCode.INSUFFICIENT_STOCK)
      }
      console.log('[OrderService] 扣减库存, 原库存:', product.stock, '新库存:', product.stock - 1)
      await updateProduct(product.id, { stock: product.stock - 1, updatedAt: new Date().toISOString() })
    }

    let finalUserId = userId || 'guest'
    if (employeeId) {
      console.log('[OrderService] 员工做单, employeeId:', employeeId)
      const employee = await readEmployeeById(employeeId)
      if (employee) {
        finalUserId = employee.userId
        console.log('[OrderService] 员工主账户ID:', finalUserId)
      }
    }

    if (sharerId && finalUserId === 'guest') {
      console.log('[OrderService] 分享者做单, sharerId:', sharerId)
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
    console.log('[OrderService] 原始redirectUrl:', redirectUrl, '清理后:', cleanRedirectUrl)

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
    console.log('[OrderService] 创建订单:', JSON.stringify(order))
    await insertOrder(order)
    console.log('[OrderService] 订单已保存成功, ID:', order.id)

    const remainingStock = product.stock && product.stock > 0 ? product.stock - 1 : (product.stock || -1)
    return { order, remainingStock }
  }

  /**
   * 管理员删除订单
   */
  async adminDeleteOrder(orderId, adminInfo) {
    const { reason, adminId, adminPhone, adminName } = adminInfo

    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }

    await deleteOrder(orderId)
    console.log('[OrderService] 管理员删除订单:', orderId, '原因:', reason)
  }

  /**
   * 用户端删除订单（软删除）
   */
  async deleteUserOrder(orderId, userId) {
    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }

    if (order.userId !== userId) {
      throwForbidden('无权操作此订单')
    }

    await deleteOrder(orderId)
    console.log('[OrderService] 用户删除订单:', orderId)
  }

  /**
   * 获取用户已删除的订单（回收站）
   */
  async getDeletedOrders(userId) {
    return await readDeletedOrders(userId)
  }

  /**
   * 恢复订单（从回收站找回）
   */
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
    console.log('[OrderService] 恢复订单:', orderId)
  }

  /**
   * 提交资金号
   */
  async submitFundAccount(orderId, userId, fundAccount) {
    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }

    if (order.userId !== userId) {
      throwForbidden('无权操作此订单')
    }

    await updateOrder(orderId, { fundAccount })
    console.log('[OrderService] 提交资金号:', orderId, fundAccount)
  }

  /**
   * 订单审核（通过/驳回）
   */
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
      console.log('[OrderService] 审核通过订单:', orderId)
    } else if (action === 'reject') {
      await updateOrder(orderId, { status: 'rejected', rejectReason: reason || '', reviewedAt: mysqlDateTime })
      console.log('[OrderService] 驳回订单:', orderId, '原因:', reason)
    } else {
      throwBadRequest('无效的审核操作')
    }
  }

  /**
   * 订单结算（添加到待付款/已付款）
   */
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
      console.log('[OrderService] 订单添加到待发放:', orderId)
    } else if (action === 'paid') {
      if (order.status !== 'pending_payment') {
        throwBadRequest('订单状态不允许结算')
      }
      await updateOrder(orderId, { status: 'settled', settledAt: mysqlDateTime })
      console.log('[OrderService] 订单已结算:', orderId)
    } else {
      throwBadRequest('无效的结算操作')
    }
  }

  /**
   * 更新订单团队名称
   */
  async updateOrderTeamName(orderId: string, teamName: string): Promise<void> {
    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }
    await updateOrder(orderId, { teamName })
    console.log('[OrderService] 更新订单团队名称:', orderId, teamName)
  }
}

/**
 * 订单服务实现
 */
export const orderService: OrderService = {
  /**
   * 获取订单列表
   * 支持分页、用户筛选、经理筛选、状态筛选和管理类型筛选
   * @param params - 查询参数
   * @returns 分页的订单列表和总数
   */
  async getOrders(params) {
    const { page = 1, pageSize = 20, userId, managerId, employeeId, status, keyword, managedBy } = params

    return await getOrdersPaginated({
      page,
      pageSize,
      userId,
      managerId,
      employeeId,
      status,
      keyword,
      managedBy,
    })
  },

  /**
   * 创建订单（做单）
   * 验证产品存在性和状态，检查库存，扣减库存，创建订单记录
   * 支持用户做单和员工代做单两种模式
   * @param orderData - 订单数据
   * @returns 订单信息及剩余库存
   * @throws 产品不存在、产品已下架、库存不足时抛出错误
   */
  async createOrder(orderData) {
    const { productId, userId, employeeId, optionLabel, redirectUrl, userName, userPhone, sharerId } = orderData

    console.log('[OrderService] 创建订单, productId:', productId)

    // 验证产品存在性
    const products = await readProducts()
    const index = products.findIndex((p: any) => p.id === productId)
    if (index === -1) {
      throwNotFound('产品不存在', ErrorCode.PRODUCT_NOT_FOUND)
    }

    const product = products[index]
    console.log('[OrderService] 产品信息:', { title: product.title, options: product.options, managerId: product.managerId })

    // 验证产品状态
    if (product.status !== 'published') {
      throwBadRequest('该产品已下架')
    }

    // 扣减库存
    if (product.stock && product.stock > 0) {
      if (product.stock < 1) {
        throwBadRequest('库存不足', ErrorCode.INSUFFICIENT_STOCK)
      }
      console.log('[OrderService] 扣减库存, 原库存:', product.stock, '新库存:', product.stock - 1)
      await updateProduct(product.id, { stock: product.stock - 1, updatedAt: new Date().toISOString() })
    }

    // 处理用户ID（支持员工代做单）
    let finalUserId = userId || 'guest'
    if (employeeId) {
      console.log('[OrderService] 员工做单, employeeId:', employeeId)
      const employee = await readEmployeeById(employeeId)
      if (employee) {
        finalUserId = employee.userId
        console.log('[OrderService] 员工主账户ID:', finalUserId)
      }
    }

    // 分享者做单（访客通过分享链接做单时，业绩归分享者）
    if (sharerId && finalUserId === 'guest') {
      console.log('[OrderService] 分享者做单, sharerId:', sharerId)
      finalUserId = sharerId
    }

    // 获取团队名称
    let teamName = ''
    if (finalUserId !== 'guest') {
      const user = await readUser(finalUserId)
      if (user) {
        teamName = user.teamName || ''
      }
    }

    // 清理跳转链接
    const cleanRedirectUrl = (redirectUrl || '').replace(/`/g, '')
    console.log('[OrderService] 原始redirectUrl:', redirectUrl, '清理后:', cleanRedirectUrl)

    // 创建订单
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
    console.log('[OrderService] 创建订单:', JSON.stringify(order))
    await insertOrder(order)
    console.log('[OrderService] 订单已保存成功, ID:', order.id)

    const remainingStock = product.stock && product.stock > 0 ? product.stock - 1 : (product.stock || -1)

    return { order, remainingStock }
  },

  /**
   * 管理员删除订单
   * 管理员可删除任意订单，记录操作日志
   * @param orderId - 订单ID
   * @param adminInfo - 管理员信息
   * @throws 订单不存在时抛出错误
   */
  async adminDeleteOrder(orderId, adminInfo) {
    const { reason, adminId, adminPhone, adminName } = adminInfo

    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }

    await deleteOrder(orderId)

    // 记录操作日志（由Controller处理）
    console.log('[OrderService] 管理员删除订单:', orderId, '原因:', reason)
  },

  /**
   * 用户端删除订单（软删除）
   * 验证订单归属权限，将订单移入回收站
   * @param orderId - 订单ID
   * @param userId - 用户ID
   * @throws 订单不存在或无权操作时抛出错误
   */
  async deleteUserOrder(orderId, userId) {
    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }

    if (order.userId !== userId) {
      throwForbidden('无权操作此订单')
    }

    await deleteOrder(orderId)
    console.log('[OrderService] 用户删除订单:', orderId)
  },

  /**
   * 获取用户已删除的订单（回收站）
   * 查询指定用户的回收站订单列表
   * @param userId - 用户ID
   * @returns 回收站订单列表
   */
  async getDeletedOrders(userId) {
    return await readDeletedOrders(userId)
  },

  /**
   * 恢复订单（从回收站找回）
   * 验证订单归属权限，将订单从回收站恢复到正常状态
   * @param orderId - 订单ID
   * @param userId - 用户ID
   * @throws 订单不存在或不在回收站、无权操作时抛出错误
   */
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
    console.log('[OrderService] 恢复订单:', orderId)
  },

  /**
   * 提交资金号
   * 用户为订单提交资金账户信息，用于资金追踪
   * @param orderId - 订单ID
   * @param userId - 用户ID
   * @param fundAccount - 资金号
   * @throws 订单不存在或无权操作时抛出错误
   */
  async submitFundAccount(orderId, userId, fundAccount) {
    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }

    if (order.userId !== userId) {
      throwForbidden('无权操作此订单')
    }

    await updateOrder(orderId, { fundAccount })
    console.log('[OrderService] 提交资金号:', orderId, fundAccount)
  },

  /**
   * 订单审核（通过/驳回）
   * @param orderId - 订单ID
   * @param params - 审核参数（action: approve/reject, reason: 驳回原因）
   * @throws 订单不存在、状态不合法时抛出错误
   */
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
      console.log('[OrderService] 审核通过订单:', orderId)
    } else if (action === 'reject') {
      await updateOrder(orderId, { status: 'rejected', rejectReason: reason || '', reviewedAt: mysqlDateTime })
      console.log('[OrderService] 驳回订单:', orderId, '原因:', reason)
    } else {
      throwBadRequest('无效的审核操作')
    }
  },

  /**
   * 订单结算（添加到待付款/已付款）
   * @param orderId - 订单ID
   * @param params - 结算参数（action: pending_payment/paid）
   * @throws 订单不存在、状态不合法时抛出错误
   */
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
      console.log('[OrderService] 订单添加到待发放:', orderId)
    } else if (action === 'paid') {
      if (order.status !== 'pending_payment') {
        throwBadRequest('订单状态不允许结算')
      }
      await updateOrder(orderId, { status: 'settled', settledAt: mysqlDateTime })
      console.log('[OrderService] 订单已结算:', orderId)
    } else {
      throwBadRequest('无效的结算操作')
    }
  },

  /**
   * 更新订单团队名称
   */
  async updateOrderTeamName(orderId: string, teamName: string): Promise<void> {
    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }
    await updateOrder(orderId, { teamName })
    console.log('[OrderService] 更新订单团队名称:', orderId, teamName)
  },
}
