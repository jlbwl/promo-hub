import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock 内存数据读写层：避免测试读取/写入真实 data 目录
vi.mock('../_shared.js', () => ({
  readFileData: vi.fn(),
  writeFileData: vi.fn(),
}))

import { readFileData } from '../_shared.js'
import { getOrdersPaginated } from '../orders.js'

const mockReadFileData = vi.mocked(readFileData)

const createOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 'o_1',
  userId: '',
  productId: 'p_1',
  // 通用名称与具体产品名分别落在 productName / optionLabel
  productName: '平安不限三任意卡-数据',
  optionLabel: '平安不限三任意卡-1163',
  userName: '吴丽娟',
  userPhone: '19100006286',
  productPrice: 12,
  status: 'pending',
  teamName: '',
  createdAt: '2026-11-12 11:25:00',
  deleted: 0,
  ...overrides,
}) as never

describe('data-memory getOrdersPaginated 审核日期筛选', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const withReviewedAt = (id: string, reviewedAt?: string) =>
    createOrder({ id, reviewedAt })

  const ids = (list: { id?: string }[]) => list.map((o) => o.id)

  it('单日筛选只命中当天审核的订单', async () => {
    mockReadFileData.mockReturnValue([
      withReviewedAt('same_day', '2026-11-12 09:00:00'),
      withReviewedAt('prev_day', '2026-11-11 23:59:59'),
      withReviewedAt('next_day', '2026-11-13 00:00:00'),
    ])

    const result = await getOrdersPaginated({ reviewedStartDate: '2026-11-12', reviewedEndDate: '2026-11-12' })

    expect(result.total).toBe(1)
    expect(ids(result.list)).toEqual(['same_day'])
  })

  it('区间筛选包含起止自然日', async () => {
    mockReadFileData.mockReturnValue([
      withReviewedAt('start_boundary', '2026-11-10 00:00:00'),
      withReviewedAt('inside', '2026-11-11 12:30:00'),
      withReviewedAt('end_boundary', '2026-11-12 23:59:59'),
      withReviewedAt('out_of_range', '2026-11-13 00:00:00'),
    ])

    const result = await getOrdersPaginated({ reviewedStartDate: '2026-11-10', reviewedEndDate: '2026-11-12' })

    expect(result.total).toBe(3)
    expect(ids(result.list).sort()).toEqual(['end_boundary', 'inside', 'start_boundary'])
  })

  it('无审核时间的历史订单不会命中审核日期筛选', async () => {
    mockReadFileData.mockReturnValue([
      withReviewedAt('no_reviewed_at', undefined),
      withReviewedAt('empty_reviewed_at', ''),
      withReviewedAt('matched', '2026-11-12 10:00:00'),
    ])

    const result = await getOrdersPaginated({ reviewedStartDate: '2026-11-12', reviewedEndDate: '2026-11-12' })

    expect(result.total).toBe(1)
    expect(ids(result.list)).toEqual(['matched'])
  })
})

describe('data-memory getOrdersPaginated 关键词模糊匹配', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('片段关键词同时命中具体产品名（optionLabel）与通用产品名（productName）', async () => {
    mockReadFileData.mockReturnValue([createOrder()])

    const bySpecificName = await getOrdersPaginated({ keyword: '1163' })
    const byGenericName = await getOrdersPaginated({ keyword: '数据' })
    const notMatched = await getOrdersPaginated({ keyword: '9999' })

    expect(bySpecificName.total).toBe(1)
    expect(byGenericName.total).toBe(1)
    expect(notMatched.total).toBe(0)
  })
})
