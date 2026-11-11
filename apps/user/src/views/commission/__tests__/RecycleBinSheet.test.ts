/**
 * RecycleBinSheet 永久删除按钮测试：不可删除的状态必须禁用并给出原因
 */
/* eslint-disable vue/one-component-per-file */
import { describe, it, expect } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import RecycleBinSheet from '../components/RecycleBinSheet.vue'
import type { Order } from '@promo/shared/types'

const VanActionSheetStub = defineComponent({
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
  emits: ['click'],
  setup(props, { emit }) {
    return () =>
      h('button', { disabled: props.disabled, onClick: () => emit('click') }, props.text)
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
  deletedAt: '',
} as unknown as Order)

const mountSheet = (status: Order['status']) =>
  mount(RecycleBinSheet, {
    props: {
      show: true,
      orders: [createOrder(status)],
    },
    global: {
      stubs: {
        'van-action-sheet': VanActionSheetStub,
        'van-swipe-cell': VanSwipeCellStub,
        'van-button': VanButtonStub,
        'van-tag': VanTagStub,
        'van-icon': true,
      },
    },
  })

const findPurgeButton = (wrapper: ReturnType<typeof mountSheet>) =>
  wrapper.findAll('button').find((btn) => btn.text().includes('删除'))

describe('RecycleBinSheet 永久删除', () => {
  it.each<Order['status']>(['pending', 'rejected'])(
    '%s 状态可永久删除',
    (status) => {
      const wrapper = mountSheet(status)
      const btn = findPurgeButton(wrapper)
      expect(btn?.text()).toBe('永久删除')
      expect(btn?.attributes('disabled')).toBeUndefined()
      expect(wrapper.text()).not.toContain('不可永久删除')
    }
  )

  it.each<Order['status']>(['approved', 'pending_payment', 'settled'])(
    '%s 状态禁用永久删除并说明原因',
    (status) => {
      const wrapper = mountSheet(status)
      const btn = findPurgeButton(wrapper)
      expect(btn?.text()).toBe('不可删除')
      expect(btn?.attributes('disabled')).toBeDefined()
      expect(wrapper.text()).toContain('已进入结算流程的订单不可永久删除')
    }
  )

  it('禁用状态点击不会触发 purge 事件', async () => {
    const wrapper = mountSheet('settled')
    await findPurgeButton(wrapper)?.trigger('click')
    expect(wrapper.emitted('purge')).toBeUndefined()
  })
})
