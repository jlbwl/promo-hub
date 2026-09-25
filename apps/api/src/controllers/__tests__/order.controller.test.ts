import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response } from 'express'

// Mock 依赖模块（避免真实 MySQL / 文件系统）
vi.mock('../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    logError: vi.fn(),
  },
}))

vi.mock('../../services/index.js', () => ({
  orderService: {
    createOrder: vi.fn(),
    getOrders: vi.fn(),
    getOrderUserOptions: vi.fn(),
    adminDeleteOrder: vi.fn(),
    deleteUserOrder: vi.fn(),
    getDeletedOrders: vi.fn(),
    restoreOrder: vi.fn(),
    submitFundAccount: vi.fn(),
    reviewOrder: vi.fn(),
    settleOrder: vi.fn(),
    updateOrderTeamName: vi.fn(),
  },
}))

vi.mock('../../data/index.js', () => ({
  insertOperationLog: vi.fn(),
}))

vi.mock('../../data-memory.js', () => ({
  getOrdersPaginated: vi.fn(),
}))

import { orderService } from '../../services/index.js'
import { insertOperationLog } from '../../data/index.js'
import { getOrdersPaginated, type OrderRow } from '../../data-memory.js'
import {
  createOrder,
  getOrders,
  adminDeleteOrder,
  deleteUserOrder,
  restoreUserOrder,
  submitFundAccount,
  reviewOrder,
  settleOrder,
} from '../order.controller.js'

const makeReq = (overrides: Partial<Request> & { user?: unknown } = {}): Request =>
  ({
    body: {},
    query: {},
    params: {},
    user: undefined,
    ...overrides,
  }) as unknown as Request

const makeRes = (): Response => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  return res
}

const jsonPayload = (res: Response) =>
  vi.mocked(res.json).mock.calls[0][0] as {
    code: number
    message: string
    data: unknown
  }

describe('order.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createOrder 做单归属模型', () => {
    const orderResult = {
      order: { id: 'o_1' } as unknown as OrderRow,
      remainingStock: 9,
    }

    it('登录用户做单归属本人（userId 取自会话，防伪造）', async () => {
      vi.mocked(orderService.createOrder).mockResolvedValue(orderResult)
      const req = makeReq({
        body: { productId: 'p_1' },
        user: { id: 'u_self', role: 'user' },
      })

      await createOrder(req, makeRes())

      expect(orderService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u_self', employeeId: undefined })
      )
    })

    it('员工代做单归属关联用户（userId=关联用户, employeeId=员工）', async () => {
      vi.mocked(orderService.createOrder).mockResolvedValue(orderResult)
      const req = makeReq({
        body: { productId: 'p_1' },
        user: { id: 'e_1', role: 'employee', userId: 'u_boss' },
      })

      await createOrder(req, makeRes())

      expect(orderService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u_boss', employeeId: 'e_1' })
      )
    })

    it('员工未关联用户应返回 403', async () => {
      const res = makeRes()
      const req = makeReq({
        body: { productId: 'p_1' },
        user: { id: 'e_1', role: 'employee' },
      })

      await createOrder(req, res)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(jsonPayload(res).message).toBe('员工账户未关联用户，无法做单')
    })

    it('访客做单且无 sharerId 时返回 401（不允许生成无归属订单）', async () => {
      const res = makeRes()
      const req = makeReq({ body: { productId: 'p_1', userPhone: '13800000001' } })

      await createOrder(req, res)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(jsonPayload(res).message).toBe('请先登录后再下单')
      expect(orderService.createOrder).not.toHaveBeenCalled()
    })

    it('客户端伪造 userId/userPhone 不影响归属（强制取会话身份）', async () => {
      vi.mocked(orderService.createOrder).mockResolvedValue(orderResult)
      const req = makeReq({
        body: { productId: 'p_1', userId: 'u_fake', userPhone: '13800000002' },
        user: { id: 'u_self', role: 'user' },
      })

      await createOrder(req, makeRes())

      expect(orderService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u_self', employeeId: undefined })
      )
    })

    it('访客通过分享链接做单归属分享者', async () => {
      vi.mocked(orderService.createOrder).mockResolvedValue(orderResult)
      const req = makeReq({
        body: { productId: 'p_1', sharerId: 'u_sharer' },
      })

      await createOrder(req, makeRes())

      expect(orderService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u_sharer' })
      )
    })

    it('缺少产品ID应返回 400', async () => {
      const res = makeRes()

      await createOrder(makeReq({ body: {} }), res)

      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('service 抛错应透传错误码', async () => {
      vi.mocked(orderService.createOrder).mockRejectedValue(
        Object.assign(new Error('产品不存在'), { code: 404 })
      )
      const res = makeRes()

      await createOrder(
        makeReq({ body: { productId: 'p_x' }, user: { id: 'u_1', role: 'user' } }),
        res
      )

      expect(res.status).toHaveBeenCalledWith(404)
      expect(jsonPayload(res).message).toBe('产品不存在')
    })
  })

  describe('getOrders P1-7 越权防护', () => {
    const pageResult = { list: [], total: 0 }

    it('未登录应返回 401', async () => {
      const res = makeRes()

      await getOrders(makeReq({ user: undefined }), res)

      expect(res.status).toHaveBeenCalledWith(401)
    })

    it('user 角色强制只查自己的订单（忽略客户端伪造的 userId）', async () => {
      vi.mocked(orderService.getOrders).mockResolvedValue(pageResult)
      const req = makeReq({
        query: { userId: 'u_victim' }, // 尝试越权
        user: { id: 'u_self', role: 'user' },
      })

      await getOrders(req, makeRes())

      expect(orderService.getOrders).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u_self' })
      )
    })

    it('manager 角色强制只查自己团队（忽略客户端伪造的 managerId）', async () => {
      vi.mocked(orderService.getOrders).mockResolvedValue(pageResult)
      const req = makeReq({
        query: { managerId: 'm_victim' },
        user: { id: 'm_self', role: 'manager' },
      })

      await getOrders(req, makeRes())

      expect(orderService.getOrders).toHaveBeenCalledWith(
        expect.objectContaining({ managerId: 'm_self', userId: undefined })
      )
    })

    it('employee 角色强制只查所属用户订单', async () => {
      vi.mocked(orderService.getOrders).mockResolvedValue(pageResult)
      const req = makeReq({
        user: { id: 'e_1', role: 'employee', userId: 'u_boss' },
      })

      await getOrders(req, makeRes())

      expect(orderService.getOrders).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u_boss', employeeId: 'e_1' })
      )
    })

    it('employee 未关联用户应返回 403', async () => {
      const res = makeRes()

      await getOrders(
        makeReq({ user: { id: 'e_1', role: 'employee' } }),
        res
      )

      expect(res.status).toHaveBeenCalledWith(403)
    })

    it('admin 角色可透传筛选参数查询全部', async () => {
      vi.mocked(orderService.getOrders).mockResolvedValue(pageResult)
      const req = makeReq({
        query: { userId: 'u_any', status: 'pending' },
        user: { id: 'a_1', role: 'admin' },
      })

      await getOrders(req, makeRes())

      expect(orderService.getOrders).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u_any', status: 'pending' })
      )
    })

    it('page 参数无效应返回 400', async () => {
      const res = makeRes()

      await getOrders(
        makeReq({ query: { page: '0' }, user: { id: 'u_1', role: 'user' } }),
        res
      )

      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('数据库失败应降级到内存分页', async () => {
      vi.mocked(orderService.getOrders).mockRejectedValue(new Error('db down'))
      vi.mocked(getOrdersPaginated).mockResolvedValue(pageResult)
      const res = makeRes()

      await getOrders(
        makeReq({ user: { id: 'u_1', role: 'user' } }),
        res
      )

      expect(getOrdersPaginated).toHaveBeenCalledTimes(1)
      const payload = jsonPayload(res)
      expect(payload.code).toBe(0)
      expect(payload.message).toBe('获取成功')
    })
  })

  describe('adminDeleteOrder 管理端删除', () => {
    it('成功删除并记录操作日志', async () => {
      const res = makeRes()

      await adminDeleteOrder(
        makeReq({
          params: { id: 'o_1' },
          body: { reason: '测试', adminId: 'a_1', adminPhone: '13700000000', adminName: '管理员' },
        }),
        res
      )

      expect(orderService.adminDeleteOrder).toHaveBeenCalledWith('o_1', {
        reason: '测试',
        adminId: 'a_1',
        adminPhone: '13700000000',
        adminName: '管理员',
      })
      expect(insertOperationLog).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: 'a_1',
          operationType: 'delete',
          targetType: 'order',
          targetId: 'o_1',
        })
      )
      expect(jsonPayload(res).code).toBe(0)
    })

    it('service 抛错应透传错误码', async () => {
      vi.mocked(orderService.adminDeleteOrder).mockRejectedValue(
        Object.assign(new Error('订单不存在'), { code: 404 })
      )
      const res = makeRes()

      await adminDeleteOrder(
        makeReq({ params: { id: 'o_x' }, body: {} }),
        res
      )

      expect(res.status).toHaveBeenCalledWith(404)
      expect(insertOperationLog).not.toHaveBeenCalled()
    })
  })

  describe('deleteUserOrder / restoreUserOrder 回收站', () => {
    it('软删除透传订单ID与用户ID', async () => {
      const res = makeRes()

      await deleteUserOrder(
        makeReq({ params: { id: 'o_1' }, body: { userId: 'u_1' } }),
        res
      )

      expect(orderService.deleteUserOrder).toHaveBeenCalledWith('o_1', 'u_1')
      expect(jsonPayload(res).message).toBe('已移至回收站')
    })

    it('恢复透传订单ID与用户ID', async () => {
      const res = makeRes()

      await restoreUserOrder(
        makeReq({ params: { id: 'o_1' }, body: { userId: 'u_1' } }),
        res
      )

      expect(orderService.restoreOrder).toHaveBeenCalledWith('o_1', 'u_1')
      expect(jsonPayload(res).message).toBe('恢复成功')
    })
  })

  describe('submitFundAccount 提交资金号', () => {
    it('缺少必要参数应返回 400', async () => {
      const res = makeRes()

      await submitFundAccount(
        makeReq({ body: { userId: 'u_1', orderId: 'o_1' } }),
        res
      )

      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('成功透传到 service', async () => {
      const res = makeRes()

      await submitFundAccount(
        makeReq({ body: { userId: 'u_1', orderId: 'o_1', fundAccount: 'FA123' } }),
        res
      )

      expect(orderService.submitFundAccount).toHaveBeenCalledWith('o_1', 'u_1', 'FA123')
      expect(jsonPayload(res).code).toBe(0)
    })
  })

  describe('reviewOrder / settleOrder 审核结算', () => {
    it.each([
      ['无效操作', { action: 'delete' }],
      ['缺少操作', {}],
    ])('%s 应返回 400', async (_name, body) => {
      const res = makeRes()

      await reviewOrder(makeReq({ params: { id: 'o_1' }, body }), res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(orderService.reviewOrder).not.toHaveBeenCalled()
    })

    it('审核通过透传到 service', async () => {
      const res = makeRes()

      await reviewOrder(
        makeReq({ params: { id: 'o_1' }, body: { action: 'approve', reason: 'ok' } }),
        res
      )

      expect(orderService.reviewOrder).toHaveBeenCalledWith('o_1', {
        action: 'approve',
        reason: 'ok',
      })
      expect(jsonPayload(res).message).toBe('审核通过')
    })

    it('无效结算操作应返回 400', async () => {
      const res = makeRes()

      await settleOrder(
        makeReq({ params: { id: 'o_1' }, body: { action: 'cancel' } }),
        res
      )

      expect(res.status).toHaveBeenCalledWith(400)
    })

    it('结算到待发放透传到 service', async () => {
      const res = makeRes()

      await settleOrder(
        makeReq({ params: { id: 'o_1' }, body: { action: 'pending_payment' } }),
        res
      )

      expect(orderService.settleOrder).toHaveBeenCalledWith('o_1', {
        action: 'pending_payment',
      })
      expect(jsonPayload(res).message).toBe('已添加到待发放')
    })
  })
})
