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
    />

    <div class="editor-toolbar">
      <div class="toolbar-left">
        <el-button
          type="primary"
          size="small"
          :icon="PictureFilled"
          class="upload-btn"
          @click="handleImageUpload"
        >
          插入图片
        </el-button>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          style="display: none;"
          @change="handleFileSelect"
        >
      </div>

      <div class="toolbar-right">
        <span class="editor-tip">
          <el-icon><InfoFilled /></el-icon>
          支持拖拽、复制粘贴或点击按钮上传图片
        </span>
        <span
          class="word-count"
          :class="{ warning: currentLength > maxLength * 0.9 }"
        >
          {{ currentLength }} / {{ maxLength }}
        </span>
      </div>
    </div>

    <div
      v-if="uploading"
      class="uploading-overlay"
    >
      <div class="uploading-content">
        <el-icon
          class="loading-icon"
          :size="32"
        >
          <Loading />
        </el-icon>
        <span class="uploading-text">图片上传中...</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PictureFilled, InfoFilled, Loading } from '@element-plus/icons-vue'
import { useRichEditor } from '../composables/useRichEditor'

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

const {
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
} = useRichEditor(props, (html) => emit('update:modelValue', html))

defineExpose({
  insertImage: insertImageFromFile,
  clear
})
</script>

<style scoped lang="scss" src="./rich-editor/RichTextEditor.scss"></style>
