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
}

/**
 * 解析分享归因 ID：优先取当前 URL 参数；站内跳转会丢失 query，用 sessionStorage 记住最近一次分享来源
 */
export const resolveSharerId = (route: Pick<RouteLocationNormalizedLoaded, 'query'>): string => {
  const fromQuery = route.query.sharerId as string
  if (fromQuery) {
    sessionStorage.setItem('sharer_id', fromQuery)
    return fromQuery
  }
  return sessionStorage.getItem('sharer_id') || ''
}

/**
 * 组装做单 payload 并计算选中的跳转链接
 */
export const buildOrderPayload = (input: {
  productId: string
  options: ProductOption[]
  selectedOption: number
  userName: string
  userPhone: string
  userId: string
  employeeId?: string
  sharerId?: string
}): { payload: OrderPayload; jumpUrl: string } => {
  const { productId, options, selectedOption, userName, userPhone, userId, employeeId, sharerId } = input
  const chosenOption = options.length > 0 ? options[selectedOption] : null

  logger.debug('[做单] 选中的选项:', JSON.stringify(chosenOption))

  const payload: OrderPayload = { productId, userId, userName, userPhone }
  if (isEmployeeAccount() && employeeId) {
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
      try {
        const newWindow = window.open(url, '_blank')
        if (!newWindow || newWindow.closed === false) {
          throw new Error('window.open 可能被拦截')
        }
      } catch (err) {
        logger.debug('[做单] window.open 失败，使用 location.href', err)
        window.location.href = url
      }
    }
  } catch (err) {
    logger.error('[做单] 跳转失败:', err)
    window.location.href = url
  }
}
