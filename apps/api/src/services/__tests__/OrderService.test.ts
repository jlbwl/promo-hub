import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { orderService } from '../OrderService.js'

// Mock console to keep test output clean
vi.spyOn(console, 'log').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

// Mock data module
vi.mock('../../data/index.js', () => ({
  readProducts: vi.fn(),
  readOrders: vi.fn(),
  readOrder: vi.fn(),
  getOrdersPaginated: vi.fn()
}))

import {
  readProducts,
  readOrders,
  readOrder,
  getOrdersPaginated
} from '../../data/index.js'

describe('OrderService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getOrders', () => {
    it('should get orders with pagination', async () => {
      const mockData = {
        list: [{ id: 'o1', productName: '测试订单' }],
        total: 10
      }
      vi.mocked(getOrdersPaginated).mockResolvedValue(mockData)

      const result = await orderService.getOrders({ page: 1, pageSize: 20 })

      expect(result).toEqual(mockData)
      expect(getOrdersPaginated).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20
      })
    })
  })

  describe('createOrder', () => {
    it('should get orders with filters', async () => {
      const mockData = { list: [], total: 0 }
      vi.mocked(getOrdersPaginated).mockResolvedValue(mockData)

      await orderService.getOrders({
        page: 2,
        pageSize: 15,
        userId: 'u1',
        managerId: 'm1',
        status: 'pending'
      })

      expect(getOrdersPaginated).toHaveBeenCalledWith({
        page: 2,
        pageSize: 15,
        userId: 'u1',
        managerId: 'm1',
        status: 'pending'
      })
    })
  })
})
