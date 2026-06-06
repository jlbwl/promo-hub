/**
 * OrderService - 订单业务逻辑层
 * 负责处理订单相关的所有业务逻辑，包括创建订单、审核、删除、恢复等
 */
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
} from '../data.js'
import { ErrorCode, throwNotFound, throwBadRequest, throwForbidden } from '../../packages/shared/src/utils/errors'

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
    const { productId, userId, employeeId, optionLabel, redirectUrl, userName, userPhone } = orderData

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
}
