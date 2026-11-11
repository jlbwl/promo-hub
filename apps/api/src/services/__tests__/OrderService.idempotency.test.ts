import { describe, it, expect, vi, beforeEach } from 'vitest'
import { orderService } from '../OrderService.js'

vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

vi.mock('../../data/index.js', () => ({
  readProducts: vi.fn(),
  readOrders: vi.fn(),
  readOrder: vi.fn(),
  getOrdersPaginated: vi.fn(),
  readEmployeeById: vi.fn(),
  readUser: vi.fn().mockResolvedValue({ teamName: '测试团队' }),
  insertOrder: vi.fn(),
  readDeletedOrders: vi.fn(),
  purgeOrder: vi.fn(),
  readProduct: vi.fn(),
  readCommissionByOrderId: vi.fn(),
  updateCommission: vi.fn(),
  applyOrderReview: vi.fn(),
  applyOrderSettlement: vi.fn(),
  updateOrderIfStatus: vi.fn(),
}))

vi.mock('../../db.js', () => ({
  query: vi.fn().mockResolvedValue({ affectedRows: 1 }),
}))

import { readProducts, insertOrder } from '../../data/index.js'
import { query } from '../../db.js'

/**
 * 做单幂等：同一 Idempotency-Key 重复提交只允许产生一单。
 * 库存扣减发生在写订单之前，佣金在审核时创建，因此幂等必须挡在扣库存之前。
 */
describe('OrderService.createOrder 幂等保护', () => {
  const mockProduct = {
    id: 'p1',
    status: 'published',
    managerId: 'm1',
    title: '测试产品',
    price: 9,
    stock: undefined,
  }

  const base = {
    productId: 'p1',
    userName: '张三',
    userPhone: '13400005565',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(readProducts).mockResolvedValue([mockProduct] as never)
    vi.mocked(query).mockResolvedValue({ affectedRows: 1 } as never)
    vi.mocked(insertOrder).mockResolvedValue(undefined as never)
  })

  it('同一幂等键重复提交只产生一单', async () => {
    const data = { ...base, userId: 'u_idem_1', idempotencyKey: 'key-alpha' }

    const first = await orderService.createOrder(data)
    const second = await orderService.createOrder(data)

    expect(insertOrder).toHaveBeenCalledTimes(1)
    expect(second.order.id).toBe(first.order.id)
  })

  it('并发提交同一幂等键只成功一次，且返回同一订单', async () => {
    const data = { ...base, userId: 'u_idem_2', idempotencyKey: 'key-beta' }

    const [a, b] = await Promise.all([
      orderService.createOrder(data),
      orderService.createOrder(data),
    ])

    expect(insertOrder).toHaveBeenCalledTimes(1)
    expect(a.order.id).toBe(b.order.id)
  })

  it('缺少幂等键时保持既有行为：两次提交生成两单', async () => {
    const data = { ...base, userId: 'u_idem_3' }

    const first = await orderService.createOrder(data)
    const second = await orderService.createOrder(data)

    expect(insertOrder).toHaveBeenCalledTimes(2)
    expect(second.order.id).not.toBe(first.order.id)
  })

  it('不同幂等键正常生成两单', async () => {
    const first = await orderService.createOrder({
      ...base,
      userId: 'u_idem_4',
      idempotencyKey: 'key-one',
    })
    const second = await orderService.createOrder({
      ...base,
      userId: 'u_idem_4',
      idempotencyKey: 'key-two',
    })

    expect(insertOrder).toHaveBeenCalledTimes(2)
    expect(second.order.id).not.toBe(first.order.id)
  })

  it('幂等键按用户隔离：不同用户使用相同键互不影响', async () => {
    await orderService.createOrder({ ...base, userId: 'u_a', idempotencyKey: 'shared-key' })
    await orderService.createOrder({ ...base, userId: 'u_b', idempotencyKey: 'shared-key' })

    expect(insertOrder).toHaveBeenCalledTimes(2)
  })

  it('首次提交失败后同一键重试可以正常创建（失败不被缓存）', async () => {
    const data = { ...base, userId: 'u_idem_5', idempotencyKey: 'key-retry' }
    vi.mocked(insertOrder).mockRejectedValueOnce(new Error('db down') as never)

    await expect(orderService.createOrder(data)).rejects.toThrow('db down')
    const retried = await orderService.createOrder(data)

    expect(insertOrder).toHaveBeenCalledTimes(2)
    expect(retried.order.id).toBeTruthy()
  })
})
