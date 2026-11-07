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
  updateOrderIfStatus: vi.fn()
}))

// Mock 数据库连接（订单创建的库存扣减 SQL）
vi.mock('../../db.js', () => ({
  query: vi.fn().mockResolvedValue([{ affectedRows: 1 }])
}))

import {
  readProducts,
  readOrders,
  readOrder,
  getOrdersPaginated,
  readUser,
  insertOrder,
  readDeletedOrders,
  purgeOrder,
  applyOrderReview,
  updateOrderIfStatus
} from '../../data/index.js'
import { query } from '../../db.js'

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

  describe('createOrder 姓名手机号必填校验', () => {
    const mockProduct = {
      id: 'p1',
      status: 'published',
      managerId: 'm1',
      title: '测试产品',
      price: 9,
      stock: undefined
    }
    const baseOrder = { productId: 'p1', userId: 'u1' }

    beforeEach(() => {
      vi.mocked(readProducts).mockResolvedValue([mockProduct] as never)
    })

    it('缺少姓名时拒绝创建，且不扣减库存', async () => {
      await expect(
        orderService.createOrder({ ...baseOrder, userName: '  ', userPhone: '13400005565' })
      ).rejects.toThrow('请填写姓名')
      expect(query).not.toHaveBeenCalled()
      expect(insertOrder).not.toHaveBeenCalled()
    })

    it('手机号缺失或格式错误时拒绝创建', async () => {
      await expect(
        orderService.createOrder({ ...baseOrder, userName: '张三', userPhone: '' })
      ).rejects.toThrow('请填写正确的手机号')
      await expect(
        orderService.createOrder({ ...baseOrder, userName: '张三', userPhone: '12345' })
      ).rejects.toThrow('请填写正确的手机号')
      expect(insertOrder).not.toHaveBeenCalled()
    })

    it('姓名手机号合法时正常创建，入库值为去除首尾空格的客户信息', async () => {
      vi.mocked(readUser).mockResolvedValue({ teamName: '测试团队' } as never)
      await orderService.createOrder({
        ...baseOrder,
        userName: '  张三  ',
        userPhone: ' 13400005565 '
      })
      expect(insertOrder).toHaveBeenCalledWith(
        expect.objectContaining({ userName: '张三', userPhone: '13400005565', userId: 'u1' })
      )
    })
  })

  describe('purgeOrder 永久删除', () => {
    it('本人回收站中的订单可被物理删除', async () => {
      vi.mocked(readDeletedOrders).mockResolvedValue([
        { id: 'o1', userId: 'u1' } as never
      ])
      await orderService.purgeOrder('o1', 'u1')
      expect(purgeOrder).toHaveBeenCalledWith('o1')
    })

    it('订单不在本人回收站时拒绝删除', async () => {
      vi.mocked(readDeletedOrders).mockResolvedValue([])
      await expect(orderService.purgeOrder('oX', 'u1')).rejects.toThrow('订单不存在或不在回收站')
      expect(purgeOrder).not.toHaveBeenCalled()
    })
  })

  describe('reviewOrder / settleOrder 订单归属校验', () => {
    it('经理不能审核其他团队的订单', async () => {
      vi.mocked(readOrder).mockResolvedValue({ id: 'o1', managerId: 'm2', status: 'pending' } as never)

      await expect(
        orderService.reviewOrder('o1', { action: 'approve', operator: { id: 'm1', role: 'manager' } })
      ).rejects.toMatchObject({ code: 403 })
      expect(applyOrderReview).not.toHaveBeenCalled()
    })

    it('经理不能结算其他团队的订单', async () => {
      vi.mocked(readOrder).mockResolvedValue({ id: 'o1', managerId: 'm2', status: 'approved' } as never)

      await expect(
        orderService.settleOrder('o1', { action: 'pending_payment', operator: { id: 'm1', role: 'manager' } })
      ).rejects.toMatchObject({ code: 403 })
      expect(updateOrderIfStatus).not.toHaveBeenCalled()
    })

    it('经理可审核本团队订单，管理员不受归属限制', async () => {
      vi.mocked(applyOrderReview).mockResolvedValue(true)

      vi.mocked(readOrder).mockResolvedValueOnce({ id: 'o1', managerId: 'm1', status: 'pending' } as never)
      await orderService.reviewOrder('o1', { action: 'approve', operator: { id: 'm1', role: 'manager' } })

      vi.mocked(readOrder).mockResolvedValueOnce({ id: 'o2', managerId: 'm2', status: 'pending' } as never)
      await orderService.reviewOrder('o2', { action: 'approve', operator: { id: 'a1', role: 'admin' } })

      expect(applyOrderReview).toHaveBeenCalledTimes(2)
    })
  })
})
