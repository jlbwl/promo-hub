/**
 * 客户列表接口：排序参数透传到数据层、列表项下发收款码地址。
 * 数据层与审计/图片等重模块全部 mock，只验证控制器自身的参数与响应整形。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'

vi.mock('../../data/index.js', () => ({
  readCustomersPaged: vi.fn(),
  readCustomersForExport: vi.fn(),
  readCustomerById: vi.fn(),
  readCustomerByGroupName: vi.fn(),
  readCustomersByGroupNames: vi.fn(),
  insertCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  deleteCustomer: vi.fn(),
  applyCustomerImport: vi.fn(),
}))
vi.mock('../../utils/imageProcessor.js', () => ({ validateImageFile: vi.fn() }))
vi.mock('../../utils/auditLog.js', () => ({ logAdminOperation: vi.fn() }))
vi.mock('../../utils/auditDetail.js', () => ({ buildAuditDetail: vi.fn() }))
vi.mock('../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), logError: vi.fn() },
}))

import { readCustomersPaged } from '../../data/index.js'
import { getCustomers } from '../customer.controller.js'

const mockReadCustomersPaged = vi.mocked(readCustomersPaged)

const makeRes = () => {
  const res = { status: vi.fn(), json: vi.fn() }
  res.status.mockReturnValue(res)
  return res as unknown as Response & typeof res
}

const makeReq = (query: Record<string, string>): Request =>
  ({ query, body: {}, params: {} }) as unknown as Request

const customerRecord = {
  id: 'cust_1',
  groupName: '10302032云帆科技',
  contactName: '张三',
  payMethod: 'wechat',
  cardNo: '卡A',
  qrCodeUrl: '/uploads/qrcodes/qr_1.jpg',
  searchCount: 8,
  status: 'active',
  source: 'manual',
  createdAt: '2026-11-01 10:00:00',
  updatedAt: '2026-11-02 10:00:00',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockReadCustomersPaged.mockResolvedValue({ list: [customerRecord], total: 1 })
})

describe('GET /admin/customers', () => {
  it('把 sortBy=searchCount / sortOrder=asc 透传给数据层', async () => {
    const res = makeRes()
    await getCustomers(makeReq({ page: '2', pageSize: '20', sortBy: 'searchCount', sortOrder: 'asc' }), res, vi.fn())

    expect(mockReadCustomersPaged).toHaveBeenCalledWith({
      keyword: undefined,
      payMethod: undefined,
      status: undefined,
      sortBy: 'searchCount',
      sortOrder: 'asc',
      page: 2,
      pageSize: 20,
    })
  })

  it('白名单外的排序字段与方向被忽略，走默认排序', async () => {
    const res = makeRes()
    await getCustomers(makeReq({ sortBy: 'groupName', sortOrder: 'sideways' }), res, vi.fn())

    const params = mockReadCustomersPaged.mock.calls[0][0] as Record<string, unknown>
    expect(params.sortBy).toBeUndefined()
    expect(params.sortOrder).toBeUndefined()
  })

  it('列表项下发 qrCodeUrl，并用它推导 hasQrCode', async () => {
    const res = makeRes()
    const next = vi.fn()
    await getCustomers(makeReq({}), res, next)
    if (next.mock.calls.length) throw next.mock.calls[0][0]

    const body = res.json.mock.calls[0][0]
    expect(body.code).toBe(0)
    expect(body.data.list[0]).toMatchObject({
      id: 'cust_1',
      qrCodeUrl: '/uploads/qrcodes/qr_1.jpg',
      hasQrCode: true,
    })
  })

  it('没有收款码时 qrCodeUrl 为空串且 hasQrCode 为 false', async () => {
    mockReadCustomersPaged.mockResolvedValue({
      list: [{ ...customerRecord, qrCodeUrl: null }],
      total: 1,
    })
    const res = makeRes()
    await getCustomers(makeReq({}), res, vi.fn())

    const body = res.json.mock.calls[0][0]
    expect(body.data.list[0].qrCodeUrl).toBe('')
    expect(body.data.list[0].hasQrCode).toBe(false)
  })
})
