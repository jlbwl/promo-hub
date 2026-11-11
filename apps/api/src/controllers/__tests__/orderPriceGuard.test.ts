import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response } from 'express'
import { AppError, ErrorCode, HttpStatus } from '@promo/shared'

vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  },
  maskPhone: (phone: string) => phone,
}))

vi.mock('../../services/index.js', () => ({
  orderService: {
    createOrder: vi.fn(),
  },
}))

vi.mock('../../data/index.js', () => ({
  insertOperationLog: vi.fn(),
  readUser: vi.fn(async (id: string) => ({ id, status: 'active' })),
}))

vi.mock('../../data-memory.js', () => ({
  getOrdersPaginated: vi.fn(),
}))

import { orderService } from '../../services/index.js'
import { createOrder } from '../order.controller.js'

const makeReq = (body: Record<string, unknown>, user?: unknown): Request =>
  ({
    body,
    query: {},
    params: {},
    headers: {},
    user,
  }) as unknown as Request

const makeRes = (): Response =>
  ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }) as unknown as Response

const jsonPayload = (res: Response) =>
  vi.mocked(res.json).mock.calls[0][0] as {
    code: number
    message: string
    data: Record<string, unknown> | null
  }

const baseBody = {
  productId: 'p1',
  userName: '张三',
  userPhone: '13400005565',
}

describe('order.controller 前端价格仅作一致性比对', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('把前端价格透传给服务端做比对', async () => {
    vi.mocked(orderService.createOrder).mockResolvedValue({
      order: { id: 'o1' },
      remainingStock: 1,
    } as never)

    const res = makeRes()
    await createOrder(
      makeReq({ ...baseBody, productPrice: 199 }, { id: 'u1', role: 'user' }),
      res
    )

    expect(orderService.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ expectedPrice: 199 })
    )
  })

  it('价格变动时返回 409、PRICE_CHANGED 与变动产品，不落单', async () => {
    vi.mocked(orderService.createOrder).mockRejectedValue(
      new AppError(
        '价格已变动，请刷新后重试',
        ErrorCode.PRICE_CHANGED,
        HttpStatus.CONFLICT,
        { reason: 'PRICE_CHANGED', productId: 'p1', currentPrice: 199 }
      )
    )

    const res = makeRes()
    await createOrder(
      makeReq({ ...baseBody, productPrice: 0.01 }, { id: 'u1', role: 'user' }),
      res
    )

    expect(res.status).toHaveBeenCalledWith(409)
    const payload = jsonPayload(res)
    expect(payload.code).toBe(ErrorCode.PRICE_CHANGED)
    expect(payload.message).toBe('价格已变动，请刷新后重试')
    expect(payload.data).toMatchObject({ reason: 'PRICE_CHANGED', productId: 'p1' })
  })

  it('价格字段类型非法时直接拒绝，不进入下单逻辑', async () => {
    const res = makeRes()
    await createOrder(
      makeReq({ ...baseBody, productPrice: '免费' }, { id: 'u1', role: 'user' }),
      res
    )

    expect(orderService.createOrder).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(jsonPayload(res).code).toBe(400)
  })

  it('未传价格时保持原有行为，不额外校验', async () => {
    vi.mocked(orderService.createOrder).mockResolvedValue({
      order: { id: 'o1' },
      remainingStock: 1,
    } as never)

    const res = makeRes()
    await createOrder(makeReq(baseBody, { id: 'u1', role: 'user' }), res)

    expect(orderService.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ expectedPrice: undefined })
    )
  })
})
