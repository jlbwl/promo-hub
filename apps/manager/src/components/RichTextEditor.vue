<template>
  <div
    ref="editorRef"
    class="rich-text-editor"
    contenteditable="true"
    :placeholder="placeholder"
    @paste="handlePaste"
    @dragover.prevent="handleDragOver"
    @drop.prevent="handleDrop"
    @input="handleInput"
  ></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'

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

// 图片压缩配置
const COMPRESS_CONFIG = {
  maxWidth: 1024,
  maxHeight: 1024,
  quality: 0.8,
  maxFileSize: 5 * 1024 * 1024 // 5MB
}

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
  
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (file) {
        await uploadImage(file)
      }
    }
  }
}

// 处理拖拽悬停
const handleDragOver = (e: DragEvent) => {
  e.dataTransfer!.dropEffect = 'copy'
  editorRef.value?.classList.add('drag-over')
}

// 处理拖拽放下
const handleDrop = async (e: DragEvent) => {
  editorRef.value?.classList.remove('drag-over')
  
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (file.type.startsWith('image/')) {
      await uploadImage(file)
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
      
      if (width > COMPRESS_CONFIG.maxWidth) {
        height = (height * COMPRESS_CONFIG.maxWidth) / width
        width = COMPRESS_CONFIG.maxWidth
      }
      
      if (height > COMPRESS_CONFIG.maxHeight) {
        width = (width * COMPRESS_CONFIG.maxHeight) / height
        height = COMPRESS_CONFIG.maxHeight
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
        'image/jpeg',
        COMPRESS_CONFIG.quality
      )
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    
    img.src = url
  })
}

// 上传图片（模拟上传）
const uploadImage = async (file: File) => {
  try {
    // 压缩图片
    const compressedBlob = await compressImage(file)
    const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' })
    
    console.log(`[图片压缩] 原大小: ${(file.size / 1024).toFixed(1)}KB, 压缩后: ${(compressedFile.size / 1024).toFixed(1)}KB`)
    
    // 模拟上传到服务器
    // 实际项目中应该调用上传接口
    const formData = new FormData()
    formData.append('file', compressedFile)
    
    // 这里使用占位图模拟上传结果
    const imageUrl = `https://neeko-copilot.bytedance.net/api/text_to_image?prompt=product%20image&image_size=landscape_16_9`
    
    // 插入图片到编辑器
    insertImage(imageUrl)
    
  } catch (error: any) {
    console.error('图片上传失败:', error)
    alert('图片上传失败：' + error.message)
  }
}

// 插入图片到编辑器
const insertImage = (url: string) => {
  if (!editorRef.value) return
  
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    // 如果没有选区，直接在末尾插入
    const img = document.createElement('img')
    img.src = url
    img.style.maxWidth = '100%'
    img.style.height = 'auto'
    img.style.margin = '4px 0'
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
    img.style.margin = '4px 0'
    
    range.insertNode(img)
    
    // 在图片后插入换行
    range.collapse(false)
    const br = document.createElement('br')
    range.insertNode(br)
  }
  
  handleInput()
}

// 处理输入
const handleInput = () => {
  if (!editorRef.value) return
  
  let html = editorRef.value.innerHTML
  
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
  uploadImage(file)
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
.rich-text-editor {
  min-height: 200px;
  padding: 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  outline: none;
  font-size: 14px;
  line-height: 1.6;
  color: #606266;
  background: #fff;
  transition: all 0.3s;
  
  &:hover {
    border-color: #c0c4cc;
  }
  
  &:focus {
    border-color: #409eff;
    box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
  }
  
  &.drag-over {
    border-color: #409eff;
    background: rgba(64, 158, 255, 0.05);
    box-shadow: inset 0 0 12px rgba(64, 158, 255, 0.1);
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
    border-radius: 4px;
    margin: 4px 0;
    vertical-align: middle;
  }
  
  // 段落样式
  p {
    margin: 0 0 8px 0;
  }
  
  // 列表样式
  ul, ol {
    padding-left: 20px;
    margin: 8px 0;
  }
  
  // 链接样式
  a {
    color: #409eff;
    text-decoration: none;
    
    &:hover {
      text-decoration: underline;
    }
  }
}
</style>