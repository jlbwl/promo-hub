<template>
  <div class="rich-text-editor-wrapper">
    <div
      ref="editorRef"
      class="rich-text-editor"
      contenteditable="true"
      :placeholder="placeholder"
      @paste="handlePaste"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
      @input="handleInput"
    ></div>
    
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <el-button
          type="primary"
          size="small"
          :icon="PictureFilled"
          @click="handleImageUpload"
          class="upload-btn"
        >
          插入图片
        </el-button>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          style="display: none;"
          @change="handleFileSelect"
        />
      </div>
      
      <div class="toolbar-right">
        <span class="editor-tip">
          <el-icon><InfoFilled /></el-icon>
          支持拖拽、复制粘贴或点击按钮上传图片
        </span>
        <span class="word-count" :class="{ warning: currentLength > maxLength * 0.9 }">
          {{ currentLength }} / {{ maxLength }}
        </span>
      </div>
    </div>
    
    <div v-if="uploading" class="uploading-overlay">
      <div class="uploading-content">
        <el-icon class="loading-icon" :size="32"><Loading /></el-icon>
        <span class="uploading-text">图片上传中...</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { PictureFilled, InfoFilled, Loading } from '@element-plus/icons-vue'
import { post } from '@promo/shared/utils/request'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  maxLength?: number
}>(), {
  placeholder: '请输入内容...',
  maxLength: 5000
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const editorRef = ref<HTMLDivElement>()
const fileInputRef = ref<HTMLInputElement>()
const uploading = ref(false)
const currentLength = computed(() => {
  if (!editorRef.value) return 0
  const textContent = editorRef.value.textContent || ''
  return textContent.length
})

// 检测是否为移动设备
const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

// 压缩配置 - 根据设备类型优化
const COMPRESS_CONFIG = {
  desktop: {
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 0.85,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    mimeType: 'image/jpeg'
  },
  mobile: {
    maxWidth: 1080,
    maxHeight: 1080,
    quality: 0.7,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    mimeType: 'image/jpeg'
  }
}

const config = isMobile ? COMPRESS_CONFIG.mobile : COMPRESS_CONFIG.desktop

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

// 清理HTML
const sanitizeHtml = (html: string): string => {
  const div = document.createElement('div')
  div.innerHTML = html
  
  // 移除script标签
  const scripts = div.querySelectorAll('script')
  scripts.forEach(s => s.remove())
  
  // 移除style标签
  const styles = div.querySelectorAll('style')
  styles.forEach(s => s.remove())
  
  // 移除on*属性
  const allElements = div.querySelectorAll('*')
  allElements.forEach(el => {
    const attrs = Array.from(el.attributes)
    attrs.forEach(attr => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name)
      }
    })
  })
  
  return div.innerHTML
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

// 图片压缩
const compressImage = async (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    
    img.onload = () => {
      URL.revokeObjectURL(url)
      
      // 计算缩放比例
      let width = img.width
      let height = img.height
      
      if (width > config.maxWidth) {
        height = (height * config.maxWidth) / width
        width = config.maxWidth
      }
      
      if (height > config.maxHeight) {
        width = (width * config.maxHeight) / height
        height = config.maxHeight
      }
      
      // 创建 canvas
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas 不支持'))
        return
      }
      
      // 使用平滑绘制
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      
      // 绘制图片
      ctx.drawImage(img, 0, 0, width, height)
      
      // 转换为 Blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('图片压缩失败'))
          }
        },
        config.mimeType,
        config.quality
      )
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    
    img.src = url
  })
}

// 上传图片到服务器
const uploadToServer = async (file: File): Promise<string> => {
  const formData = new FormData()
  formData.append('file', file)
  
  const res = await post<{ url: string }>('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  
  return res.data.url
}

// 处理图片完整流程
const processImage = async (file: File) => {
  try {
    uploading.value = true
    
    // 检查文件大小
    if (file.size > config.maxFileSize * 2) { // 允许原图稍大，压缩后会变小
      ElMessage.error(`图片大小不能超过 ${(config.maxFileSize / 1024 / 1024).toFixed(0)}MB`)
      return
    }
    
    // 压缩图片
    console.log(`[图片处理] 原大小: ${(file.size / 1024).toFixed(1)}KB, 设备: ${isMobile ? '手机' : '电脑'}`)
    const compressedBlob = await compressImage(file)
    const compressedFile = new File(
      [compressedBlob], 
      file.name.replace(/\.[^.]+$/, `.${config.mimeType.split('/')[1]}`), 
      { type: config.mimeType }
    )
    console.log(`[图片压缩] 压缩后: ${(compressedFile.size / 1024).toFixed(1)}KB, 压缩比: ${((1 - compressedFile.size / file.size) * 100).toFixed(1)}%`)
    
    // 上传到服务器
    const imageUrl = await uploadToServer(compressedFile)
    
    // 插入图片到编辑器
    insertImage(imageUrl)
    
    ElMessage.success('图片插入成功')
    
  } catch (error: any) {
    console.error('图片处理失败:', error)
    ElMessage.error('图片处理失败：' + (error.message || '请重试'))
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
  
  emit('update:modelValue', html)
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
    emit('update:modelValue', '')
  }
}

onMounted(() => {
  nextTick(() => {
    initEditor()
  })
})

defineExpose({
  insertImage: insertImageFromFile,
  clear
})
</script>

<style lang="scss" scoped>
.rich-text-editor-wrapper {
  position: relative;
  
  .rich-text-editor {
    min-height: 280px;
    max-height: 600px;
    overflow-y: auto;
    padding: 16px;
    border: 1px solid #dcdfe6;
    border-radius: 8px;
    outline: none;
    font-size: 14px;
    line-height: 1.8;
    color: #303133;
    background: #fff;
    transition: all 0.3s;
    word-wrap: break-word;
    word-break: break-word;
    
    &:hover {
      border-color: #c0c4cc;
    }
    
    &:focus {
      border-color: #409eff;
      box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.15);
    }
    
    &.drag-over {
      border-color: #409eff;
      background: rgba(64, 158, 255, 0.03);
      box-shadow: inset 0 0 20px rgba(64, 158, 255, 0.1);
    }
    
    &[contenteditable="true"]:empty:before {
      content: attr(placeholder);
      color: #c0c4cc;
      pointer-events: none;
    }
    
    // 图片样式
    img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      margin: 12px 0;
      vertical-align: middle;
      display: block;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      
      &:hover {
        transform: scale(1.01);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      }
    }
    
    // 段落样式
    p {
      margin: 0 0 12px 0;
    }
    
    // 列表样式
    ul, ol {
      padding-left: 24px;
      margin: 12px 0;
      
      li {
        margin: 4px 0;
      }
    }
    
    // 链接样式
    a {
      color: #409eff;
      text-decoration: none;
      
      &:hover {
        text-decoration: underline;
      }
    }
    
    // 标题样式
    h1, h2, h3, h4, h5, h6 {
      margin: 16px 0 8px 0;
      font-weight: 600;
      color: #303133;
    }
    
    h1 { font-size: 24px; }
    h2 { font-size: 20px; }
    h3 { font-size: 18px; }
    h4 { font-size: 16px; }
    h5 { font-size: 15px; }
    h6 { font-size: 14px; }
    
    // 引用样式
    blockquote {
      border-left: 4px solid #409eff;
      padding-left: 16px;
      margin: 12px 0;
      color: #606266;
      background: #f5f7fa;
      padding: 12px 16px;
      border-radius: 0 6px 6px 0;
    }
    
    // 代码样式
    code {
      background: #f5f7fa;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
      color: #e6a23c;
    }
    
    // 分割线
    hr {
      border: none;
      border-top: 1px solid #ebeef5;
      margin: 20px 0;
    }
  }
  
  .editor-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
    padding: 10px 16px;
    background: #f5f7fa;
    border-radius: 8px;
    
    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 8px;
      
      .upload-btn {
        border-radius: 6px;
      }
    }
    
    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 16px;
      
      .editor-tip {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: #909399;
        
        .el-icon {
          font-size: 14px;
        }
      }
      
      .word-count {
        font-size: 12px;
        color: #909399;
        font-variant-numeric: tabular-nums;
        
        &.warning {
          color: #e6a23c;
        }
      }
    }
  }
  
  .uploading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 46px; // 留出工具栏高度
    background: rgba(255, 255, 255, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    z-index: 10;
    
    .uploading-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      
      .loading-icon {
        animation: spin 1s linear infinite;
        color: #409eff;
      }
      
      .uploading-text {
        font-size: 14px;
        color: #606266;
      }
    }
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

// 响应式适配
@media (max-width: 768px) {
  .rich-text-editor-wrapper {
    .rich-text-editor {
      min-height: 200px;
      padding: 12px;
      font-size: 15px;
    }
    
    .editor-toolbar {
      flex-direction: column;
      align-items: stretch;
      padding: 8px 12px;
      
      .toolbar-left {
        justify-content: center;
        
        .upload-btn {
          width: 100%;
          justify-content: center;
        }
      }
      
      .toolbar-right {
        justify-content: space-between;
        
        .editor-tip {
          display: none; // 手机端隐藏提示
        }
      }
    }
  }
}
</style>