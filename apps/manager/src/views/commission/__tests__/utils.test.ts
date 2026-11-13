/**
 * commission/utils 单元测试：订单状态映射、脱敏与时间格式化（shared 再导出）、经理身份读取
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Order } from '@promo/shared/types'

vi.mock('@promo/shared/utils/request', () => ({
  get: vi.fn(),
}))

import { get } from '@promo/shared/utils/request'
import { displayProductPrice, fetchAllOrders, formatTime, getManagerId, maskName, maskPhone, settleOrders, statusTagType, statusText, sumDisplayProductPrice, sumProductPrice } from '../utils'

beforeEach(() => {
  localStorage.clear()
  vi.resetAllMocks()
})

describe('statusTagType / statusText', () => {
  it('状态映射到标签类型与中文文案，未知状态兜底', () => {
    expect(statusTagType('pending')).toBe('warning')
    expect(statusTagType('approved')).toBe('success')
    // 注意：源码中 pending_payment 映射为 ''，但 `map[status] || 'info'` 使空串回落为 'info'
    expect(statusTagType('pending_payment')).toBe('info')
    expect(statusTagType('settled')).toBe('success')
    expect(statusTagType('rejected')).toBe('danger')
    expect(statusTagType('unknown')).toBe('info')

    expect(statusText('pending')).toBe('待审核')
    expect(statusText('approved')).toBe('已通过')
    expect(statusText('pending_payment')).toBe('待发放')
    expect(statusText('settled')).toBe('已发放')
    expect(statusText('rejected')).toBe('已驳回')
    expect(statusText('unknown')).toBe('unknown')
  })
})

describe('脱敏与时间格式化（shared 再导出）', () => {
  it('maskPhone 保留前 3 后 4，短号与空值兜底', () => {
    expect(maskPhone('13812345678')).toBe('138****5678')
    expect(maskPhone('123')).toBe('123')
    expect(maskPhone(undefined)).toBe('--')
  })

  it('maskName 保留首尾字符，空值兜底', () => {
    expect(maskName('张三')).toBe('张*')
    expect(maskName('欧阳锋')).toBe('欧*锋')
    expect(maskName(undefined)).toBe('--')
  })

  it('formatTime 按 UTC+8 输出分钟级时间，空值返回占位文本', () => {
    expect(formatTime('2026-01-02T15:30:00Z')).toBe('2026-01-02 23:30')
    expect(formatTime('')).toBe('')
    expect(formatTime(undefined, '暂无')).toBe('暂无')
  })
})

describe('getManagerId', () => {
  it('读取 manager_info 中的 id', () => {
    localStorage.setItem('manager_info', JSON.stringify({ id: 'm1', name: '经理' }))
    expect(getManagerId()).toBe('m1')
  })

  it('缺失、非法 JSON 或缺少 id 时返回空字符串', () => {
    expect(getManagerId()).toBe('')
    localStorage.setItem('manager_info', '{bad json')
    expect(getManagerId()).toBe('')
    localStorage.setItem('manager_info', JSON.stringify({ name: '经理' }))
    expect(getManagerId()).toBe('')
  })
})

describe('fetchAllOrders', () => {
  it('按后端单页上限翻页拉取全部订单', async () => {
    const firstPage = Array.from({ length: 100 }, (_, i) => ({ id: `o${i}` }) as Order)
    const secondPage = Array.from({ length: 50 }, (_, i) => ({ id: `o${100 + i}` }) as Order)

    vi.mocked(get)
      .mockResolvedValueOnce({
        code: 0,
        message: 'success',
        data: { list: firstPage, total: 150, page: 1, pageSize: 100 },
      })
      .mockResolvedValueOnce({
        code: 0,
        message: 'success',
        data: { list: secondPage, total: 150, page: 2, pageSize: 100 },
      })

    const result = await fetchAllOrders({ status: 'pending_payment' })

    expect(result.orders).toHaveLength(150)
    expect(result.total).toBe(150)
    expect(result.truncated).toBe(false)
    expect(result.remaining).toBe(0)
    expect(get).toHaveBeenCalledTimes(2)
    expect(vi.mocked(get).mock.calls[0][1]).toMatchObject({
      status: 'pending_payment',
      page: 1,
      pageSize: 100,
    })
    expect(vi.mocked(get).mock.calls[1][1]).toMatchObject({ page: 2, pageSize: 100 })
  })

  it('首屏为空时只请求一次', async () => {
    vi.mocked(get).mockResolvedValueOnce({
      code: 0,
      message: 'success',
      data: { list: [], total: 0, page: 1, pageSize: 100 },
    })

    const result = await fetchAllOrders({})

    expect(result.orders).toEqual([])
    expect(result.total).toBe(0)
    expect(result.truncated).toBe(false)
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('超过 5000 笔时返回截断标记与未拉取数量，不静默丢弃', async () => {
    vi.mocked(get).mockImplementation((_url: string, params?: object) => {
      const query = (params || {}) as Record<string, unknown>
      const page = Number(query.page || 1)
      const list = Array.from({ length: 100 }, (_, i) => ({ id: `p${page}-${i}` }) as Order)
      return Promise.resolve({
        code: 0,
        message: 'success',
        data: { list, total: 5100, page, pageSize: 100 },
      })
    })

    const result = await fetchAllOrders({ status: 'pending_payment' })

    expect(get).toHaveBeenCalledTimes(50)
    expect(result.orders).toHaveLength(5000)
    expect(result.total).toBe(5100)
    expect(result.truncated).toBe(true)
    expect(result.remaining).toBe(100)
  })

  it('恰好 5000 笔时不算截断', async () => {
    vi.mocked(get).mockImplementation((_url: string, params?: object) => {
      const query = (params || {}) as Record<string, unknown>
      const page = Number(query.page || 1)
      const list = Array.from({ length: 100 }, (_, i) => ({ id: `p${page}-${i}` }) as Order)
      return Promise.resolve({
        code: 0,
        message: 'success',
        data: { list, total: 5000, page, pageSize: 100 },
      })
    })

    const result = await fetchAllOrders({})

    expect(result.orders).toHaveLength(5000)
    expect(result.truncated).toBe(false)
    expect(result.remaining).toBe(0)
  })
})

describe('settleOrders / sumProductPrice', () => {
  const orders = [
    { id: 'o1', productPrice: 100 } as Order,
    { id: 'o2', productPrice: 50 } as Order,
    { id: 'o3', productPrice: '30' as unknown as number } as Order,
  ]

  it('逐笔结算，单笔失败不中断，并分别返回成功与失败明细', async () => {
    const settle = vi.fn(async (order: Order) => {
      if (order.id === 'o2') throw new Error('boom')
    })

    const result = await settleOrders(orders, settle)

    expect(settle).toHaveBeenCalledTimes(3)
    expect(result.settled.map(o => o.id)).toEqual(['o1', 'o3'])
    expect(result.failed.map(o => o.id)).toEqual(['o2'])
    // 合计只统计成功部分
    expect(sumProductPrice(result.settled)).toBe(130)
    expect(sumProductPrice(result.failed)).toBe(50)
  })

  it('全部成功时失败清单为空', async () => {
    const result = await settleOrders(orders, async () => undefined)

    expect(result.failed).toEqual([])
    expect(result.settled).toHaveLength(3)
    expect(sumProductPrice(result.settled)).toBe(180)
  })
})

describe('displayProductPrice / sumDisplayProductPrice 金额口径', () => {
  it('驳回单按 0 展示，其他状态保留原推广费', () => {
    expect(displayProductPrice({ id: 'o1', status: 'settled', productPrice: 100 } as Order)).toBe(100)
    expect(displayProductPrice({ id: 'o2', status: 'rejected', productPrice: 100 } as Order)).toBe(0)
    expect(displayProductPrice({ id: 'o3', status: 'rejected', productPrice: '50' as unknown as number } as Order)).toBe(0)
  })

  it('已发放与已驳回合并合计不因驳回单变大', () => {
    const mergedOrders = [
      { id: 'o1', status: 'settled', productPrice: 100 } as Order,
      { id: 'o2', status: 'settled', productPrice: 30 } as Order,
      { id: 'o3', status: 'rejected', productPrice: 200 } as Order,
    ]

    expect(sumDisplayProductPrice(mergedOrders)).toBe(130)
  })

  it('sumProductPrice 对非法金额按 0 处理', () => {
    expect(sumProductPrice([{ id: 'x', productPrice: 'abc' as unknown as number } as Order])).toBe(0)
    expect(sumProductPrice([])).toBe(0)
  })
})
