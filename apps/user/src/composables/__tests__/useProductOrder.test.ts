/**
 * useProductOrder 单元测试：做单 payload 组装、分享归因、跳转策略
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  beginShareVisit,
  endShareVisit,
  resolveSharerId,
  buildOrderPayload,
  buildOrderIdempotencySignature,
  resolveOrderIdempotencyKey,
  rotateOrderIdempotencyKey,
  isEmployeeAccount,
  getEmployeeId,
  jumpToUrl,
} from '../useProductOrder'
import type { ProductOption } from '@promo/shared/types'

const baseInput = {
  productId: 'p_1',
  options: [] as ProductOption[],
  selectedOption: -1,
  userName: '张三',
  userPhone: '13800138000',
  userId: 'u_1',
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  endShareVisit()
  vi.unstubAllGlobals()
})

describe('分享访问归因生命周期', () => {
  it('首次归因生效：从分享链接进入即可归因', () => {
    beginShareVisit({ query: { sharerId: 'u_9' } }, 'p_1')
    expect(resolveSharerId('p_1')).toBe('u_9')
  })

  it('同页连续两单都归因到同一分享人', () => {
    beginShareVisit({ query: { sharerId: 'u_9' } }, 'p_1')

    const first = buildOrderPayload({ ...baseInput, sharerId: resolveSharerId('p_1') })
    const second = buildOrderPayload({ ...baseInput, sharerId: resolveSharerId('p_1') })

    expect(first.payload.sharerId).toBe('u_9')
    expect(second.payload.sharerId).toBe('u_9')
  })

  it('离开后再从非分享入口进入不归因', () => {
    beginShareVisit({ query: { sharerId: 'u_9' } }, 'p_1')
    endShareVisit()
    beginShareVisit({ query: {} }, 'p_1')
    expect(resolveSharerId('p_1')).toBe('')
  })

  it('换产品不归因', () => {
    beginShareVisit({ query: { sharerId: 'u_9' } }, 'p_1')
    expect(resolveSharerId('p_2')).toBe('')
    beginShareVisit({ query: {} }, 'p_2')
    expect(resolveSharerId('p_1')).toBe('')
  })

  it('URL 参数变化后按新分享人重新归因', () => {
    beginShareVisit({ query: { sharerId: 'u_1' } }, 'p_1')
    expect(resolveSharerId('p_1')).toBe('u_1')

    beginShareVisit({ query: { sharerId: 'u_2' } }, 'p_1')
    expect(resolveSharerId('p_1')).toBe('u_2')
  })

  it('刷新等重建访问时 URL 无参数则不归因', () => {
    beginShareVisit({ query: { sharerId: 'u_9' } }, 'p_1')
    endShareVisit()
    beginShareVisit({ query: {} }, 'p_1')
    expect(resolveSharerId('p_1')).toBe('')
    expect(sessionStorage.getItem('sharer_id')).toBeNull()
  })
})

describe('isEmployeeAccount / getEmployeeId', () => {
  it('非员工登录返回 false 且 getEmployeeId 为 undefined', () => {
    expect(isEmployeeAccount()).toBe(false)
    expect(getEmployeeId()).toBeUndefined()
  })

  it('员工登录返回 employee_info 中的 id', () => {
    localStorage.setItem('login_type', 'employee')
    localStorage.setItem('employee_info', JSON.stringify({ id: 'e_1' }))
    expect(isEmployeeAccount()).toBe(true)
    expect(getEmployeeId()).toBe('e_1')
  })

  it('员工但 employee_info 缺失/损坏时返回 undefined', () => {
    localStorage.setItem('login_type', 'employee')
    expect(getEmployeeId()).toBeUndefined()
    localStorage.setItem('employee_info', '{broken')
    expect(getEmployeeId()).toBeUndefined()
  })
})

describe('buildOrderPayload', () => {
  it('组装基础字段（无选项）', () => {
    const { payload, jumpUrl } = buildOrderPayload(baseInput)
    expect(payload).toEqual({ productId: 'p_1', userId: 'u_1', userName: '张三', userPhone: '13800138000' })
    expect(jumpUrl).toBe('')
  })

  it('选中选项时携带 optionLabel，redirectUrl 清理反引号并补 https 前缀', () => {
    const { payload, jumpUrl } = buildOrderPayload({
      ...baseInput,
      options: [{ label: 'A套餐', redirectUrl: '` example.com/path `' } as ProductOption],
      selectedOption: 0,
    })
    expect(payload.optionLabel).toBe('A套餐')
    expect(payload.redirectUrl).toBe('example.com/path')
    expect(jumpUrl).toBe('https://example.com/path')
  })

  it('redirectUrl 已带协议时不重复补前缀', () => {
    const { jumpUrl } = buildOrderPayload({
      ...baseInput,
      options: [{ label: 'B', redirectUrl: 'https://a.com' } as ProductOption],
      selectedOption: 0,
    })
    expect(jumpUrl).toBe('https://a.com')
  })

  it('员工登录时 payload 携带 employeeId，非员工不带', () => {
    localStorage.setItem('login_type', 'employee')
    localStorage.setItem('employee_info', JSON.stringify({ id: 'e_1' }))
    const { payload } = buildOrderPayload(baseInput)
    expect(payload.employeeId).toBe('e_1')

    localStorage.removeItem('login_type')
    const { payload: p2 } = buildOrderPayload(baseInput)
    expect(p2.employeeId).toBeUndefined()
  })

  it('携带分享归因 sharerId', () => {
    const { payload } = buildOrderPayload({ ...baseInput, sharerId: 'u_9' })
    expect(payload.sharerId).toBe('u_9')
  })
})

describe('做单幂等键生命周期', () => {
  const payload = { productId: 'p_1', userId: 'u_1', userName: '张三', userPhone: '13800138000' }
  const signature = () => buildOrderIdempotencySignature(payload)

  it('场景1：成功拿到响应后轮换，下一次做单生成新键（第二单）', () => {
    const first = resolveOrderIdempotencyKey(signature())
    // 成功响应返回给前端后立即轮换
    rotateOrderIdempotencyKey(signature())
    const second = resolveOrderIdempotencyKey(signature())
    expect(second).not.toBe(first)
  })

  it('场景2：超时未拿到成功结果时保留键，重试仍命中同一键（同一订单）', () => {
    const first = resolveOrderIdempotencyKey(signature())
    expect(resolveOrderIdempotencyKey(signature())).toBe(first)
    expect(resolveOrderIdempotencyKey(signature())).toBe(first)
  })

  it('场景3：超时后放弃并重新填写同样信息，有效期内仍是同一键', () => {
    const first = resolveOrderIdempotencyKey(signature())
    const refilled = buildOrderIdempotencySignature({ ...payload })
    expect(resolveOrderIdempotencyKey(refilled)).toBe(first)
  })

  it('场景3 边界：键超过有效期后重新填写同样信息生成新键', () => {
    vi.useFakeTimers()
    try {
      const first = resolveOrderIdempotencyKey(signature())
      vi.advanceTimersByTime(10 * 60 * 1000 + 1)
      expect(resolveOrderIdempotencyKey(signature())).not.toBe(first)
    } finally {
      vi.useRealTimers()
    }
  })

  it('场景4：拿不到响应反复点提交，键恒定只落一单', () => {
    const first = resolveOrderIdempotencyKey(signature())
    const keys = Array.from({ length: 5 }, () => resolveOrderIdempotencyKey(signature()))
    expect(new Set(keys).size).toBe(1)
    expect(keys[0]).toBe(first)
  })

  it('签名要素变化（选项/客户信息/归属人）使用不同键', () => {
    const a = resolveOrderIdempotencyKey(buildOrderIdempotencySignature(payload))
    const withOption = resolveOrderIdempotencyKey(
      buildOrderIdempotencySignature({ ...payload, optionLabel: 'A套餐' })
    )
    const withPhone = resolveOrderIdempotencyKey(
      buildOrderIdempotencySignature({ ...payload, userPhone: '13800138001' })
    )
    const withSharer = resolveOrderIdempotencyKey(
      buildOrderIdempotencySignature({ ...payload, sharerId: 'u_9' })
    )
    expect(new Set([a, withOption, withPhone, withSharer]).size).toBe(4)
  })
})

describe('jumpToUrl', () => {
  const makeWindow = (openImpl?: (url: string) => unknown) => ({
    location: { href: '' },
    open: openImpl ?? vi.fn(() => ({})),
  })

  it('微信环境直接 location.href 跳转', () => {
    const fakeWindow = makeWindow()
    vi.stubGlobal('window', fakeWindow)
    vi.stubGlobal('navigator', { userAgent: 'MicroMessenger' })
    jumpToUrl('https://a.com')
    expect(fakeWindow.location.href).toBe('https://a.com')
    expect(fakeWindow.open).not.toHaveBeenCalled()
  })

  it('非微信环境优先 window.open 新窗口', () => {
    const fakeWindow = makeWindow()
    vi.stubGlobal('window', fakeWindow)
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0' })
    jumpToUrl('https://a.com')
    expect(fakeWindow.open).toHaveBeenCalledWith('https://a.com', '_blank')
    expect(fakeWindow.location.href).toBe('')
  })

  it('window.open 被拦截（返回空）时降级 location.href', () => {
    const fakeWindow = makeWindow(() => null)
    vi.stubGlobal('window', fakeWindow)
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0' })
    jumpToUrl('https://a.com')
    expect(fakeWindow.location.href).toBe('https://a.com')
  })
})
