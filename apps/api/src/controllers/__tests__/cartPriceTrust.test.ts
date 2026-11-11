import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response } from 'express'

vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  },
}))

vi.mock('../../data/index.js', () => ({
  readProduct: vi.fn(),
  readCartItems: vi.fn(),
  readCartItem: vi.fn(),
  readCartByManagerId: vi.fn(),
  readUser: vi.fn(),
  readManager: vi.fn(),
  addToCart: vi.fn(),
  removeFromCart: vi.fn(),
  removeCartItems: vi.fn(),
  isInCart: vi.fn().mockResolvedValue(false),
}))

import { readProduct, isInCart, addToCart } from '../../data/index.js'
import { addItemToCart } from '../cart.controller.js'

const makeReq = (body: Record<string, unknown>): Request =>
  ({
    body,
    query: {},
    params: {},
    user: { id: 'u1', role: 'user' },
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
    data: unknown
  }

const dbProduct = {
  id: 'p1',
  title: '真实产品',
  price: 199,
  coverImage: '/uploads/real.jpg',
  managerId: 'm1',
  status: 'published',
}

const tamperedBody = {
  productId: 'p1',
  managerId: 'attacker',
  productName: '伪造产品名',
  productPrice: 0.01,
  coverImage: '/uploads/fake.jpg',
  optionLabel: '选项A',
  redirectUrl: 'https://example.com',
}

describe('cart.controller 不信任前端价格与产品信息', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isInCart).mockResolvedValue(false)
  })

  it('前端篡改价格与名称时，入库取数据库产品信息', async () => {
    vi.mocked(readProduct).mockResolvedValue(dbProduct as never)

    const res = makeRes()
    await addItemToCart(makeReq(tamperedBody), res)

    expect(addToCart).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        productId: 'p1',
        managerId: 'm1',
        productName: '真实产品',
        productPrice: 199,
        coverImage: '/uploads/real.jpg',
      })
    )
    expect(jsonPayload(res).code).toBe(0)
  })

  it('产品不存在时拒绝加入，不写购物车', async () => {
    vi.mocked(readProduct).mockResolvedValue(null)

    const res = makeRes()
    await addItemToCart(makeReq(tamperedBody), res)

    expect(addToCart).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(404)
    expect(jsonPayload(res).code).toBe(404)
  })

  it('产品已下架时拒绝加入，不写购物车', async () => {
    vi.mocked(readProduct).mockResolvedValue({ ...dbProduct, status: 'archived' } as never)

    const res = makeRes()
    await addItemToCart(makeReq(tamperedBody), res)

    expect(addToCart).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(jsonPayload(res).message).toContain('下架')
  })
})
