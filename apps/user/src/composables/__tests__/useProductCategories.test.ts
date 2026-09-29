/**
 * useProductCategories 单元测试：分类名称解析、列表拉取与失败降级、挂载自动拉取
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { useProductCategories, categories, defaultCategories } from '../useProductCategories'
import { get } from '@promo/shared/utils/request'
import type { ProductCategory } from '@promo/shared/types'

vi.mock('@promo/shared/utils/request', () => ({ get: vi.fn() }))

type CategoriesApi = ReturnType<typeof useProductCategories>

// composable 内部使用 onMounted，需在组件 setup 中调用后经 api 访问
let api!: CategoriesApi
const mountHost = () =>
  mount(
    defineComponent({
      setup() {
        api = useProductCategories()
        return () => h('div')
      },
    }),
  )

const remoteList: ProductCategory[] = [
  { id: 'r_1', name: '远程分类A', value: 'remote-a', sort: 1, status: 'active', createdAt: '', updatedAt: '' },
  { id: 'r_2', name: '远程分类B', value: 'remote-b', sort: 2, status: 'active', createdAt: '', updatedAt: '' },
]

beforeEach(() => {
  vi.clearAllMocks()
  // categories 为模块级共享状态，重置为默认快照
  categories.value = [...defaultCategories]
})

describe('getCategoryName', () => {
  it('优先使用快照名称', () => {
    categories.value = defaultCategories.slice(0, 1) // 非默认长度，避免挂载时自动拉取
    vi.mocked(get).mockResolvedValue({ code: 0, message: 'ok', data: { list: remoteList } })
    mountHost()

    expect(api.getCategoryName('comprehensive-instant', '快照分类名')).toBe('快照分类名')
  })

  it('无快照时按 value 匹配当前分类，未命中返回空串', () => {
    categories.value = defaultCategories.slice(0, 2)
    mountHost()

    expect(api.getCategoryName('comprehensive-instant')).toBe('综合-立返')
    expect(api.getCategoryName('not-exist')).toBe('')
  })
})

describe('fetchCategories', () => {
  it('成功时用接口列表覆盖当前分类并结束 loading', async () => {
    categories.value = defaultCategories.slice(0, 1)
    vi.mocked(get).mockResolvedValue({ code: 0, message: 'ok', data: { list: remoteList } })
    mountHost()

    await api.fetchCategories()

    expect(get).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledWith('/categories')
    expect(categories.value).toEqual(remoteList)
    expect(api.loading.value).toBe(false)
  })

  it('失败时降级保留当前分类并结束 loading', async () => {
    categories.value = defaultCategories.slice(0, 1)
    vi.mocked(get).mockRejectedValue(new Error('network down'))
    mountHost()

    await expect(api.fetchCategories()).resolves.toBeUndefined()

    expect(get).toHaveBeenCalledTimes(1)
    expect(categories.value).toHaveLength(1)
    expect(api.loading.value).toBe(false)
  })
})

describe('useProductCategories 挂载行为', () => {
  it('挂载时分类仍为默认列表则自动拉取并覆盖', async () => {
    vi.mocked(get).mockResolvedValue({ code: 0, message: 'ok', data: { list: remoteList } })
    mountHost()

    await flushPromises()

    expect(get).toHaveBeenCalledWith('/categories')
    expect(categories.value).toEqual(remoteList)
  })

  it('挂载时分类已非默认列表则不重复拉取', () => {
    categories.value = [...remoteList]
    vi.mocked(get).mockResolvedValue({ code: 0, message: 'ok', data: { list: remoteList } })
    mountHost()

    expect(get).not.toHaveBeenCalled()
  })
})
