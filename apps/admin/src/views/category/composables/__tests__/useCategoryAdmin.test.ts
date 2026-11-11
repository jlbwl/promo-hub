/**
 * useCategoryAdmin 一键派单导出单元测试：分页拉全量、总量不完整时阻断导出
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Product } from '@promo/shared/types'

const {
  get,
  createDispatchWorkbook,
  appendQrCodeToWorkbook,
  downloadWorkbook,
  msgSuccess,
  msgError,
  msgInfo,
} = vi.hoisted(() => ({
  get: vi.fn(),
  createDispatchWorkbook: vi.fn(),
  appendQrCodeToWorkbook: vi.fn(),
  downloadWorkbook: vi.fn(),
  msgSuccess: vi.fn(),
  msgError: vi.fn(),
  msgInfo: vi.fn(),
}))

vi.mock('@promo/shared/utils/request', () => ({ get, put: vi.fn(), del: vi.fn() }))
vi.mock('@promo/shared/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('element-plus', () => ({
  ElMessage: { success: msgSuccess, error: msgError, info: msgInfo, warning: vi.fn() },
  ElMessageBox: { confirm: vi.fn() },
}))
vi.mock('../../utils', () => ({
  createDispatchWorkbook,
  appendQrCodeToWorkbook,
  downloadWorkbook,
}))

import { useCategoryAdmin } from '../useCategoryAdmin'

const ok = (data: unknown) => ({ code: 0, message: 'ok', data })

const makeProduct = (index: number): Product => ({
  id: `p${index}`,
  title: `产品${index}`,
  category: 'c1',
  price: 10,
  description: '',
}) as Product

/** 按后端行为分页返回产品：单页最多 100 条 */
function mockProducts(total: number, options: { stopAfterPages?: number } = {}) {
  get.mockImplementation((url: string, params?: Record<string, unknown>) => {
    if (url === '/products') {
      const page = Number(params?.page || 1)
      const pageSize = Number(params?.pageSize || 100)
      const reachedLimit = options.stopAfterPages !== undefined && page > options.stopAfterPages
      const start = (page - 1) * pageSize
      const count = reachedLimit ? 0 : Math.min(pageSize, Math.max(total - start, 0))
      const list = Array.from({ length: count }, (_, i) => makeProduct(start + i))
      return Promise.resolve(ok({ list, total, page, pageSize }))
    }
    if (url === '/categories') return Promise.resolve(ok({ list: [] }))
    if (url === '/admin/qrcodes/default') return Promise.resolve(ok(null))
    return Promise.resolve(ok(null))
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  createDispatchWorkbook.mockResolvedValue({ marker: 'workbook' })
  downloadWorkbook.mockResolvedValue(undefined)
})

describe('useCategoryAdmin - exportProducts', () => {
  it('产品超过 100 条时循环分页拉全量，导出条数完整', async () => {
    mockProducts(250)

    const { exportProducts } = useCategoryAdmin()
    await exportProducts('fallback-qr')

    const productCalls = get.mock.calls.filter(call => call[0] === '/products')
    expect(productCalls.map(call => call[1]?.page)).toEqual([1, 2, 3])
    expect(productCalls.every(call => call[1]?.pageSize === 100)).toBe(true)
    expect(productCalls[0][1]).toMatchObject({ adminMode: 'true', status: 'published' })

    expect(createDispatchWorkbook).toHaveBeenCalledTimes(1)
    expect(createDispatchWorkbook.mock.calls[0][0]).toHaveLength(250)
    expect(downloadWorkbook).toHaveBeenCalledTimes(1)
    expect(msgSuccess).toHaveBeenCalledWith('派单表导出成功')
  })

  it('实际拉取条数小于 total 时阻断导出并明确提示，不生成残缺派单表', async () => {
    // total 声称 250，但第 2 页起返回空，模拟后端数据异常/被截断
    mockProducts(250, { stopAfterPages: 1 })

    const { exportProducts } = useCategoryAdmin()
    await exportProducts('fallback-qr')

    expect(createDispatchWorkbook).not.toHaveBeenCalled()
    expect(downloadWorkbook).not.toHaveBeenCalled()
    expect(msgError).toHaveBeenCalledTimes(1)
    expect(String(msgError.mock.calls[0][0])).toContain('未拉取完整')
    expect(String(msgError.mock.calls[0][0])).toContain('100/250')
  })

  it('没有任何开放产品时仅提示，不生成文件', async () => {
    mockProducts(0)

    const { exportProducts } = useCategoryAdmin()
    await exportProducts('fallback-qr')

    expect(msgInfo).toHaveBeenCalledWith('暂无开放的产品')
    expect(createDispatchWorkbook).not.toHaveBeenCalled()
    expect(downloadWorkbook).not.toHaveBeenCalled()
  })
})
