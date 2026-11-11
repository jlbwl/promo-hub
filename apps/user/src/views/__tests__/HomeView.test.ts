/**
 * HomeView 单元测试：产品列表加载失败必须呈现可重试的错误态，而不是「没有更多了」空态
 */
/* eslint-disable vue/one-component-per-file */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import HomeView from '../HomeView.vue'
import { get } from '@promo/shared/utils/request'

vi.mock('@promo/shared/utils/request', () => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('vant', () => ({
  showToast: vi.fn(),
  showConfirmDialog: vi.fn(),
}))

const VanListStub = defineComponent({
  name: 'VanList',
  props: {
    loading: { type: Boolean, default: false },
    finished: { type: Boolean, default: false },
    finishedText: { type: String, default: '' },
  },
  emits: ['load', 'update:loading'],
  mounted() {
    this.$emit('load')
  },
  template: `
    <div class="van-list-stub">
      <slot />
      <span class="finished-text">{{ finishedText }}</span>
    </div>
  `,
})

const PassthroughStub = defineComponent({
  template: '<div><slot /></div>',
})

const VanButtonStub = defineComponent({
  emits: ['click'],
  template: '<button class="van-button-stub" @click="$emit(\'click\')"><slot /></button>',
})

const mountHome = () =>
  mount(HomeView, {
    global: {
      stubs: {
        ProductCard: true,
        CategoryList: true,
        'van-list': VanListStub,
        'van-pull-refresh': PassthroughStub,
        'van-search': true,
        'van-button': VanButtonStub,
      },
    },
  })

const mockGet = vi.mocked(get)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mockGet.mockImplementation((url: string) => {
    if (url === '/categories') {
      return Promise.resolve({ code: 0, message: 'ok', data: { list: [] } })
    }
    return Promise.reject(new Error('network down'))
  })
})

describe('产品列表加载失败', () => {
  it('失败时展示错误态与重试入口而非「没有更多了」', async () => {
    const wrapper = mountHome()
    await flushPromises()

    expect(wrapper.text()).toContain('产品加载失败')
    expect(wrapper.text()).toContain('重新加载')
    expect(wrapper.text()).not.toContain('没有更多了')
  })

  it('点击重试会重新发起列表请求', async () => {
    const wrapper = mountHome()
    await flushPromises()

    const productCallsBefore = mockGet.mock.calls.filter(([url]) => url === '/products').length
    await wrapper.find('.van-button-stub').trigger('click')
    await flushPromises()
    const productCallsAfter = mockGet.mock.calls.filter(([url]) => url === '/products').length

    expect(productCallsAfter).toBeGreaterThan(productCallsBefore)
  })
})
