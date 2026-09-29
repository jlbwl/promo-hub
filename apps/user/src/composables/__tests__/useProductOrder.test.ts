/**
 * useProductOrder 单元测试：做单 payload 组装、分享归因、跳转策略
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  resolveSharerId,
  buildOrderPayload,
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
  vi.unstubAllGlobals()
})

describe('resolveSharerId', () => {
  it('URL 参数优先，并写入 sessionStorage 记忆', () => {
    const id = resolveSharerId({ query: { sharerId: 'u_9' } })
    expect(id).toBe('u_9')
    expect(sessionStorage.getItem('sharer_id')).toBe('u_9')
  })

  it('无 URL 参数时回退 sessionStorage', () => {
    sessionStorage.setItem('sharer_id', 'u_8')
    expect(resolveSharerId({ query: {} })).toBe('u_8')
  })

  it('两处均无时返回空串', () => {
    expect(resolveSharerId({ query: {} })).toBe('')
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
