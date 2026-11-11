/**
 * OrderService - 订单业务逻辑层
 * 负责处理订单相关的所有业务逻辑，包括创建订单、审核、删除、恢复等
 */
import { randomUUID } from 'node:crypto'
import { injectable, inject } from 'tsyringe'
import { CacheKeys, getCacheService as getGlobalCacheService } from './cache/index.js'
import logger from '../utils/logger.js'
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
  applyOrderReview,
  applyOrderSettlement,
  findDuplicateOrder,
  updateOrderIfStatus,
  type OrderUserOption,
} from '../data/index.js'
import type { OrderRow } from '../data-memory.js'
import { query } from '../db.js'
import { DatabaseService } from './DatabaseService.js'
import { AppError, ErrorCode, HttpStatus, throwNotFound, throwBadRequest, throwForbidden, CommissionStatus } from '@promo/shared'
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
  onlyDuplicate?: boolean
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
  /** 幂等键：同一用户 + 同一键在有效期内只创建一单；缺省时保持原有行为 */
  idempotencyKey?: string
  /**
   * 前端展示价，仅用于与服务端标价比对，不参与金额计算。
   * 缺省时不做比对（兼容不传价格的旧客户端）
   */
  expectedPrice?: number
}

/** 审核/结算操作者范围：经理只能操作本团队订单，管理员不受限 */
export interface OrderOperator {
  id: string
  role: 'admin' | 'manager' | 'user' | 'employee'
}

export interface OrderReviewParams {
  action: 'approve' | 'reject'
  reason?: string
  operator?: OrderOperator
  /** M1：人工确认重单后强制审核，默认 false 时命中重单返回 409 */
  force?: boolean
}

export interface OrderSettleParams {
  action: 'pending_payment' | 'paid'
  operator?: OrderOperator
}

export interface OrderService {
  getOrders(params: OrderListParams): Promise<{ list: OrderRow[]; total: number }>

  getOrderUserOptions(): Promise<OrderUserOption[]>

  createOrder(orderData: OrderCreateData): Promise<{ order: OrderRow; remainingStock: number }>

  adminDeleteOrder(orderId: string): Promise<OrderRow>

  deleteUserOrder(orderId: string, userId: string): Promise<void>

  getDeletedOrders(userId: string): Promise<OrderRow[]>

  restoreOrder(orderId: string, userId: string): Promise<void>

  purgeOrder(orderId: string, userId: string): Promise<void>

  submitFundAccount(orderId: string, userId: string, fundAccount: string): Promise<void>

  reviewOrder(orderId: string, params: OrderReviewParams): Promise<OrderRow>

  settleOrder(orderId: string, params: OrderSettleParams): Promise<OrderRow>

  updateOrderTeamName(orderId: string, teamName: string): Promise<OrderRow>
}

/**
 * 校验订单操作权限：经理只能审核/结算归属本团队的订单，管理员不受限
 * 防止经理通过订单 ID 越权操作其他团队的订单
 */
function assertOperatorCanHandle(order: OrderRow, operator?: OrderOperator): void {
  if (operator?.role === 'manager' && order.managerId !== operator.id) {
    throwForbidden('无权操作该订单')
  }
}

// H6：已进入资金流程的订单禁止用户自行删除/永久删除，保留财务凭证
const FINANCIAL_ORDER_STATUSES = new Set(['approved', 'pending_payment', 'settled'])

/**
 * 做单幂等缓存：覆盖超时重试、返回上一页重提、弱网重复点击的短窗口。
 * 只缓存在进程内存，pm2 目前是单实例 fork 模式（instances=1）。
 * 改 cluster/多实例前必须换 Redis `SET NX`，否则多进程各自持有独立缓存，幂等失效。
 */
const ORDER_IDEMPOTENCY_TTL_MS = 10 * 60 * 1000
const orderIdempotencyStore = new Map<
  string,
  { result: Promise<{ order: OrderRow; remainingStock: number }>; expiresAt: number }
>()

/** 订单业务状态 */
export type OrderStatus = 'pending' | 'approved' | 'rejected' | 'pending_payment' | 'settled'

/** 会改变订单状态的动作 */
export type OrderTransitionAction = 'approve' | 'reject' | 'pending_payment' | 'paid'

/**
 * R8：订单状态流转唯一事实来源。
 * 任何审核/结算动作只允许按此表校验，禁止再在业务代码里散落写 from 状态字面量。
 */
export const ALLOWED_TRANSITIONS: Record<
  OrderTransitionAction,
  { from: OrderStatus; to: OrderStatus }
> = {
  approve: { from: 'pending', to: 'approved' },
  reject: { from: 'pending', to: 'rejected' },
  pending_payment: { from: 'approved', to: 'pending_payment' },
  paid: { from: 'pending_payment', to: 'settled' },
}

/** 当前状态不允许该流转时的对外提示（与改造前逐字一致） */
const TRANSITION_REJECT_MESSAGES: Record<OrderTransitionAction, string> = {
  approve: '该订单已审核',
  reject: '该订单已审核',
  pending_payment: '仅已通过的订单可添加到待付款',
  paid: '仅待付款的订单可确认结算',
}

/**
 * 校验订单状态是否允许执行该流转，不允许时按既有文案抛出 400。
 * @param invalidActionMessage 传入非法 action（绕过 controller 校验）时的提示
 */
function assertTransitionAllowed(
  action: OrderTransitionAction,
  currentStatus: string,
  invalidActionMessage: string
): { from: OrderStatus; to: OrderStatus } {
  const transition = ALLOWED_TRANSITIONS[action]
  if (!transition) {
    throwBadRequest(invalidActionMessage)
  }
  if (currentStatus !== transition.from) {
    throwBadRequest(TRANSITION_REJECT_MESSAGES[action])
  }
  return transition
}

@injectable()
export class OrderServiceImpl implements OrderService {
  constructor(
    @inject(DatabaseService) private db: DatabaseService
  ) {}

  async getOrders(params: OrderListParams) {
    const { page = 1, pageSize = 20, userId, managerId, employeeId, status, userPhone, teamName, keyword, managedBy, onlyDuplicate } = params
    return await getOrdersPaginated({
      page, pageSize, userId, managerId, employeeId, status, userPhone, teamName, keyword, managedBy,
      // 仅在开启筛选时传参，保持既有调用方断言对象不变
      ...(onlyDuplicate ? { onlyDuplicate: true } : {}),
    })
  }

  async getOrderUserOptions() {
    return await readOrderUserOptions()
  }

  async createOrder(orderData: OrderCreateData) {
    const idempotencyKey = this.buildIdempotencyKey(orderData)
    if (!idempotencyKey) {
      return this.performCreateOrder(orderData)
    }

    const now = Date.now()
    const cached = orderIdempotencyStore.get(idempotencyKey)
    if (cached && cached.expiresAt > now) {
      return cached.result
    }

    // 同步占位：check 与 set 之间没有 await，单进程内并发同键只会有一个进入真实创建
    const result = this.performCreateOrder(orderData)
    orderIdempotencyStore.set(idempotencyKey, {
      result,
      expiresAt: now + ORDER_IDEMPOTENCY_TTL_MS,
    })
    this.pruneOrderIdempotencyStore(now)

    try {
      return await result
    } catch (error) {
      // 失败不缓存，允许调用方用同一个键重试
      if (orderIdempotencyStore.get(idempotencyKey)?.result === result) {
        orderIdempotencyStore.delete(idempotencyKey)
      }
      throw error
    }
  }

  /** 幂等键按用户隔离，避免不同用户偶然撞键互相影响；缺键时返回 null 走原路径 */
  private buildIdempotencyKey(orderData: OrderCreateData): string | null {
    const key = (orderData.idempotencyKey || '').trim()
    const userId = (orderData.userId || '').trim()
    if (!key || !userId) return null
    return `${userId}::${key}`
  }

  private pruneOrderIdempotencyStore(now: number): void {
    if (orderIdempotencyStore.size < 200) return
    for (const [key, entry] of orderIdempotencyStore) {
      if (entry.expiresAt <= now) {
        orderIdempotencyStore.delete(key)
      }
    }
  }

  private async performCreateOrder(orderData: OrderCreateData) {
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

    // 服务端标价是唯一计价依据；前端价格只做一致性比对，不一致时拒绝，
    // 既不按旧价成交也不静默按新价成交。金额保留两位小数比较，规避浮点误差。
    if (orderData.expectedPrice !== undefined) {
      const currentPrice = Number(product.price) || 0
      const cents = (value: number): number => Math.round(value * 100)
      if (cents(currentPrice) !== cents(orderData.expectedPrice)) {
        throw new AppError(
          '价格已变动，请刷新后重试',
          ErrorCode.PRICE_CHANGED,
          HttpStatus.CONFLICT,
          {
            reason: 'PRICE_CHANGED',
            productId: product.id,
            productName: product.title,
            currentPrice,
            submittedPrice: orderData.expectedPrice,
          }
        )
      }
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
    let stockDeducted = false
    if (product.stock && product.stock > 0) {
      const updateResult = (await query(
        'UPDATE products SET stock = stock - 1, updatedAt = NOW() WHERE id = ? AND stock > 0',
        [product.id]
      )) as { affectedRows?: number }
      if (!updateResult || updateResult.affectedRows === 0) {
        // 库存已被其他请求抢光
        throwBadRequest('库存不足，商品已被抢光', ErrorCode.INSUFFICIENT_STOCK)
      }
      stockDeducted = true
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
      // O13：随机段改用 crypto.randomUUID，保留时间前缀便于人工识别
      id: `o_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 8)}`,
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
    try {
      await insertOrder(order)
    } catch (error) {
      // H11：写订单失败时回补已扣减的库存，避免库存凭空丢失
      if (stockDeducted) {
        await query('UPDATE products SET stock = stock + 1, updatedAt = NOW() WHERE id = ?', [product.id])
      }
      throw error
    }

    // O11：下单会改变库存与销量，立即失效产品详情/列表缓存，避免 5 分钟内数据不一致
    try {
      const cacheService = getGlobalCacheService()
      await cacheService.delete(CacheKeys.PRODUCT_DETAIL(productId))
      await cacheService.deletePattern('product:list:*')
    } catch (cacheError) {
      logger.warn('[做单] 产品缓存失效失败:', { error: (cacheError as Error).message })
    }

    return { order, remainingStock }
  }

  async adminDeleteOrder(orderId: string) {
    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }

    await deleteOrder(orderId)
    // 返回被删除订单，供调用方写入可定位的审计日志
    return order
  }

  async deleteUserOrder(orderId: string, userId: string) {
    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }

    if (order.userId !== userId) {
      throwForbidden('无权操作此订单')
    }

    // H6：已通过/待发放/已结算订单不可进入回收站
    if (FINANCIAL_ORDER_STATUSES.has(order.status)) {
      throwBadRequest('该订单已进入结算流程，不可删除，请联系管理员')
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

    // H6：已通过/待发放/已结算订单不可物理删除
    if (FINANCIAL_ORDER_STATUSES.has(order.status)) {
      throwBadRequest('该订单已进入结算流程，不可永久删除')
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

    // M7：资金账号仅在做单待审核阶段允许修改，进入审核/发放流程后一律拒绝
    if (order.status !== 'pending') {
      throwBadRequest('该订单已进入结算流程，不可修改资金账号')
    }

    await updateOrder(orderId, { fundAccount })
  }

  async reviewOrder(orderId: string, params: OrderReviewParams): Promise<OrderRow> {
    const { action, reason, operator } = params
    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }

    assertOperatorCanHandle(order, operator)

    const transition = assertTransitionAllowed(action, order.status, '无效的审核操作')

    const nowMySQL = formatMySQLDateTime(new Date())!

    // M1：同客户同产品若已有进入资金流程的订单，默认返回 409 交人工判断；
    // 同客户同产品多单属正常业务，不做唯一约束、不禁止重复做单。
    if (action === 'approve' && !params.force && order.userPhone && order.productId) {
      const conflict = await findDuplicateOrder(order.userPhone, order.productId, order.id)
      if (conflict) {
        const error = new Error('该客户已有同产品在流程中的订单，请确认是否重复') as Error & {
          code?: number
          data?: unknown
        }
        error.code = 409
        error.data = {
          conflict: {
            id: conflict.id,
            userName: conflict.userName,
            productName: conflict.productName,
            productPrice: conflict.productPrice,
            status: conflict.status,
            createdAt: conflict.createdAt,
          },
        }
        throw error
      }
    }

    let updated = false
    if (action === 'approve') {
      // 事务：更新订单 + 创建待发放佣金记录，原子提交
      updated = await applyOrderReview(orderId, { reviewedAt: nowMySQL }, transition.from, transition.to, {
        id: `c_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 8)}`,
        orderId: order.id,
        userId: order.userId,
        managerId: order.managerId,
        productName: order.productName,
        amount: order.productPrice,
        status: CommissionStatus.PENDING,
      })
    } else if (action === 'reject') {
      // H11：仅真实限量（下单后仍 > 0）的商品回补库存；不限库存不回补，避免 0 → 1 漂移
      const product = order.productId ? await readProduct(order.productId) : null
      const shouldRestoreStock = !!product && product.stock !== undefined && product.stock > 0
      // 事务：更新订单 + 库存回补，原子提交
      updated = await applyOrderReview(
        orderId,
        { reviewedAt: nowMySQL, rejectReason: reason || '推广无效' },
        transition.from,
        transition.to,
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
    const { action, operator } = params
    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }

    assertOperatorCanHandle(order, operator)

    const transition = assertTransitionAllowed(action, order.status, '无效的结算操作')

    const nowMySQL = formatMySQLDateTime(new Date())!

    if (action === 'pending_payment') {
      const updated = await updateOrderIfStatus(orderId, { status: transition.to, addedToPaymentAt: nowMySQL }, transition.from)
      if (!updated) {
        throwBadRequest('订单状态已变化，请刷新后重试')
      }
      return { ...order, status: transition.to, addedToPaymentAt: nowMySQL }
    } else if (action === 'paid') {
      // M2：订单状态与佣金状态必须同事务提交，避免「订单已结算但佣金未发放」的不一致
      const commission = await readCommissionByOrderId(orderId)
      const updated = await applyOrderSettlement(orderId, nowMySQL, commission?.id, nowMySQL)
      if (!updated) {
        throwBadRequest('订单状态已变化，请刷新后重试')
      }
      return { ...order, status: transition.to, settledAt: nowMySQL }
    }
    throwBadRequest('无效的结算操作')
  }

  async updateOrderTeamName(orderId: string, teamName: string): Promise<OrderRow> {
    const order = await readOrder(orderId)
    if (!order) {
      throwNotFound('订单不存在')
    }
    await updateOrder(orderId, { teamName })
    // 返回更新前的订单快照，供调用方记录「旧值 → 新值」
    return order
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