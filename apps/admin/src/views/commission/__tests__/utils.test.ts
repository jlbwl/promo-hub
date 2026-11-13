import { describe, it, expect } from 'vitest'
import type { Order } from '@promo/shared/types'
import { auditResultText, displayProductPrice, sumDisplayProductPrice } from '../utils'

const createOrder = (overrides: Partial<Order> = {}): Order =>
  ({
    id: 'o_1',
    productId: 'p_1',
    userId: 'u_1',
    managerId: 'm_1',
    productName: '平安不限三任意卡-数据',
    productPrice: 100,
    status: 'settled',
    createdAt: '2026-11-12 11:25:00',
    ...overrides,
  }) as Order

describe('admin displayProductPrice / sumDisplayProductPrice', () => {
  it('驳回单推广费按 0 展示', () => {
    expect(displayProductPrice(createOrder({ status: 'rejected', productPrice: 100 }))).toBe(0)
    expect(displayProductPrice(createOrder({ status: 'settled', productPrice: 100 }))).toBe(100)
  })

  it('合计不包含驳回单金额', () => {
    const orders = [
      createOrder({ id: 'o_1', status: 'settled', productPrice: 100 }),
      createOrder({ id: 'o_2', status: 'settled', productPrice: 30 }),
      createOrder({ id: 'o_3', status: 'rejected', productPrice: 200 }),
    ]

    expect(sumDisplayProductPrice(orders)).toBe(130)
  })
})

describe('admin auditResultText 审核结果口径（与经理端一致）', () => {
  it('审核通过与已发放显示合格', () => {
    expect(auditResultText(createOrder({ status: 'approved' }))).toBe('合格')
    expect(auditResultText(createOrder({ status: 'settled' }))).toBe('合格')
  })

  it('驳回显示驳回原因，原因为空兜底横杠', () => {
    expect(auditResultText(createOrder({ status: 'rejected', rejectReason: '资料不全' }))).toBe('资料不全')
    expect(auditResultText(createOrder({ status: 'rejected', rejectReason: '' }))).toBe('--')
    expect(auditResultText(createOrder({ status: 'rejected' }))).toBe('--')
  })

  it('待审核保持横杠，不臆造为合格', () => {
    expect(auditResultText(createOrder({ status: 'pending' }))).toBe('--')
  })
})
