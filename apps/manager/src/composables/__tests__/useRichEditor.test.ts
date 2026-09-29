/**
 * useRichEditor 单元测试：初始化、输入同步与截断、粘贴/拖拽/选图图片处理、清空
 * 隔离 rich-editor 的 sanitizeHtml 与 imageUpload，ElMessage/logger 用 mock 避免真实弹窗与输出
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { useRichEditor } from '../useRichEditor'
import { sanitizeHtml } from '../../components/rich-editor/sanitizeHtml'
import { compressImage, uploadToServer } from '../../components/rich-editor/imageUpload'
import { ElMessage } from 'element-plus'

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}))

vi.mock('@promo/shared/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../../components/rich-editor/sanitizeHtml', () => ({
  sanitizeHtml: vi.fn((html: string) => html),
}))

vi.mock('../../components/rich-editor/imageUpload', () => ({
  isMobile: false,
  compressConfig: { maxFileSize: 1024 * 1024, mimeType: 'image/jpeg' },
  compressImage: vi.fn(),
  uploadToServer: vi.fn(),
}))

type RichEditorApi = ReturnType<typeof useRichEditor>

const IMG_URL = 'https://cdn.example.com/a.jpg'

/** 非 contenteditable 环境外直接调用 composable（onMounted 钩子不触发，无 MutationObserver 干扰） */
function setupBare(modelValue = '', maxLength = 1000) {
  const props = reactive({ modelValue, maxLength })
  const emitUpdate = vi.fn()
  const api = useRichEditor(props, emitUpdate)
  return { props, emitUpdate, api }
}

/** 创建并挂载到 body 的真实 contenteditable 元素 */
function createEditor(): HTMLDivElement {
  const el = document.createElement('div')
  el.setAttribute('contenteditable', 'true')
  document.body.appendChild(el)
  return el
}

/** 挂载宿主组件以触发 onMounted → nextTick → initEditor 的真实初始化链路 */
function mountEditor(modelValue: string, maxLength = 1000) {
  const emitUpdate = vi.fn()
  let api!: RichEditorApi
  const Host = defineComponent({
    setup() {
      api = useRichEditor({ modelValue, maxLength }, emitUpdate)
      return () => h('div', {
        ref: (el) => { api.editorRef.value = (el as HTMLDivElement) || undefined },
        contenteditable: 'true',
      })
    },
  })
  const wrapper = mount(Host, { attachTo: document.body })
  return { wrapper, emitUpdate, api: (): RichEditorApi => api }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(compressImage).mockResolvedValue(new Blob(['x']))
  vi.mocked(uploadToServer).mockResolvedValue(IMG_URL)
  vi.spyOn(window, 'getSelection').mockReturnValue({ rangeCount: 0 } as unknown as Selection)
  // 屏蔽 bare 调用 composable 时 Vue 对 onMounted 无实例的告警
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('初始化', () => {
  it('挂载后在 nextTick 中按 modelValue 设置初始内容', async () => {
    const { wrapper, api } = mountEditor('<p>hello</p>')
    await flushPromises()
    await nextTick()
    expect(api().editorRef.value?.innerHTML).toBe('<p>hello</p>')
    expect(api().currentLength.value).toBe(5)
    wrapper.unmount()
  })

  it('初始化后监听 DOM 变化并同步 emitUpdate', async () => {
    const { wrapper, emitUpdate } = mountEditor('')
    await flushPromises()
    wrapper.element.innerHTML = '<p>typed</p>'
    await vi.waitFor(() => expect(emitUpdate).toHaveBeenCalledWith('<p>typed</p>'))
    wrapper.unmount()
  })
})

describe('handleInput', () => {
  it('触发 emitUpdate 并统计文本长度', () => {
    const el = createEditor()
    const { api, emitUpdate } = setupBare()
    api.editorRef.value = el

    el.innerHTML = '<p>hello world</p>'
    api.handleInput()

    expect(emitUpdate).toHaveBeenCalledTimes(1)
    expect(emitUpdate).toHaveBeenCalledWith('<p>hello world</p>')
    expect(api.currentLength.value).toBe(11)
  })

  it('移除 base64 图片并告警', () => {
    const el = createEditor()
    const { api, emitUpdate } = setupBare()
    api.editorRef.value = el

    el.innerHTML = '<p>a</p><img src="data:image/png;base64,AAAA"><p>b</p>'
    api.handleInput()

    expect(ElMessage.warning).toHaveBeenCalledWith('检测到未上传的图片，已自动移除，请使用编辑器的上传功能插入图片')
    expect(el.querySelector('img')).toBeNull()
    expect(emitUpdate).toHaveBeenCalledTimes(1)
    expect(emitUpdate).toHaveBeenCalledWith('<p>a</p><p>b</p>')
  })

  it('超过 maxLength 时从尾部截断内容', () => {
    const el = createEditor()
    const { api, emitUpdate } = setupBare('', 5)
    api.editorRef.value = el

    el.innerHTML = '<div><p>abcdef</p></div>'
    api.handleInput()

    expect(el.textContent).toBe('abcde')
    expect(emitUpdate).toHaveBeenCalledWith('<div><p>abcde</p></div>')
    expect(api.currentLength.value).toBe(5)
  })
})

describe('handlePaste', () => {
  it('粘贴图片文件时走压缩上传并插入图片', async () => {
    const el = createEditor()
    const { api, emitUpdate } = setupBare()
    api.editorRef.value = el

    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const preventDefault = vi.fn()
    const event = {
      clipboardData: {
        items: [{ type: 'image/png', getAsFile: () => file }],
        types: ['Files'],
      },
      preventDefault,
    } as unknown as ClipboardEvent

    await api.handlePaste(event)

    expect(preventDefault).toHaveBeenCalled()
    expect(compressImage).toHaveBeenCalledWith(file)
    expect(uploadToServer).toHaveBeenCalledWith(expect.objectContaining({ name: 'a.jpeg', type: 'image/jpeg' }))
    expect(ElMessage.success).toHaveBeenCalledWith('图片插入成功')
    expect(el.querySelector('img')?.getAttribute('src')).toBe(IMG_URL)
    expect(emitUpdate).toHaveBeenCalledTimes(1)
    expect(api.uploading.value).toBe(false)
  })

  it('粘贴含 base64 图片的 HTML 时清理后以 insertHTML 插入', async () => {
    const el = createEditor()
    const { api } = setupBare()
    api.editorRef.value = el

    const execCommand = vi.fn()
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true, writable: true })
    const html = '<p>hi</p><img src="data:image/png;base64,AAAA">'
    const preventDefault = vi.fn()
    const event = {
      clipboardData: { items: [], types: ['text/html'], getData: vi.fn(() => html) },
      preventDefault,
    } as unknown as ClipboardEvent

    await api.handlePaste(event)

    expect(sanitizeHtml).toHaveBeenCalledWith(html)
    expect(ElMessage.warning).toHaveBeenCalledWith('粘贴内容中的图片已移除，请使用编辑器上传功能插入图片')
    expect(preventDefault).toHaveBeenCalled()
    expect(execCommand).toHaveBeenCalledWith('insertHTML', false, '<p>hi</p>')
  })
})

describe('handleDrop', () => {
  it('拖入图片文件时走压缩上传并插入，非图片文件忽略', async () => {
    const el = createEditor()
    const { api, emitUpdate } = setupBare()
    api.editorRef.value = el
    el.classList.add('drag-over')

    const img = new File(['x'], 'b.png', { type: 'image/png' })
    const txt = new File(['y'], 'note.txt', { type: 'text/plain' })
    const event = { dataTransfer: { files: [img, txt] } } as unknown as DragEvent

    await api.handleDrop(event)

    expect(el.classList.contains('drag-over')).toBe(false)
    expect(compressImage).toHaveBeenCalledTimes(1)
    expect(compressImage).toHaveBeenCalledWith(img)
    expect(el.querySelectorAll('img')).toHaveLength(1)
    expect(emitUpdate).toHaveBeenCalledTimes(1)
  })
})

describe('clear 与上传入口', () => {
  it('clear 清空内容并 emitUpdate 空串', () => {
    const el = createEditor()
    const { api, emitUpdate } = setupBare('<p>x</p>')
    api.editorRef.value = el

    el.innerHTML = '<p>content</p>'
    api.clear()

    expect(el.innerHTML).toBe('')
    expect(emitUpdate).toHaveBeenCalledWith('')
    expect(api.currentLength.value).toBe(0)
  })

  it('insertImageFromFile 处理图片后插入并复位 uploading', async () => {
    const el = createEditor()
    const { api, emitUpdate } = setupBare()
    api.editorRef.value = el

    const file = new File(['x'], 'c.jpg', { type: 'image/jpeg' })
    api.insertImageFromFile(file)
    await flushPromises()

    expect(compressImage).toHaveBeenCalledWith(file)
    expect(el.querySelector('img')).not.toBeNull()
    expect(api.uploading.value).toBe(false)
    expect(emitUpdate).toHaveBeenCalledTimes(1)
  })

  it('超限图片拒绝处理，不进入压缩上传', async () => {
    const el = createEditor()
    const { api } = setupBare()
    api.editorRef.value = el

    const big = new File(['x'.repeat(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })
    api.insertImageFromFile(big)
    await flushPromises()

    expect(ElMessage.error).toHaveBeenCalledWith('图片大小不能超过 1MB')
    expect(compressImage).not.toHaveBeenCalled()
    expect(el.querySelector('img')).toBeNull()
  })

  it('handleImageUpload 触发文件选择；handleFileSelect 处理选中文件并重置 input', async () => {
    const el = createEditor()
    const { api } = setupBare()
    api.editorRef.value = el

    const click = vi.fn()
    api.fileInputRef.value = { click } as unknown as HTMLInputElement
    api.handleImageUpload()
    expect(click).toHaveBeenCalledTimes(1)

    const file = new File(['x'], 'd.png', { type: 'image/png' })
    const target = { files: [file], value: 'D:\\fake\\d.png' }
    await api.handleFileSelect({ target } as unknown as Event)

    expect(compressImage).toHaveBeenCalledWith(file)
    expect(target.value).toBe('')
    expect(el.querySelector('img')).not.toBeNull()
  })

  it('拖拽悬停/离开切换 drag-over 样式并设置 dropEffect', () => {
    const el = createEditor()
    const { api } = setupBare()
    api.editorRef.value = el

    const event = { dataTransfer: { dropEffect: 'none' } } as unknown as DragEvent
    api.handleDragOver(event)
    expect(event.dataTransfer?.dropEffect).toBe('copy')
    expect(el.classList.contains('drag-over')).toBe(true)

    api.handleDragLeave()
    expect(el.classList.contains('drag-over')).toBe(false)
  })
})

describe('外部值同步', () => {
  it('modelValue 变化时同步到编辑器 innerHTML', async () => {
    const el = createEditor()
    const { props, api } = setupBare('<p>old</p>')
    api.editorRef.value = el

    el.innerHTML = '<p>local</p>'
    props.modelValue = '<p>new</p>'
    await nextTick()

    expect(el.innerHTML).toBe('<p>new</p>')
  })
})
