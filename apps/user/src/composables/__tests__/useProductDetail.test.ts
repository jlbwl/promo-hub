/**
 * useProductDetail 单元测试：详情加载与字段回填、分享模式判定、分享二维码
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useProductDetail } from '../useProductDetail'
import { get } from '@promo/shared/utils/request'
import { showToast } from 'vant'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { Product } from '@promo/shared/types'

// useUser 按登录态返回身份 id，用可变状态驱动（vi.mock 工厂被提升，需 vi.hoisted）
// qrcode 的 toDataURL 有回调重载，用显式签名的 mock 避免 vi.mocked 落到 void 重载
const { state, toDataURL } = vi.hoisted(() => ({
  state: { userId: '' },
  toDataURL: vi.fn<(text: string, options?: { width: number; margin: number }) => Promise<string>>(),
}))

vi.mock('@promo/shared/utils/request', () => ({ get: vi.fn() }))
vi.mock('vant', () => ({ showToast: vi.fn() }))
vi.mock('qrcode', () => ({ default: { toDataURL } }))
vi.mock('@/composables/useLocalStorage', () => ({
  useUser: () => ({ getUserId: () => state.userId }),
}))

// route 由视图注入，测试用最小结构构造（composable 只读 params.id 与 query.share）
const makeRoute = (query: Record<string, string> = {}): RouteLocationNormalizedLoaded =>
  ({ params: { id: 'p_1' }, query }) as unknown as RouteLocationNormalizedLoaded

const fullDetail: Product & { sales?: number } = {
  id: 'p_1',
  title: '产品A',
  description: '详情描述',
  coverImage: 'https://x/cover.png',
  images: ['https://x/1.png', 'https://x/2.png'],
  price: 99.5,
  stock: 5,
  sales: 10,
  category: 'test',
  status: 'published',
  options: [{ label: 'A套餐' }, { label: 'B套餐' }],
  requireName: true,
  requirePhone: true,
  createdAt: '2026-01-01 00:00:00',
}

beforeEach(() => {
  vi.clearAllMocks()
  state.userId = ''
  document.title = ''
  localStorage.clear()
})

describe('fetchProductDetail 成功路径', () => {
  it('回填产品数据并默认选中第一个选项', async () => {
    vi.mocked(get).mockResolvedValue({ code: 0, message: 'ok', data: fullDetail })
    const detail = useProductDetail(makeRoute())

    await detail.fetchProductDetail()

    expect(get).toHaveBeenCalledWith('/products/p_1')
    expect(detail.product.title).toBe('产品A')
    expect(detail.product.price).toBe('99.5')
    expect(detail.product.stock).toBe(5)
    expect(detail.product.sales).toBe('10')
    expect(detail.product.images).toEqual(['https://x/1.png', 'https://x/2.png'])
    expect(detail.product.description).toBe('详情描述')
    expect(detail.product.options).toEqual([{ label: 'A套餐' }, { label: 'B套餐' }])
    expect(detail.product.requireName).toBe(true)
    expect(detail.product.requirePhone).toBe(true)
    expect(detail.selectedOption.value).toBe(0)
    expect(document.title).toBe('产品A')
  })

  it('无 images 时回退 coverImage，无选项时 selectedOption 为 -1，缺失字段取默认值', async () => {
    vi.mocked(get).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: {
        ...fullDetail,
        title: '产品B',
        images: undefined,
        options: undefined,
        stock: undefined,
        sales: undefined,
        requireName: undefined,
        requirePhone: undefined,
      },
    })
    const detail = useProductDetail(makeRoute())

    await detail.fetchProductDetail()

    expect(detail.product.images).toEqual(['https://x/cover.png'])
    expect(detail.product.options).toEqual([])
    expect(detail.product.stock).toBe(0)
    expect(detail.product.sales).toBe('0')
    expect(detail.product.price).toBe('99.5')
    expect(detail.product.requireName).toBe(false)
    expect(detail.product.requirePhone).toBe(false)
    expect(detail.selectedOption.value).toBe(-1)
  })

  it('res.data 为空时保持默认值不报错', async () => {
    vi.mocked(get).mockResolvedValue({
      code: 1,
      message: 'fail',
      data: null as unknown as Product,
    })
    const detail = useProductDetail(makeRoute())

    await detail.fetchProductDetail()

    expect(detail.product.title).toBe('')
    expect(detail.product.price).toBe('0')
    expect(detail.selectedOption.value).toBe(-1)
    expect(showToast).not.toHaveBeenCalled()
  })
})

describe('fetchProductDetail 失败路径', () => {
  it('请求失败时提示且不向外抛未捕获错误', async () => {
    vi.mocked(get).mockRejectedValue(new Error('network down'))
    const detail = useProductDetail(makeRoute())

    await expect(detail.fetchProductDetail()).resolves.toBeUndefined()

    expect(showToast).toHaveBeenCalledWith('获取产品详情失败')
    expect(detail.product.title).toBe('')
  })
})

describe('initDetail 分享模式判定', () => {
  it('query.share=true 时进入分享模式并触发详情加载', () => {
    const detail = useProductDetail(makeRoute({ share: 'true' }))

    detail.initDetail()

    expect(detail.isShareMode.value).toBe(true)
    expect(get).toHaveBeenCalledWith('/products/p_1')
  })

  it('无 share 参数时为普通模式', () => {
    const detail = useProductDetail(makeRoute())

    detail.initDetail()

    expect(detail.isShareMode.value).toBe(false)
    expect(get).toHaveBeenCalledTimes(1)
  })
})

describe('handleShare 分享二维码', () => {
  it('登录态携带 sharerId 生成二维码并展示弹窗', async () => {
    state.userId = 'u_1'
    toDataURL.mockResolvedValue('data:image/png;base64,QR')
    const detail = useProductDetail(makeRoute())

    await detail.handleShare()

    expect(detail.shareVisible.value).toBe(true)
    const expectedUrl = `${window.location.origin}/api/share/product/p_1?sharerId=u_1`
    expect(toDataURL).toHaveBeenCalledWith(expectedUrl, { width: 200, margin: 2 })
    expect(detail.shareQrCode.value).toBe('data:image/png;base64,QR')
  })

  it('未登录时落地页链接不带 sharerId', async () => {
    toDataURL.mockResolvedValue('data:image/png;base64,QR')
    const detail = useProductDetail(makeRoute())

    await detail.handleShare()

    const calledUrl = toDataURL.mock.calls[0]?.[0] ?? ''
    expect(calledUrl).toBe(`${window.location.origin}/api/share/product/p_1`)
    expect(detail.shareQrCode.value).toBe('data:image/png;base64,QR')
  })

  it('二维码生成失败时提示且不留旧码', async () => {
    toDataURL.mockRejectedValue(new Error('qr fail'))
    const detail = useProductDetail(makeRoute())

    await expect(detail.handleShare()).resolves.toBeUndefined()

    expect(detail.shareVisible.value).toBe(true)
    expect(detail.shareQrCode.value).toBe('')
    expect(showToast).toHaveBeenCalledWith('生成分享二维码失败')
  })
})
