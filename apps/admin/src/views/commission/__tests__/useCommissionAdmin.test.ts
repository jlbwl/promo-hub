/**
 * useCommissionAdmin 审核日期筛选单元测试：参数透传与重置清空
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, msgError } = vi.hoisted(() => ({
  get: vi.fn(),
  msgError: vi.fn(),
}))

vi.mock('@promo/shared/utils/request', () => ({ get, put: vi.fn(), del: vi.fn() }))
vi.mock('@promo/shared/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: msgError, info: vi.fn(), warning: vi.fn() },
}))

import { useCommissionAdmin } from '../composables/useCommissionAdmin'

const ok = (data: unknown) => ({ code: 0, message: 'ok', data })

describe('useCommissionAdmin 审核日期筛选', () => {
  beforeEach(() => {
    get.mockReset()
    get.mockResolvedValue(ok({ list: [], total: 0 }))
  })

  it('选择日期范围时按 reviewedStartDate / reviewedEndDate 透传', async () => {
    const { filterReviewDate, fetchData } = useCommissionAdmin()
    filterReviewDate.value = ['2026-11-01', '2026-11-13']

    await fetchData()

    const params = get.mock.calls[0][1]
    expect(params).toMatchObject({
      reviewedStartDate: '2026-11-01',
      reviewedEndDate: '2026-11-13',
    })
  })

  it('未选择日期时不传审核日期参数', async () => {
    const { fetchData } = useCommissionAdmin()

    await fetchData()

    const params = get.mock.calls[0][1]
    expect(params).not.toHaveProperty('reviewedStartDate')
    expect(params).not.toHaveProperty('reviewedEndDate')
  })

  it('重置后清空审核日期并重新请求全量', async () => {
    const { filterReviewDate, fetchData, handleReset } = useCommissionAdmin()
    filterReviewDate.value = ['2026-11-01', '2026-11-13']
    await fetchData()

    handleReset()

    expect(filterReviewDate.value).toBeNull()
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(2))
    const lastParams = get.mock.calls[1][1]
    expect(lastParams).not.toHaveProperty('reviewedStartDate')
    expect(lastParams).not.toHaveProperty('reviewedEndDate')
  })
})
