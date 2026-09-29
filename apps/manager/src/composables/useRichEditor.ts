import { logger } from '@promo/shared/utils/logger'
import { getErrorMessage } from '@promo/shared/utils/errors'
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { sanitizeHtml } from '../components/rich-editor/sanitizeHtml'
import { isMobile, compressConfig, compressImage, uploadToServer } from '../components/rich-editor/imageUpload'

interface RichEditorProps {
  readonly modelValue: string
  readonly maxLength: number
}

/**
 * 富文本编辑器交互逻辑：粘贴/拖拽图片处理、图片压缩上传与插入、内容清理截断与 v-model 双向同步
 */
export function useRichEditor(props: RichEditorProps, emitUpdate: (html: string) => void) {
  const editorRef = ref<HTMLDivElement>()
  const fileInputRef = ref<HTMLInputElement>()
  const uploading = ref(false)
  const currentLength = computed(() => {
    if (!editorRef.value) return 0
    const textContent = editorRef.value.textContent || ''
    return textContent.length
  })

  // 初始化编辑器
  const initEditor = () => {
    if (!editorRef.value) return

    // 设置初始内容
    if (props.modelValue) {
      editorRef.value.innerHTML = props.modelValue
    }

    // 监听内容变化
    const observer = new MutationObserver(() => {
      handleInput()
    })

    observer.observe(editorRef.value, {
      childList: true,
      subtree: true,
      characterData: true
    })
  }

  // 处理粘贴
  const handlePaste = async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    let hasImage = false
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        hasImage = true
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          await processImage(file)
        }
      }
    }

    // 如果是粘贴HTML，清理一下并移除base64图片
    if (!hasImage && e.clipboardData?.types.includes('text/html')) {
      const html = e.clipboardData.getData('text/html')
      let sanitizedHtml = sanitizeHtml(html)
      // 额外清理base64图片
      const base64ImgRegex = /<img[^>]+src=["']data:image[^>]+>/gi
      const hasBase64Img = base64ImgRegex.test(sanitizedHtml)
      if (hasBase64Img) {
        sanitizedHtml = sanitizedHtml.replace(base64ImgRegex, '')
        ElMessage.warning('粘贴内容中的图片已移除，请使用编辑器上传功能插入图片')
      }
      if (sanitizedHtml !== html || hasBase64Img) {
        e.preventDefault()
        document.execCommand('insertHTML', false, sanitizedHtml)
      }
    }
  }

  // 处理拖拽悬停
  const handleDragOver = (e: DragEvent) => {
    e.dataTransfer!.dropEffect = 'copy'
    editorRef.value?.classList.add('drag-over')
  }

  // 处理拖拽离开
  const handleDragLeave = () => {
    editorRef.value?.classList.remove('drag-over')
  }

  // 处理拖拽放下
  const handleDrop = async (e: DragEvent) => {
    editorRef.value?.classList.remove('drag-over')

    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        await processImage(file)
      }
    }
  }

  // 处理图片完整流程
  const processImage = async (file: File) => {
    try {
      uploading.value = true

      // 检查文件大小
      if (file.size > compressConfig.maxFileSize * 2) {
        ElMessage.error(`图片大小不能超过 ${(compressConfig.maxFileSize / 1024 / 1024).toFixed(0)}MB`)
        return
      }

      // 压缩图片
      logger.debug(`[图片处理] 原大小: ${(file.size / 1024).toFixed(1)}KB, 设备: ${isMobile ? '手机' : '电脑'}`)
      const compressedBlob = await compressImage(file)
      const compressedFile = new File(
        [compressedBlob],
        file.name.replace(/\.[^.]+$/, `.${compressConfig.mimeType.split('/')[1]}`),
        { type: compressConfig.mimeType }
      )
      logger.debug(`[图片压缩] 压缩后: ${(compressedFile.size / 1024).toFixed(1)}KB, 压缩比: ${((1 - compressedFile.size / file.size) * 100).toFixed(1)}%`)

      // 上传到服务器
      const imageUrl = await uploadToServer(compressedFile)

      // 插入图片到编辑器
      insertImage(imageUrl)

      ElMessage.success('图片插入成功')

    } catch (error) {
      logger.error('图片处理失败:', error)
      ElMessage.error('图片处理失败：' + getErrorMessage(error, '请重试'))
    } finally {
      uploading.value = false
    }
  }

  // 点击上传按钮
  const handleImageUpload = () => {
    fileInputRef.value?.click()
  }

  // 选择文件
  const handleFileSelect = async (e: Event) => {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0]
    if (file) {
      await processImage(file)
    }
    // 重置input，允许重复选择同一文件
    if (target) {
      target.value = ''
    }
  }

  // 插入图片到编辑器
  const insertImage = (url: string) => {
    if (!editorRef.value) return

    // 确保编辑器聚焦
    editorRef.value.focus()

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      // 如果没有选区，直接在末尾插入
      const img = document.createElement('img')
      img.src = url
      img.style.maxWidth = '100%'
      img.style.height = 'auto'
      img.style.margin = '12px 0'
      img.style.borderRadius = '4px'
      img.style.display = 'block'
      editorRef.value.appendChild(img)
      editorRef.value.appendChild(document.createElement('br'))
    } else {
      // 在选区位置插入
      const range = selection.getRangeAt(0)
      range.deleteContents()

      const img = document.createElement('img')
      img.src = url
      img.style.maxWidth = '100%'
      img.style.height = 'auto'
      img.style.margin = '12px 0'
      img.style.borderRadius = '4px'
      img.style.display = 'block'

      range.insertNode(img)

      // 在图片后插入换行
      range.collapse(false)
      const br = document.createElement('br')
      range.insertNode(br)

      // 移动光标到图片后面
      selection.removeAllRanges()
      selection.addRange(range)
    }

    handleInput()
  }

  // 处理输入
  const handleInput = () => {
    if (!editorRef.value) return

    let html = editorRef.value.innerHTML

    // 清理可能存在的 base64 图片
    const base64ImgRegex = /<img[^>]+src=["']data:image[^>]+>/gi
    const base64Imgs = html.match(base64ImgRegex)
    if (base64Imgs && base64Imgs.length > 0) {
      // 移除 base64 图片并提示
      html = html.replace(base64ImgRegex, '')
      ElMessage.warning('检测到未上传的图片，已自动移除，请使用编辑器的上传功能插入图片')
      editorRef.value.innerHTML = html
    }

    // 限制长度
    const textContent = editorRef.value.textContent || ''
    if (textContent.length > props.maxLength) {
      // 截断内容
      let currentLength = 0
      const truncateNode = (node: Node) => {
        if (currentLength >= props.maxLength) {
          node.textContent = ''
          return
        }

        if (node.nodeType === Node.TEXT_NODE) {
          const remaining = props.maxLength - currentLength
          if (node.textContent && node.textContent.length > remaining) {
            node.textContent = node.textContent.substring(0, remaining)
          }
          currentLength += node.textContent?.length || 0
        } else if (node.hasChildNodes()) {
          for (let i = node.childNodes.length - 1; i >= 0; i--) {
            truncateNode(node.childNodes[i])
          }
        }
      }
      truncateNode(editorRef.value)
      html = editorRef.value.innerHTML
    }

    emitUpdate(html)
  }

  // 监听外部值变化
  watch(() => props.modelValue, (newValue) => {
    if (editorRef.value && editorRef.value.innerHTML !== newValue) {
      editorRef.value.innerHTML = newValue || ''
    }
  })

  // 插入图片（供外部调用，用于手机端）
  const insertImageFromFile = (file: File) => {
    processImage(file)
  }

  // 清空内容
  const clear = () => {
    if (editorRef.value) {
      editorRef.value.innerHTML = ''
      emitUpdate('')
    }
  }

  onMounted(() => {
    nextTick(() => {
      initEditor()
    })
  })

  return {
    editorRef,
    fileInputRef,
    uploading,
    currentLength,
    handlePaste,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleInput,
    handleImageUpload,
    handleFileSelect,
    insertImageFromFile,
    clear
  }
}
