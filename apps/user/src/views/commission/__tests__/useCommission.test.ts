/**
 * useCommission 单元测试：订单加载失败必须暴露错误态，而不是伪装成空列表
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { useCommission } from '../composables/useCommission'
import { get } from '@promo/shared/utils/request'
import type { Order } from '@promo/shared/types'

vi.mock('@promo/shared/utils/request', () => ({
  get: vi.fn(),
  post: vi.fn(),
  del: vi.fn(),
}))

vi.mock('vant', () => ({
  showToast: vi.fn(),
  showConfirmDialog: vi.fn(),
}))

type CommissionApi = ReturnType<typeof useCommission>

let api!: CommissionApi
const mountHost = () =>
  mount(
    defineComponent({
      setup() {
        api = useCommission()
        return () => h('div')
      },
    }),
  )

const order: Order = {
  id: 'o_1',
  productId: 'p_1',
  productName: '测试产品',
  productPrice: 100,
  status: 'pending',
  userName: '张三',
  userPhone: '13800138000',
  userId: 'u_1',
  createdAt: '',
  updatedAt: '',
} as unknown as Order

const mockGet = vi.mocked(get)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  localStorage.setItem('user_info', JSON.stringify({ id: 'u_1' }))
})

describe('订单加载失败', () => {
  it('列表请求失败时标记错误态且不写入假数据', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/orders/stats') {
        return Promise.resolve({ code: 0, message: 'ok', data: {} })
      }
      return Promise.reject(new Error('network down'))
    })

    mountHost()
    await flushPromises()

    expect(api.loadError.value).toBe(true)
    expect(api.records.value).toEqual([])
  })

  it('重试成功后清除错误态并展示数据', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/orders/stats') {
        return Promise.resolve({ code: 0, message: 'ok', data: {} })
      }
      return Promise.reject(new Error('network down'))
    })

    mountHost()
    await flushPromises()
    expect(api.loadError.value).toBe(true)

    mockGet.mockImplementation((url: string) => {
      if (url === '/orders/stats') {
        return Promise.resolve({ code: 0, message: 'ok', data: {} })
      }
      return Promise.resolve({ code: 0, message: 'ok', data: { list: [order], total: 1 } })
    })
    await api.retryLoad()

    expect(api.loadError.value).toBe(false)
    expect(api.records.value).toHaveLength(1)
  })
})
