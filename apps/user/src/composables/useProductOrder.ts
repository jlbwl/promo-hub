/**
 * 产品详情做单流程：payload 组装、分享归因、跳转链接处理
 * 纯逻辑与 DOM 跳转策略独立于视图，便于复用与测试
 */
import { logger } from '@promo/shared/utils/logger'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { ProductOption } from '@promo/shared/types'

/**
 * 做单请求 payload
 */
export interface OrderPayload {
  productId: string
  userId: string
  userName?: string
  userPhone?: string
  employeeId?: string
  sharerId?: string
  optionLabel?: string
  redirectUrl?: string
  /** 页面展示价：仅供服务端做一致性比对，不参与金额计算 */
  productPrice?: number
}

/**
 * 本次分享访问的归因记录：只存在于内存，绑定的产品页关闭/切换即失效
 */
interface ShareVisit {
  productId: string
  sharerId: string
}

let currentShareVisit: ShareVisit | null = null

/**
 * 建立本次分享访问：URL 无 sharerId 时视为非分享入口，直接清空归因
 */
export const beginShareVisit = (
  route: Pick<RouteLocationNormalizedLoaded, 'query'>,
  productId: string
): void => {
  const fromQuery = typeof route.query.sharerId === 'string' ? route.query.sharerId : ''
  currentShareVisit = fromQuery ? { productId, sharerId: fromQuery } : null
}

/**
 * 结束本次分享访问：离开产品详情页时调用
 */
export const endShareVisit = (): void => {
  currentShareVisit = null
}

/**
 * 解析本次分享访问的归因：仅同一产品有效。
 * 归因不随下单消费，保证同一次分享访问内连续做单仍归属同一分享人
 */
export const resolveSharerId = (productId: string): string => {
  if (!currentShareVisit || currentShareVisit.productId !== productId) return ''
  return currentShareVisit.sharerId
}

/**
 * 组装做单 payload 并计算选中的跳转链接（员工身份由模块内自行解析）
 */
export const buildOrderPayload = (input: {
  productId: string
  options: ProductOption[]
  selectedOption: number
  userName: string
  userPhone: string
  userId: string
  sharerId?: string
  productPrice?: number
}): { payload: OrderPayload; jumpUrl: string } => {
  const { productId, options, selectedOption, userName, userPhone, userId, sharerId, productPrice } = input
  const chosenOption = options.length > 0 ? options[selectedOption] : null

  logger.debug('[做单] 选中的选项:', JSON.stringify(chosenOption))

  const payload: OrderPayload = { productId, userId, userName, userPhone }
  // 展示价随请求带上，由服务端比对；金额仍以服务端标价为准
  if (typeof productPrice === 'number') {
    payload.productPrice = productPrice
  }
  const employeeId = getEmployeeId()
  if (employeeId) {
    payload.employeeId = employeeId
  }
  if (sharerId) {
    payload.sharerId = sharerId
  }

  // 获取跳转链接
  let jumpUrl = ''
  if (chosenOption) {
    payload.optionLabel = chosenOption.label
    // 清理 redirectUrl 中的反引号和首尾空格/换行
    payload.redirectUrl = (chosenOption.redirectUrl || '').replace(/`/g, '').trim()
    logger.debug('[做单] 原始redirectUrl:', chosenOption.redirectUrl)
    logger.debug('[做单] 清理后redirectUrl:', payload.redirectUrl)

    jumpUrl = payload.redirectUrl
    if (jumpUrl && !jumpUrl.startsWith('http://') && !jumpUrl.startsWith('https://')) {
      jumpUrl = 'https://' + jumpUrl
    }
    logger.debug('[做单] 跳转链接:', jumpUrl)
  }

  logger.debug('[做单] 开始提交, payload:', JSON.stringify(payload))
  return { payload, jumpUrl }
}

/**
 * 做单幂等键（前端侧）
 *
 * - 同一「做单意图签名」在有效期内复用同一个键：覆盖超时重试、弱网重复点击
 * - 拿到成功响应后立即调用 rotateOrderIdempotencyKey 轮换：下一次提交生成新键，
 *   保证同客户同产品的第二次真实独立购买照常生成第二单
 * - 未拿到成功结果（超时/断网）时不轮换，重试仍命中同一订单
 * - 窗口与服务端幂等 TTL 对齐；服务端记录只用于重试保护，不影响新键产生新单
 */
const ORDER_IDEMPOTENCY_TTL_MS = 10 * 60 * 1000
const ORDER_IDEMPOTENCY_STORAGE_PREFIX = 'order_idem:'

/** 做单意图签名：同签名视为同一次提交尝试 */
export const buildOrderIdempotencySignature = (payload: OrderPayload): string =>
  [
    payload.productId,
    payload.optionLabel || '',
    payload.userName || '',
    payload.userPhone || '',
    payload.userId || '',
    payload.sharerId || '',
  ].join('|')

const idempotencyStorageKey = (signature: string): string =>
  `${ORDER_IDEMPOTENCY_STORAGE_PREFIX}${signature}`

/**
 * 取当前做单意图的幂等键：有效期内复用，过期或不存在则生成新键。
 * sessionStorage 不可用（隐私模式等）时退化为本次提交专用键。
 */
export const resolveOrderIdempotencyKey = (signature: string): string => {
  const storageKey = idempotencyStorageKey(signature)
  try {
    const cached = sessionStorage.getItem(storageKey)
    if (cached) {
      const parsed = JSON.parse(cached) as { key?: string; expiresAt?: number }
      if (parsed.key && typeof parsed.expiresAt === 'number' && parsed.expiresAt > Date.now()) {
        return parsed.key
      }
    }
  } catch {
    // 读取/解析失败时按缺失处理
  }

  const key =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  try {
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({ key, expiresAt: Date.now() + ORDER_IDEMPOTENCY_TTL_MS })
    )
  } catch {
    // 写入失败不影响本次提交
  }
  return key
}

/**
 * 做单成功（拿到成功响应）后轮换：丢弃该签名对应的键，下一次提交生成新键。
 * 审核层允许同客户同产品重复购买，因此成功一次后不能继续复用旧键。
 * 注意：服务端幂等记录是进程内内存（单实例 fork），改 cluster/多实例前必须换成 Redis SET NX。
 */
export const rotateOrderIdempotencyKey = (signature: string): void => {
  try {
    sessionStorage.removeItem(idempotencyStorageKey(signature))
  } catch {
    // sessionStorage 不可用时无副作用
  }
}

/**
 * 是否员工账户登录
 */
export const isEmployeeAccount = (): boolean => localStorage.getItem('login_type') === 'employee'

/**
 * 获取员工子账户 ID（非员工登录返回 undefined）
 */
export const getEmployeeId = (): string | undefined => {
  if (!isEmployeeAccount()) return undefined
  try {
    return (JSON.parse(localStorage.getItem('employee_info') || '{}') as { id?: string }).id || undefined
  } catch {
    return undefined
  }
}

/**
 * 提交成功后的跳转策略：微信内直接跳，其余优先新窗口、被拦截则降级当前页
 */
export const jumpToUrl = (url: string) => {
  try {
    if (navigator.userAgent.includes('MicroMessenger')) {
      logger.debug('[做单] 微信环境检测')
      window.location.href = url
    } else {
      // window.open 成功时返回的窗口对象 closed === false；
      // 被拦截时返回 null 或一个已关闭（closed === true）的对象
      const newWindow = window.open(url, '_blank')
      if (!newWindow || newWindow.closed) {
        logger.debug('[做单] window.open 被拦截，降级为当前页跳转')
        window.location.href = url
      }
    }
  } catch (err) {
    logger.error('[做单] 跳转失败:', err)
    window.location.href = url
  }
}
