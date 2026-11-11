/**
 * useProductCategories 单元测试：分类名称解析、失败错误态、重试与挂载自动拉取
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { useProductCategories, categories, loadError } from '../useProductCategories'
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

const fixedGroupNames = ['全部', '综合', '个养加挂', '限三', '不限三', '三方']

beforeEach(() => {
  vi.clearAllMocks()
  // categories/loadError 为模块级共享状态，测试间重置
  categories.value = []
  loadError.value = false
})

describe('分类加载失败', () => {
  it('失败时不注入任何默认分类，仅标记错误态', async () => {
    vi.mocked(get).mockRejectedValue(new Error('network down'))
    mountHost()
    await flushPromises()

    expect(get).toHaveBeenCalledWith('/categories')
    expect(categories.value).toEqual([])
    expect(api.loadError.value).toBe(true)
    // 分类 tab 仍为固定 6 项，但没有任何兜底分类值
    expect(api.categoryGroups.value.map(group => group.name)).toEqual(fixedGroupNames)
    expect(api.categoryGroups.value.every(group => group.values.length === 0)).toBe(true)
    // 规范已废弃的「其它」不得被加回来
    expect(api.categoryGroups.value.flatMap(group => group.values)).not.toContain('other')
  })

  it('失败后可重试，成功时恢复数据并清除错误态', async () => {
    vi.mocked(get).mockRejectedValueOnce(new Error('network down'))
    mountHost()
    await flushPromises()
    expect(api.loadError.value).toBe(true)

    vi.mocked(get).mockResolvedValue({ code: 0, message: 'ok', data: { list: remoteList } })
    await api.fetchCategories()

    expect(api.loadError.value).toBe(false)
    expect(categories.value).toEqual(remoteList)
    expect(api.loading.value).toBe(false)
  })
})

describe('挂载自动拉取', () => {
  it('分类为空时自动拉取并填充数据', async () => {
    vi.mocked(get).mockResolvedValue({ code: 0, message: 'ok', data: { list: remoteList } })
    mountHost()
    await flushPromises()

    expect(get).toHaveBeenCalledWith('/categories')
    expect(categories.value).toEqual(remoteList)
    expect(api.loadError.value).toBe(false)
  })

  it('已有分类时不重复拉取', () => {
    categories.value = [...remoteList]
    vi.mocked(get).mockResolvedValue({ code: 0, message: 'ok', data: { list: remoteList } })
    mountHost()

    expect(get).not.toHaveBeenCalled()
  })
})

describe('getCategoryName', () => {
  it('优先使用快照名称', () => {
    categories.value = [...remoteList]
    mountHost()

    expect(api.getCategoryName('comprehensive-instant', '快照分类名')).toBe('快照分类名')
  })

  it('无快照时按 value 匹配当前分类，未命中返回空串', () => {
    categories.value = [...remoteList]
    mountHost()

    expect(api.getCategoryName('remote-a')).toBe('远程分类A')
    expect(api.getCategoryName('not-exist')).toBe('')
  })
})
