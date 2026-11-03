/**
 * PosterBatchAddDialog 单元测试：上传校验、去重防御、识别队列与事件契约
 * （el-* 组件与识别引擎均使用 mock，验证组件自身逻辑）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ElMessage, type UploadFile } from 'element-plus'
import { recognizePosterFile } from '../../utils/posterRecognizer'
import PosterBatchAddDialog from '../PosterBatchAddDialog.vue'

vi.mock('element-plus', () => ({
  ElMessage: { warning: vi.fn(), success: vi.fn(), error: vi.fn() },
}))
vi.mock('@promo/shared/utils/errors', () => ({
  getErrorMessage: vi.fn((_err: unknown, fallback: string) => fallback),
}))
vi.mock('../../utils/posterRecognizer', () => ({
  recognizePosterFile: vi.fn(),
}))

// ===== stub 组件（render 函数，避免依赖运行时模板编译） =====

const ElDialogStub = defineComponent({
  name: 'ElDialog',
  props: ['modelValue', 'title', 'closeOnClickModal'],
  setup(_, { slots }) {
    return () => h('div', { class: 'dialog-stub' }, [slots.default?.(), slots.footer?.()])
  },
})

const ElUploadStub = defineComponent({
  name: 'ElUpload',
  props: ['drag', 'multiple', 'autoUpload', 'showFileList', 'accept', 'disabled'],
  emits: ['change'],
  setup(_, { slots }) {
    return () => h('div', { class: 'upload-stub' }, slots.default?.())
  },
})

const ElButtonStub = defineComponent({
  name: 'ElButton',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h('button', { class: 'button-stub', ...attrs }, slots.default?.())
  },
})

const mountDialog = (): VueWrapper => mount(PosterBatchAddDialog, {
  props: { modelValue: true },
  global: {
    stubs: {
      'el-dialog': ElDialogStub,
      'el-upload': ElUploadStub,
      'el-button': ElButtonStub,
      'el-progress': true,
      'el-tag': true,
      'el-icon': true,
    },
  },
})

const makeFile = (name: string, type = 'image/png', size = 1024) => {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

const makeUploadFile = (uid: number, name: string, type = 'image/png', size = 1024) =>
  ({ uid, name, raw: makeFile(name, type, size), status: 'ready' }) as unknown as UploadFile

/** 触发上传 change：模板中 :on-change 以连字符 prop 传递，需从 vnode props 直接调用 */
const upload = async (wrapper: VueWrapper, uploadFile: UploadFile) => {
  const elUpload = wrapper.findComponent({ name: 'ElUpload' })
  const onChange = (elUpload.vm.$.vnode.props as Record<string, unknown>)['on-change'] as (f: UploadFile) => void
  onChange(uploadFile)
  await flushPromises()
}

/** 仅替换 URL 的 objectURL 静态方法，保留 URL 构造器 */
const stubUrlObjectUrls = () => {
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:mock'), configurable: true, writable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true })
}

beforeEach(() => {
  vi.clearAllMocks()
  stubUrlObjectUrls()
})

// ===== 上传校验 =====

describe('上传校验', () => {
  it('仅接受 JPG/PNG，其他类型提示并忽略', async () => {
    const wrapper = mountDialog()
    await upload(wrapper, makeUploadFile(1, 'a.gif', 'image/gif'))

    expect(ElMessage.warning).toHaveBeenCalledWith('仅支持 JPG/PNG 图片：a.gif')
    expect(recognizePosterFile).not.toHaveBeenCalled()
    expect(wrapper.findAll('.poster-item')).toHaveLength(0)
  })

  it('超过 30MB 的图片被拒绝', async () => {
    const wrapper = mountDialog()
    await upload(wrapper, makeUploadFile(1, 'big.png', 'image/png', 31 * 1024 * 1024))

    expect(ElMessage.warning).toHaveBeenCalledWith('图片过大（超过 30MB）：big.png')
    expect(wrapper.findAll('.poster-item')).toHaveLength(0)
  })

  it('raw 缺失时静默忽略', async () => {
    const wrapper = mountDialog()
    await upload(wrapper, {} as unknown as UploadFile)

    expect(ElMessage.warning).not.toHaveBeenCalled()
    expect(wrapper.findAll('.poster-item')).toHaveLength(0)
  })

  it('相同 uid 的重复 change 事件只收录一次', async () => {
    vi.mocked(recognizePosterFile).mockResolvedValue({ brokerName: '首创证券', redirectUrl: 'https://example.com/sc' })
    const wrapper = mountDialog()
    await upload(wrapper, makeUploadFile(5, 'a.png'))
    await upload(wrapper, makeUploadFile(5, 'b.png'))

    expect(wrapper.findAll('.poster-item')).toHaveLength(1)
    expect(recognizePosterFile).toHaveBeenCalledTimes(1)
  })

  it('短时间重复触发同一文件（不同 uid）只收录一次，保证行数与图片数一致', async () => {
    vi.mocked(recognizePosterFile).mockResolvedValue({ brokerName: '', redirectUrl: '' })
    const wrapper = mountDialog()
    await upload(wrapper, makeUploadFile(11, 'same.png'))
    await upload(wrapper, makeUploadFile(12, 'same.png'))

    expect(wrapper.findAll('.poster-item')).toHaveLength(1)
    expect(recognizePosterFile).toHaveBeenCalledTimes(1)
  })
})

// ===== 识别队列与事件契约 =====

describe('识别队列与事件契约', () => {
  it('识别成功后按图片发出一行数据，并携带 File 与进度回调', async () => {
    vi.mocked(recognizePosterFile).mockResolvedValue({ brokerName: '首创证券', redirectUrl: 'https://example.com/sc' })
    const wrapper = mountDialog()
    const raw = makeFile('p1.png')
    await upload(wrapper, { uid: 1, name: 'p1.png', raw, status: 'ready' } as unknown as UploadFile)

    expect(recognizePosterFile).toHaveBeenCalledTimes(1)
    // File 存入 reactive 列表后取出为 Proxy 包装，用深度相等断言（内容为同一文件）
    const recognized = vi.mocked(recognizePosterFile).mock.calls[0]
    expect(recognized?.[0]).toStrictEqual(raw)
    expect(typeof recognized?.[1]).toBe('function')
    expect(wrapper.emitted('add-rows')).toEqual([[[{ label: '首创证券', redirectUrl: 'https://example.com/sc' }]]])
    // 条目渲染为完成态并展示识别结果
    expect(wrapper.find('.poster-result').text()).toContain('首创证券')
  })

  it('多张图片串行处理，add-rows 顺序与上传顺序严格一一对应', async () => {
    const resolvers: Array<(v: { brokerName: string; redirectUrl: string }) => void> = []
    vi.mocked(recognizePosterFile).mockImplementation(
      () => new Promise(res => resolvers.push(res))
    )
    const wrapper = mountDialog()
    await upload(wrapper, makeUploadFile(1, 'p1.png'))
    await upload(wrapper, makeUploadFile(2, 'p2.png'))
    await upload(wrapper, makeUploadFile(3, 'p3.png'))
    // 三张均已入列，尚未有任何结果
    expect(wrapper.emitted('add-rows')).toBeUndefined()

    resolvers[0]({ brokerName: '首创证券', redirectUrl: 'u1' })
    await flushPromises()
    resolvers[1]({ brokerName: '国新证券', redirectUrl: 'u2' })
    await flushPromises()
    resolvers[2]({ brokerName: '信达证券', redirectUrl: 'u3' })
    await flushPromises()

    // 识别按入列顺序调用
    expect(vi.mocked(recognizePosterFile).mock.calls.map(c => (c[0] as File).name)).toEqual(['p1.png', 'p2.png', 'p3.png'])
    // 每张图片恰好一行，顺序一致
    expect(wrapper.emitted('add-rows')?.map(args => (args[0] as Array<{ label: string }>)[0].label))
      .toEqual(['首创证券', '国新证券', '信达证券'])
    expect(wrapper.emitted('add-rows')).toHaveLength(3)
  })

  it('识别失败时仍生成一行空数据（1:1 兜底）并标记失败', async () => {
    vi.mocked(recognizePosterFile).mockRejectedValue(new Error('boom'))
    const wrapper = mountDialog()
    await upload(wrapper, makeUploadFile(1, 'bad.png'))

    expect(wrapper.emitted('add-rows')).toEqual([[[{ label: '', redirectUrl: '' }]]])
    expect(wrapper.find('.poster-status.failed').text()).toContain('识别失败：识别异常')
  })

  it('识别进行中关闭弹窗不清理列表，空闲时关闭才清理并释放预览', async () => {
    let resolveFn!: (v: { brokerName: string; redirectUrl: string }) => void
    vi.mocked(recognizePosterFile).mockImplementation(
      () => new Promise(res => { resolveFn = res })
    )
    const wrapper = mountDialog()
    await upload(wrapper, makeUploadFile(1, 'p1.png'))
    expect(wrapper.findAll('.poster-item')).toHaveLength(1)

    // 识别进行中关闭：列表保留
    await wrapper.setProps({ modelValue: false })
    await flushPromises()
    expect(wrapper.findAll('.poster-item')).toHaveLength(1)

    // 识别完成后关闭：清理列表并释放预览 URL
    resolveFn({ brokerName: '首创证券', redirectUrl: 'u1' })
    await flushPromises()
    await wrapper.setProps({ modelValue: true })
    await wrapper.setProps({ modelValue: false })
    await flushPromises()

    expect(wrapper.findAll('.poster-item')).toHaveLength(0)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })

  it('页脚「关闭」按钮触发 update:modelValue=false', async () => {
    const wrapper = mountDialog()
    await wrapper.find('.button-stub').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })
})
