/**
 * 批量导入弹窗：选完文件自动预览、确认按钮放开条件、无可导入行时的明确提示。
 * el-* 组件使用 stub，网络与 Excel 解析使用 mock，只验证组件自身状态流转。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import type { UploadFile } from 'element-plus'
import { post } from '@promo/shared/utils/request'
import { parseCustomerWorkbook, type CustomerImportResult } from '../utils'
import CustomerImportDialog from '../components/CustomerImportDialog.vue'

vi.mock('element-plus', () => ({
  ElMessage: { warning: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))
vi.mock('@promo/shared/utils/errors', () => ({
  getErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
}))
vi.mock('@promo/shared/utils/request', () => ({
  post: vi.fn(),
}))
vi.mock('../utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils')>()),
  parseCustomerWorkbook: vi.fn(),
}))

const ElDialogStub = defineComponent({
  name: 'ElDialog',
  props: ['modelValue', 'title'],
  setup(_, { slots }) {
    return () => h('div', { class: 'dialog-stub' }, [slots.default?.(), slots.footer?.()])
  },
})

const ElUploadStub = defineComponent({
  name: 'ElUpload',
  props: ['autoUpload', 'showFileList', 'multiple', 'accept'],
  emits: ['change'],
  setup(_, { slots }) {
    return () => h('div', { class: 'upload-stub' }, slots.default?.())
  },
})

const ElButtonStub = defineComponent({
  name: 'ElButton',
  inheritAttrs: false,
  props: ['disabled', 'loading', 'type', 'text', 'plain'],
  setup(props, { slots }) {
    return () => h('button', { class: 'button-stub', disabled: props.disabled }, slots.default?.())
  },
})

const ElRadioGroupStub = defineComponent({
  name: 'ElRadioGroup',
  props: ['modelValue'],
  emits: ['update:modelValue', 'change'],
  setup(_, { slots }) {
    return () => h('div', { class: 'radio-group-stub' }, slots.default?.())
  },
})

const ElAlertStub = defineComponent({
  name: 'ElAlert',
  props: ['title', 'type'],
  setup(props) {
    return () => h('div', { class: 'alert-stub' }, props.title)
  },
})

const ElDescriptionsStub = defineComponent({
  name: 'ElDescriptions',
  setup(_, { slots }) {
    return () => h('div', { class: 'descriptions-stub' }, slots.default?.())
  },
})

const ElDescriptionsItemStub = defineComponent({
  name: 'ElDescriptionsItem',
  props: ['label'],
  setup(props, { slots }) {
    return () => h('div', { class: 'descriptions-item-stub' }, [props.label, slots.default?.()])
  },
})

const mountDialog = (): VueWrapper => mount(CustomerImportDialog, {
  global: {
    stubs: {
      'el-dialog': ElDialogStub,
      'el-upload': ElUploadStub,
      'el-button': ElButtonStub,
      'el-radio-group': ElRadioGroupStub,
      'el-radio': true,
      'el-alert': ElAlertStub,
      'el-descriptions': ElDescriptionsStub,
      'el-descriptions-item': ElDescriptionsItemStub,
      'el-table': true,
      'el-table-column': true,
    },
  },
})

const makeResult = (overrides: Partial<CustomerImportResult> = {}): CustomerImportResult => ({
  dryRun: true,
  mode: 'overwrite',
  totalRows: 1,
  created: 1,
  updated: 0,
  skipped: 0,
  errors: 0,
  errorRows: [],
  skippedRows: [],
  ...overrides,
})

/** 选文件：模板以 :on-change 传递，需从 vnode props 直接调用 */
const pickFile = async (wrapper: VueWrapper, name = '客户数据_2026-11-13 (1).xlsx') => {
  const elUpload = wrapper.findComponent({ name: 'ElUpload' })
  const onChange = (elUpload.vm.$.vnode.props as Record<string, unknown>)['on-change'] as
    (file: UploadFile) => void
  onChange({ name, raw: new File(['x'], name) } as unknown as UploadFile)
  await flushPromises()
}

const confirmButton = (wrapper: VueWrapper) =>
  wrapper.findAll('button').find((button) => button.text().includes('确认导入'))!

const hintText = (wrapper: VueWrapper): string => {
  const hint = wrapper.find('.empty-hint')
  return hint.exists() ? hint.text() : ''
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(parseCustomerWorkbook).mockResolvedValue({
    rows: [{ rowNumber: 2, groupName: '888', contactName: '张三', payMethod: '支付宝', cardNo: '' }],
    ignoredHeaders: ['收单笔数'],
  })
})

describe('选完文件自动预览', () => {
  it('解析成功后立即发起 dryRun 预览，无需手动点预览', async () => {
    vi.mocked(post).mockResolvedValue({ code: 0, message: '预览完成', data: makeResult() })

    const wrapper = mountDialog()
    await pickFile(wrapper)

    expect(parseCustomerWorkbook).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith('/admin/customers/import', expect.objectContaining({ dryRun: true }))
    expect(wrapper.text()).toContain('已解析 1 行数据')
    expect(wrapper.text()).toContain('新增')
  })

  it('无可导入行时也会自动预览，避免按钮无提示地保持禁用', async () => {
    vi.mocked(post).mockResolvedValue({
      code: 0,
      message: '预览完成',
      data: makeResult({ created: 0, errors: 2, errorRows: [{ rowNumber: 2, groupName: '888', reason: '对接人不能为空' }] }),
    })

    const wrapper = mountDialog()
    await pickFile(wrapper)

    expect(post).toHaveBeenCalledTimes(1)
  })

  it('解析出 0 行时不发起预览', async () => {
    vi.mocked(parseCustomerWorkbook).mockResolvedValue({ rows: [], ignoredHeaders: [] })

    const wrapper = mountDialog()
    await pickFile(wrapper)

    expect(post).not.toHaveBeenCalled()
  })
})

describe('确认导入按钮状态', () => {
  it('预览存在可导入行时按钮可用', async () => {
    vi.mocked(post).mockResolvedValue({ code: 0, message: '预览完成', data: makeResult({ created: 110, updated: 1 }) })

    const wrapper = mountDialog()
    await pickFile(wrapper)

    expect(confirmButton(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('预览结果为 0 条可导入时按钮保持禁用，并给出原因提示', async () => {
    vi.mocked(post).mockResolvedValue({
      code: 0,
      message: '预览完成',
      data: makeResult({ created: 0, errors: 3, errorRows: [{ rowNumber: 2, groupName: '888', reason: '对接人不能为空' }] }),
    })

    const wrapper = mountDialog()
    await pickFile(wrapper)

    expect(confirmButton(wrapper).attributes('disabled')).toBeDefined()
    expect(hintText(wrapper)).toContain('未识别到有效数据行')
    expect(hintText(wrapper)).toContain('群号简称')
    expect(hintText(wrapper)).toContain('对接人')
  })

  it('切换到「跳过」后自动重新预览，全部同名时提示可改为覆盖更新', async () => {
    vi.mocked(post)
      .mockResolvedValueOnce({ code: 0, message: '预览完成', data: makeResult() })
      .mockResolvedValueOnce({
        code: 0,
        message: '预览完成',
        data: makeResult({ mode: 'skip', created: 0, skipped: 111 }),
      })

    const wrapper = mountDialog()
    await pickFile(wrapper)
    expect(confirmButton(wrapper).attributes('disabled')).toBeUndefined()

    const radioGroup = wrapper.findComponent({ name: 'ElRadioGroup' })
    radioGroup.vm.$emit('update:modelValue', 'skip')
    radioGroup.vm.$emit('change')
    await flushPromises()

    expect(post).toHaveBeenCalledTimes(2)
    expect(post).toHaveBeenLastCalledWith('/admin/customers/import', expect.objectContaining({ mode: 'skip', dryRun: true }))
    expect(confirmButton(wrapper).attributes('disabled')).toBeDefined()
    expect(hintText(wrapper)).toContain('覆盖更新')
  })
})
