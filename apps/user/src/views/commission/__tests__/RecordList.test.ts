/**
 * RecordList 操作按钮可见性测试：非待审核状态不得出现必然失败的按钮
 */
/* eslint-disable vue/one-component-per-file */
import { describe, it, expect, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import RecordList from '../components/RecordList.vue'
import type { Order } from '@promo/shared/types'

vi.mock('vant', () => ({
  showToast: vi.fn(),
}))

const VanListStub = defineComponent({
  setup(_, { slots }) {
    return () => h('div', slots.default?.())
  },
})

const VanSwipeCellStub = defineComponent({
  setup(_, { slots }) {
    return () => h('div', [slots.default?.(), h('div', { class: 'right-slot' }, slots.right?.())])
  },
})

const VanButtonStub = defineComponent({
  props: { text: { type: String, default: '' }, disabled: { type: Boolean, default: false } },
  setup(props) {
    return () => h('button', { disabled: props.disabled }, props.text)
  },
})

const VanTagStub = defineComponent({
  setup(_, { slots }) {
    return () => h('span', slots.default?.())
  },
})

const createOrder = (status: Order['status']): Order => ({
  id: `o_${status}`,
  productId: 'p_1',
  productName: '测试产品',
  productPrice: 100,
  status,
  createdAt: '',
  updatedAt: '',
} as unknown as Order)

const mountList = (status: Order['status']) =>
  mount(RecordList, {
    props: {
      records: [createOrder(status)],
      loading: false,
      finished: true,
    },
    global: {
      stubs: {
        'van-list': VanListStub,
        'van-swipe-cell': VanSwipeCellStub,
        'van-button': VanButtonStub,
        'van-tag': VanTagStub,
        'van-empty': true,
      },
    },
  })

describe('RecordList 操作按钮', () => {
  it('待审核订单显示资金号与删除按钮', () => {
    const wrapper = mountList('pending')
    expect(wrapper.text()).toContain('提交资金号')
    expect(wrapper.text()).toContain('删除')
  })

  it.each<Order['status']>(['approved', 'pending_payment', 'settled', 'rejected'])(
    '%s 状态不显示必然失败的操作按钮',
    (status) => {
      const wrapper = mountList(status)
      expect(wrapper.text()).not.toContain('提交资金号')
      expect(wrapper.text()).not.toContain('删除')
      expect(wrapper.text()).toContain('仅待审核订单支持操作')
    }
  )
})
