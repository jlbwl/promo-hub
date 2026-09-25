<template>
  <div class="upload-area">
    <!-- 已上传的图片预览 -->
    <div
      v-if="cover"
      class="image-preview-wrapper"
    >
      <el-image
        :src="cover"
        fit="cover"
        style="width: 200px; height: 200px; border-radius: 8px;"
        :preview-src-list="[cover]"
      />
      <div class="image-actions">
        <el-button
          type="primary"
          size="small"
          @click="triggerUpload"
        >
          更换图片
        </el-button>
        <el-button
          type="danger"
          size="small"
          @click="removeCover"
        >
          删除图片
        </el-button>
      </div>
      <div
        v-if="coverInfo"
        class="image-info"
      >
        <span>尺寸: {{ coverInfo.width }}x{{ coverInfo.height }}</span>
        <span v-if="coverInfo.size">
          大小: {{ (coverInfo.size / 1024).toFixed(1) }}KB
        </span>
      </div>
    </div>

    <!-- 上传区域 -->
    <div v-else>
      <el-upload
        ref="uploadRef"
        class="cover-uploader"
        :show-file-list="false"
        :auto-upload="false"
        :on-change="handleFileChange"
        :before-upload="beforeUpload"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        drag
      >
        <el-icon class="el-icon--upload">
          <UploadFilled />
        </el-icon>
        <div class="el-upload__text">
          拖拽图片到此处或 <em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            建议尺寸 800x800，支持 JPG/PNG/WebP，文件大小不超过 5MB
          </div>
        </template>
      </el-upload>
    </div>

    <!-- 上传进度 -->
    <el-progress
      v-if="uploading"
      :percentage="uploadProgress"
      :status="uploadProgress === 100 ? 'success' : undefined"
      style="margin-top: 12px; width: 200px;"
    />
  </div>
</template>

<script setup lang="ts">
import { logger } from '@promo/shared/utils/logger'
import { getErrorMessage } from '@promo/shared/utils/errors'
import { ref } from 'vue'
import { ElMessage, ElMessageBox, type UploadProps } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'

// 封面图片信息
interface CoverImageInfo {
  width: number
  height: number
  size: number
}

defineProps<{
  cover: string
  coverInfo: CoverImageInfo | null
}>()

const emit = defineEmits<{
  'update:cover': [value: string]
  'update:coverInfo': [value: CoverImageInfo | null]
}>()

// 上传组件引用
const uploadRef = ref()

// 上传状态
const uploading = ref(false)
const uploadProgress = ref(0)

// 封面图片配置
const COVER_CONFIG = {
  maxSize: 5 * 1024 * 1024, // 5MB
  supportedFormats: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
}

// 文件选择前验证
const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  const isImage = COVER_CONFIG.supportedFormats.includes(file.type)
  if (!isImage) {
    ElMessage.error('只支持 JPG/PNG/WebP 格式的图片!')
    return false
  }
  const isLt5M = file.size <= COVER_CONFIG.maxSize
  if (!isLt5M) {
    ElMessage.error('图片大小不能超过 5MB!')
    return false
  }
  return true
}

// 文件选择变化处理
const handleFileChange: UploadProps['onChange'] = async (file) => {
  const rawFile = file.raw
  if (!rawFile) return

  // 验证文件
  const isValid = beforeUpload(rawFile)
  if (!isValid) return

  await uploadCoverImage(rawFile)
}

// 触发上传
const triggerUpload = () => {
  uploadRef.value?.$el.querySelector('input[type="file"]')?.click()
}

// 上传封面图片
const uploadCoverImage = async (file: File) => {
  uploading.value = true
  uploadProgress.value = 0

  try {
    const formData = new FormData()
    formData.append('cover', file)

    // 模拟上传进度
    const progressInterval = setInterval(() => {
      if (uploadProgress.value < 90) {
        uploadProgress.value += 10
      }
    }, 200)

    // 发送上传请求
    const response = await fetch('/api/upload/cover', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })

    clearInterval(progressInterval)
    uploadProgress.value = 100

    const result = await response.json()

    if (result.code === 0) {
      emit('update:cover', result.data.url)
      emit('update:coverInfo', {
        width: result.data.width,
        height: result.data.height,
        size: result.data.size,
      })
      ElMessage.success('封面图片上传成功')

      // 延迟隐藏进度条
      setTimeout(() => {
        uploading.value = false
        uploadProgress.value = 0
      }, 1000)
    } else {
      throw new Error(result.message || '上传失败')
    }
  } catch (error) {
    logger.error('封面图片上传失败:', error)
    ElMessage.error(getErrorMessage(error, '上传失败，请重试'))
    uploading.value = false
    uploadProgress.value = 0
  }
}

// 删除封面图片
const removeCover = () => {
  ElMessageBox.confirm('确定要删除封面图片吗?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      emit('update:cover', '')
      emit('update:coverInfo', null)
      ElMessage.success('已删除')
    })
    .catch(() => {})
}
</script>

<style lang="scss" scoped>
.upload-area {
  .image-preview-wrapper {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;

    .image-actions {
      display: flex;
      gap: 8px;
    }

    .image-info {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: #909399;
    }
  }

  .cover-uploader {
    :deep(.el-upload) {
      width: 200px;
      height: 200px;
    }

    :deep(.el-upload-dragger) {
      width: 200px;
      height: 200px;
      border-radius: 8px;

      &:hover {
        border-color: #409eff;
      }
    }

    .el-icon--upload {
      font-size: 48px;
      color: #8c939d;
    }

    .el-upload__text {
      margin-top: 8px;
      color: #606266;
      font-size: 14px;

      em {
        color: #409eff;
        font-style: normal;
      }
    }

    .el-upload__tip {
      margin-top: 8px;
      font-size: 12px;
      color: #909399;
    }
  }
}
</style>
