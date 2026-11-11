/**
 * 订单操作可用性判定：按钮可见/可用必须与订单状态一致
 */
import type { Order } from '@promo/shared/types'

type OrderStatus = Order['status']

/**
 * 仅待审核订单允许修改资金账号
 */
export const canSubmitFundAccount = (status: OrderStatus): boolean => status === 'pending'

/**
 * 仅待审核订单允许用户软删除
 */
export const canDeleteOrder = (status: OrderStatus): boolean => status === 'pending'

/**
 * 已进入审核通过/待发放/已结算流程的订单不可永久删除
 */
export const canPurgeOrder = (status: OrderStatus): boolean =>
  status === 'pending' || status === 'rejected'

/**
 * 订单卡片操作提示：仅待审核状态可操作
 */
export const orderActionHint = (status: OrderStatus): string =>
  canSubmitFundAccount(status) || canDeleteOrder(status) ? '' : '仅待审核订单支持操作'

/**
 * 永久删除按钮禁用原因
 */
export const purgeDisabledReason = (status: OrderStatus): string =>
  canPurgeOrder(status) ? '' : '已进入结算流程的订单不可永久删除'
