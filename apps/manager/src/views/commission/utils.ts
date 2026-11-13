/**
 * 佣金管理页共享纯函数：脱敏、时间格式化、状态映射、经理身份读取、全量订单拉取
 */
import { orderStatusTagType, orderStatusText } from '@promo/shared/utils/helpers'
import { get } from '@promo/shared/utils/request'
import type { Order, PaginatedResponse } from '@promo/shared/types'

// 订单状态对应的标签类型
export const statusTagType = orderStatusTagType

// 订单状态中文文案
export const statusText = orderStatusText

// 脱敏与时间格式化统一使用 shared 实现（北京时区，分钟级）
export { formatTime, maskPhone, maskName } from '@promo/shared/utils/helpers'

// 获取当前经理 ID
export const getManagerId = () => {
  try {
    const info = JSON.parse(localStorage.getItem('manager_info') || '{}')
    return info.id || ''
  } catch (error) {
    console.warn('Failed to parse manager_info from localStorage', error)
    return ''
  }
}

// 后端单页上限（与 apps/api 的 MAX_PAGE_SIZE 保持一致）
export const ORDER_PAGE_SIZE = 100
// 翻页上限，避免异常 total 导致无限请求；同时也是一键发放的单次处理上限
export const ORDER_MAX_PAGES = 50
// 单次最多拉取的订单数（100 × 50）
export const ORDER_FETCH_LIMIT = ORDER_PAGE_SIZE * ORDER_MAX_PAGES

export interface FetchAllOrdersResult {
  orders: Order[]
  /** 后端返回的满足条件的总条数 */
  total: number
  /** 是否因翻页上限未能拉全，调用方必须向用户明示 */
  truncated: boolean
  /** 未拉取的条数，truncated 为 true 时大于 0 */
  remaining: number
}

/**
 * 分页拉取满足条件的全部订单
 * 用于待发放批量结算、统计明细等需要全量数据的场景，避免被后端单页上限截断
 * 达到翻页上限时通过 truncated/remaining 返回，禁止调用方静默忽略
 */
export async function fetchAllOrders(params: { managerId?: string; status?: string }): Promise<FetchAllOrdersResult> {
  const all: Order[] = []
  let total = 0
  for (let page = 1; page <= ORDER_MAX_PAGES; page++) {
    const res = await get<PaginatedResponse<Order>>('/orders', {
      ...params,
      page,
      pageSize: ORDER_PAGE_SIZE,
    })
    const data = res.data
    const list = data?.list || []
    total = data?.total ?? Math.max(total, all.length + list.length)
    all.push(...list)
    if (list.length === 0 || all.length >= total) break
  }
  const resolvedTotal = Math.max(total, all.length)
  const remaining = Math.max(resolvedTotal - all.length, 0)
  return {
    orders: all,
    total: resolvedTotal,
    truncated: remaining > 0,
    remaining,
  }
}

/**
 * 逐笔执行结算，单笔失败不中断，返回成功与失败明细
 * 失败明细用于界面展示与重试，避免“只提示成功数量”导致漏单不可见
 */
export async function settleOrders(
  orders: Order[],
  settle: (order: Order) => Promise<unknown>
): Promise<{ settled: Order[]; failed: Order[] }> {
  const settled: Order[] = []
  const failed: Order[] = []
  for (const order of orders) {
    try {
      await settle(order)
      settled.push(order)
    } catch {
      failed.push(order)
    }
  }
  return { settled, failed }
}

/** 订单推广费合计（金额口径：只传入需要统计的订单） */
export const sumProductPrice = (orders: Order[]): number =>
  orders.reduce((sum, order) => sum + (Number(order.productPrice) || 0), 0)

/**
 * 展示用推广费：驳回单按 0 展示（不改数据库原值），
 * 主列表与已发放明细合计统一走此口径，避免驳回单计入已发放金额
 */
export const displayProductPrice = (order: Order): number =>
  order.status === 'rejected' ? 0 : Number(order.productPrice) || 0

/** 展示口径的推广费合计：驳回单按 0 计入 */
export const sumDisplayProductPrice = (orders: Order[]): number =>
  orders.reduce((sum, order) => sum + displayProductPrice(order), 0)
