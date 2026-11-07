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
const ORDER_PAGE_SIZE = 100
// 翻页上限，避免异常 total 导致无限请求
const ORDER_MAX_PAGES = 50

/**
 * 分页拉取满足条件的全部订单
 * 用于待发放批量结算、统计明细等需要全量数据的场景，避免被后端单页上限截断
 */
export async function fetchAllOrders(params: { managerId?: string; status?: string }): Promise<Order[]> {
  const all: Order[] = []
  for (let page = 1; page <= ORDER_MAX_PAGES; page++) {
    const res = await get<PaginatedResponse<Order>>('/orders', {
      ...params,
      page,
      pageSize: ORDER_PAGE_SIZE,
    })
    const data = res.data
    const list = data?.list || []
    all.push(...list)
    if (list.length === 0 || all.length >= (data?.total || 0)) break
  }
  return all
}
