/**
 * 客户管理分页：表格与卡片视图各自的页大小、切换视图时重置页码并重新取数。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, msgError } = vi.hoisted(() => ({
  get: vi.fn(),
  msgError: vi.fn(),
}))

vi.mock('@promo/shared/utils/request', () => ({
  get,
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}))
vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: msgError, info: vi.fn(), warning: vi.fn() },
  ElMessageBox: { confirm: vi.fn() },
}))

import { useCustomerAdmin } from '../composables/useCustomerAdmin'
import { CARD_PAGE_SIZE, CUSTOMER_VIEW_MODE_KEY, TABLE_PAGE_SIZE } from '../utils'

const ok = (data: unknown) => ({ code: 0, message: 'ok', data })

beforeEach(() => {
  window.localStorage.clear()
  get.mockReset()
  get.mockResolvedValue(ok({ list: [], total: 0 }))
  msgError.mockReset()
})

describe('useCustomerAdmin 视图与分页', () => {
  it('表格视图默认每页 10 条；已记住卡片视图时默认每页 12 条', () => {
    const table = useCustomerAdmin()
    expect(table.pagination.pageSize).toBe(TABLE_PAGE_SIZE)
    expect([...table.pageSizes.value]).toEqual([10, 20, 50, 100])

    window.localStorage.setItem(CUSTOMER_VIEW_MODE_KEY, 'card')
    const card = useCustomerAdmin()
    expect(card.pagination.pageSize).toBe(CARD_PAGE_SIZE)
    expect([...card.pageSizes.value]).toEqual([12, 24, 48])
  })

  it('切到卡片视图：页大小重置为 12、回到第 1 页并按新分页重新取数', async () => {
    get.mockResolvedValue(ok({ list: [], total: 37 }))
    const { pagination, pageSizes, setViewMode } = useCustomerAdmin()
    pagination.page = 3
    pagination.pageSize = 50

    setViewMode('card')

    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(1))
    expect(pagination.pageSize).toBe(CARD_PAGE_SIZE)
    expect(pagination.page).toBe(1)
    expect(get.mock.calls[0][1]).toMatchObject({ page: 1, pageSize: 12 })
    expect([...pageSizes.value]).toEqual([12, 24, 48])
    expect(pagination.total).toBe(37)
    expect(window.localStorage.getItem(CUSTOMER_VIEW_MODE_KEY)).toBe('card')
  })

  it('从卡片视图切回表格：页大小重置为 10、回到第 1 页', async () => {
    window.localStorage.setItem(CUSTOMER_VIEW_MODE_KEY, 'card')
    const { pagination, pageSizes, setViewMode } = useCustomerAdmin()
    pagination.page = 2

    setViewMode('table')

    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(1))
    expect(pagination.pageSize).toBe(TABLE_PAGE_SIZE)
    expect(pagination.page).toBe(1)
    expect(get.mock.calls[0][1]).toMatchObject({ page: 1, pageSize: 10 })
    expect([...pageSizes.value]).toEqual([10, 20, 50, 100])
  })

  it('重复选择当前视图不会重复请求', () => {
    const { setViewMode } = useCustomerAdmin()

    setViewMode('table')

    expect(get).not.toHaveBeenCalled()
  })

  it('切换视图保留筛选条件，只重置分页', async () => {
    const { searchKeyword, pagination, setViewMode } = useCustomerAdmin()
    searchKeyword.value = '云帆'
    pagination.page = 2

    setViewMode('card')

    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(1))
    expect(get.mock.calls[0][1]).toMatchObject({ keyword: '云帆', page: 1, pageSize: 12 })
  })
})
