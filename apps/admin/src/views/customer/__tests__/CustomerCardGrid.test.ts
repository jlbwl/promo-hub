/**
 * 客户卡片视图：网格卡片渲染、收款码缩略图与占位、换码/编辑/删除事件、视图偏好持久化。
 * el-* 组件使用 stub，只验证组件自身行为。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import CustomerCardGrid from '../components/CustomerCardGrid.vue'
import {
  CUSTOMER_VIEW_MODE_KEY,
  readCustomerViewMode,
  saveCustomerViewMode,
  type CustomerItem,
} from '../utils'

const ElImageStub = defineComponent({
  name: 'ElImage',
  props: ['src', 'previewSrcList', 'fit', 'previewTeleported', 'hideOnClickModal'],
  setup(props, { slots }) {
    return () =>
      props.src
        ? h('img', { class: 'el-image-stub', src: props.src, 'data-fit': props.fit })
        : h('div', { class: 'el-image-empty-stub' }, slots.error?.())
  },
})

const ElTagStub = defineComponent({
  name: 'ElTag',
  props: ['type', 'size'],
  setup(_, { slots }) {
    return () => h('span', { class: 'tag-stub' }, slots.default?.())
  },
})

const ElButtonStub = defineComponent({
  name: 'ElButton',
  emits: ['click'],
  setup(_, { slots, emit }) {
    return () => h('button', { class: 'button-stub', onClick: () => emit('click') }, slots.default?.())
  },
})

const makeCustomer = (patch: Partial<CustomerItem> = {}): CustomerItem => ({
  id: 'cust_1',
  groupName: '10302032云帆科技',
  contactName: '张三',
  payMethod: 'wechat',
  payMethodLabel: '微信',
  cardNo: '卡A',
  hasQrCode: false,
  searchCount: 8,
  status: 'active',
  statusLabel: '启用',
  source: 'manual',
  createdAt: '2026-11-01 10:00:00',
  updatedAt: '2026-11-02 10:00:00',
  ...patch,
})

const mountGrid = (data: CustomerItem[]) =>
  mount(CustomerCardGrid, {
    props: { data, loading: false },
    global: {
      directives: { loading: {} },
      stubs: {
        ElImage: ElImageStub,
        ElTag: ElTagStub,
        ElButton: ElButtonStub,
      },
    },
  })

beforeEach(() => {
  window.localStorage.clear()
})

describe('CustomerCardGrid', () => {
  it('渲染群号与收款方式标签', () => {
    const wrapper = mountGrid([makeCustomer()])

    expect(wrapper.find('.card-title').text()).toContain('#10302032云帆科技')
    expect(wrapper.find('.tag-stub').text()).toBe('微信')
  })

  it('有收款码时渲染缩略图，并使用 contain 避免裁掉二维码边缘', () => {
    const wrapper = mountGrid([makeCustomer({ qrCodeUrl: '/uploads/qrcodes/qr_1.jpg', hasQrCode: true })])

    const image = wrapper.find('.el-image-stub')
    expect(image.exists()).toBe(true)
    expect(image.attributes('src')).toBe('/uploads/qrcodes/qr_1.jpg')
    expect(image.attributes('data-fit')).toBe('contain')
    expect(wrapper.text()).not.toContain('未上传收款码')
  })

  it('没有收款码时显示中性占位文案', () => {
    const wrapper = mountGrid([makeCustomer({ qrCodeUrl: '' })])

    expect(wrapper.find('.el-image-stub').exists()).toBe(false)
    expect(wrapper.find('.qr-placeholder').text()).toBe('未上传收款码')
  })

  it('点击换码并选择文件后抛出 replace-qrcode', async () => {
    const row = makeCustomer()
    const wrapper = mountGrid([row])

    const buttons = wrapper.findAll('.button-stub')
    const replaceButton = buttons.find(button => button.text() === '换码')
    expect(replaceButton).toBeTruthy()
    await replaceButton!.trigger('click')

    const input = wrapper.find('input[type="file"]')
    const file = new File(['x'], 'qr.png', { type: 'image/png' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')

    const events = wrapper.emitted('replace-qrcode')
    expect(events).toHaveLength(1)
    expect(events![0][0]).toMatchObject({ id: 'cust_1' })
    expect(events![0][1]).toBe(file)
  })

  it('未选文件时不触发换码，编辑与删除正常抛出', async () => {
    const row = makeCustomer()
    const wrapper = mountGrid([row])

    const input = wrapper.find('input[type="file"]')
    await input.trigger('change')
    expect(wrapper.emitted('replace-qrcode')).toBeUndefined()

    const buttons = wrapper.findAll('.button-stub')
    await buttons.find(button => button.text() === '编辑')!.trigger('click')
    await buttons.find(button => button.text() === '删除')!.trigger('click')

    expect(wrapper.emitted('edit')?.[0][0]).toMatchObject({ id: 'cust_1' })
    expect(wrapper.emitted('delete')?.[0][0]).toMatchObject({ id: 'cust_1' })
  })

  it('无数据时显示空态', () => {
    const wrapper = mountGrid([])

    expect(wrapper.find('.card-grid-empty').text()).toBe('暂无客户数据')
    expect(wrapper.find('.customer-grid').exists()).toBe(false)
  })
})

describe('客户视图偏好', () => {
  it('默认是表格视图', () => {
    expect(readCustomerViewMode()).toBe('table')
  })

  it('保存后能读回卡片视图', () => {
    saveCustomerViewMode('card')
    expect(readCustomerViewMode()).toBe('card')
    expect(window.localStorage.getItem(CUSTOMER_VIEW_MODE_KEY)).toBe('card')
  })

  it('非法值回退到表格视图', () => {
    window.localStorage.setItem(CUSTOMER_VIEW_MODE_KEY, 'list')
    expect(readCustomerViewMode()).toBe('table')
  })
})
