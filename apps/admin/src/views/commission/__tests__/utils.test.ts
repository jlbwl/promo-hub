import { describe, it, expect } from 'vitest'
import type { Order } from '@promo/shared/types'
import { displayProductPrice, sumDisplayProductPrice } from '../utils'

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
