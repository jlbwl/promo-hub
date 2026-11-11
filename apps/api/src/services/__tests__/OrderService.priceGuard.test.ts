import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@promo/shared'
import { orderService } from '../OrderService.js'

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
  query: vi.fn().mockResolvedValue([{ affectedRows: 1 }]),
}))

import { readProducts, insertOrder } from '../../data/index.js'
import { query } from '../../db.js'

const mockProduct = {
  id: 'p1',
  status: 'published',
  managerId: 'm1',
  title: '测试产品',
  price: 199,
  stock: 10,
}

const baseOrder = {
  productId: 'p1',
  userId: 'u1',
  userName: '张三',
  userPhone: '13400005565',
}

describe('OrderService 价格一致性校验', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(readProducts).mockResolvedValue([mockProduct] as never)
    vi.mocked(query).mockResolvedValue([{ affectedRows: 1 }] as never)
  })

  it('前端价格与服务端不一致时拒绝下单，不扣库存也不写订单', async () => {
    await expect(
      orderService.createOrder({ ...baseOrder, expectedPrice: 0.01 })
    ).rejects.toThrow('价格已变动')

    expect(query).not.toHaveBeenCalled()
    expect(insertOrder).not.toHaveBeenCalled()
  })

  it('拒绝时返回 409 与变动产品信息，供前端提示刷新', async () => {
    const error = await orderService
      .createOrder({ ...baseOrder, expectedPrice: 0.01 })
      .catch((err: unknown) => err)

    expect(error).toBeInstanceOf(AppError)
    const appError = error as AppError
    expect(appError.statusCode).toBe(409)
    expect(appError.message).toBe('价格已变动，请刷新后重试')
    expect(appError.details).toMatchObject({
      reason: 'PRICE_CHANGED',
      productId: 'p1',
      currentPrice: 199,
    })
  })

  it('访客下单（无登录归属、仅有分享归因）同样受价格校验约束', async () => {
    await expect(
      orderService.createOrder({
        productId: 'p1',
        userId: 'share_owner',
        sharerId: 'share_owner',
        userName: '张三',
        userPhone: '13400005565',
        expectedPrice: 0.01,
      })
    ).rejects.toThrow('价格已变动')

    expect(insertOrder).not.toHaveBeenCalled()
  })

  it('前端价格与服务端一致时正常下单，入库单价取服务端价格', async () => {
    await orderService.createOrder({ ...baseOrder, expectedPrice: 199 })

    expect(insertOrder).toHaveBeenCalledWith(
      expect.objectContaining({ productPrice: 199, productName: '测试产品' })
    )
  })

  it('金额为小数时按现有浮点约定比对，允许等值浮点误差', async () => {
    vi.mocked(readProducts).mockResolvedValue([{ ...mockProduct, price: 9.9 }] as never)

    await orderService.createOrder({ ...baseOrder, expectedPrice: 9.9 })

    expect(insertOrder).toHaveBeenCalledWith(
      expect.objectContaining({ productPrice: 9.9 })
    )
  })

  it('不传前端价格时保持原有行为：不比对、按服务端价格入库', async () => {
    await orderService.createOrder(baseOrder)

    expect(insertOrder).toHaveBeenCalledWith(
      expect.objectContaining({ productPrice: 199 })
    )
  })

  it('stock=0 仍表示不限库存：不扣减库存也能下单', async () => {
    vi.mocked(readProducts).mockResolvedValue([{ ...mockProduct, stock: 0 }] as never)

    await orderService.createOrder({ ...baseOrder, expectedPrice: 199 })

    expect(query).not.toHaveBeenCalled()
    expect(insertOrder).toHaveBeenCalledWith(
      expect.objectContaining({ productPrice: 199 })
    )
  })
})
