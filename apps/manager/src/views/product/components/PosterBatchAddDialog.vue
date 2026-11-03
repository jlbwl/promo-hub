<template>
  <el-dialog
    :model-value="modelValue"
    title="批量添加：上传海报自动识别"
    width="720px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <!-- 批量上传区域（识别进行中也可继续追加图片，队列自动排队） -->
    <el-upload
      drag
      multiple
      :auto-upload="false"
      :show-file-list="false"
      accept=".jpg,.jpeg,.png,image/jpeg,image/png"
      :on-change="handleFileChange"
    >
      <el-icon class="el-icon--upload">
        <UploadFilled />
      </el-icon>
      <div class="el-upload__text">
        拖拽海报图片到此处，或 <em>点击选择图片</em>
      </div>
      <template #tip>
        <div class="el-upload__tip">
          支持 JPG / PNG，可一次选择多张；系统将自动识别二维码跳转链接与顶部券商名称，仅当识别到「证券/期货」名称时才生成选项行
        </div>
      </template>
    </el-upload>

    <!-- 识别进度与结果列表 -->
    <div
      v-if="items.length"
      class="poster-list"
    >
      <div class="poster-list-header">
        <span>识别列表（{{ doneCount }}/{{ items.length }}）</span>
        <el-button
          v-if="!processing && items.length"
          text
          size="small"
          @click="clearItems"
        >
          清空列表
        </el-button>
      </div>
      <div
        v-for="item in items"
        :key="item.uid"
        class="poster-item"
      >
        <img
          class="poster-thumb"
          :src="item.previewUrl"
          alt=""
        >
        <div class="poster-info">
          <div
            class="poster-name"
            :title="item.name"
          >
            {{ item.name }}
          </div>

          <template v-if="item.status === 'pending'">
            <div class="poster-status">
              等待识别
            </div>
          </template>

          <template v-else-if="item.status === 'processing'">
            <el-progress
              :percentage="item.percent"
              :stroke-width="6"
            />
            <div class="poster-status processing">
              {{ item.statusText }}
            </div>
          </template>

          <template v-else-if="item.status === 'done'">
            <div class="poster-result">
              <span class="lbl">选项</span>
              <span
                v-if="item.result?.brokerName"
              >{{ item.result.brokerName }}</span>
              <span
                v-else
                class="missing"
              >未识别到「证券/期货」名称，已跳过该行，请手动添加</span>
            </div>
            <div
              v-if="item.result?.redirectUrl"
              class="poster-result"
            >
              <span class="lbl">跳转</span>
              <span
                class="url"
                :title="item.result.redirectUrl"
              >{{ item.result.redirectUrl }}</span>
            </div>
          </template>

          <template v-else>
            <div class="poster-status failed">
              识别失败：{{ item.statusText }}，已跳过该行，请手动添加
            </div>
          </template>
        </div>
        <el-tag
          size="small"
          :type="statusTagType(item.status)"
        >
          {{ statusText(item.status) }}
        </el-tag>
      </div>
    </div>

    <template #footer>
      <div class="footer-wrap">
        <span class="footer-summary">识别结果已实时填入下方选项表格，可随时关闭并手动微调</span>
        <el-button @click="emit('update:modelValue', false)">
          关闭
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage, type UploadFile } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { getErrorMessage } from '@promo/shared/utils/errors'
import { recognizePosterFile, type PosterRecognitionResult } from '../utils/posterRecognizer'

/**
 * 批量添加弹窗：上传多张海报 → 逐张识别（二维码链接 + 券商名称 OCR）
 * 识别到「证券/期货」名称时 emit 一行数据；未识别到的图片跳过，不生成选项行
 */

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  /** 识别到「证券/期货」名称的图片完成后触发一次，rows 为该图对应的选项行 */
  'add-rows': [rows: Array<{ label: string; redirectUrl: string }>]
}>()

interface PosterTask {
  uid: number
  name: string
  file: File
  previewUrl: string
  addedAt: number
  status: 'pending' | 'processing' | 'done' | 'failed'
  percent: number
  statusText: string
  result?: PosterRecognitionResult
}

const MAX_FILE_SIZE = 30 * 1024 * 1024

const items = ref<PosterTask[]>([])
const processing = ref(false)

const doneCount = computed(() => items.value.filter(i => i.status === 'done' || i.status === 'failed').length)

const statusTagType = (status: PosterTask['status']) => {
  if (status === 'done') return 'success'
  if (status === 'failed') return 'danger'
  return 'info'
}

const statusText = (status: PosterTask['status']) => {
  if (status === 'done') return '完成'
  if (status === 'failed') return '失败'
  if (status === 'processing') return '识别中'
  return '等待'
}

// 新增图片（保持选择顺序，识别队列按此顺序处理，确保一一对应）
const handleFileChange = (uploadFile: UploadFile) => {
  const raw = uploadFile.raw
  if (!raw) return
  if (!/^image\/(jpeg|png)$/.test(raw.type)) {
    ElMessage.warning(`仅支持 JPG/PNG 图片：${raw.name}`)
    return
  }
  if (raw.size > MAX_FILE_SIZE) {
    ElMessage.warning(`图片过大（超过 30MB）：${raw.name}`)
    return
  }
  if (items.value.some(i => i.uid === uploadFile.uid)) return
  // 防御：同一文件在极短时间内重复触发 change 事件时只收录一次，保证行数与图片数一致
  const last = items.value[items.value.length - 1]
  if (last && last.name === raw.name && last.file.size === raw.size && Date.now() - last.addedAt < 800) return

  items.value.push({
    uid: uploadFile.uid,
    name: raw.name,
    file: raw,
    previewUrl: URL.createObjectURL(raw),
    addedAt: Date.now(),
    status: 'pending',
    percent: 0,
    statusText: '等待识别'
  })
  processQueue()
}

// 识别队列：逐张串行处理，避免内存峰值与进度串扰
const processQueue = async () => {
  if (processing.value) return
  processing.value = true
  try {
    for (;;) {
      const next = items.value.find(i => i.status === 'pending')
      if (!next) break
      next.status = 'processing'
      next.percent = 0
      next.statusText = '准备识别'
      try {
        const result = await recognizePosterFile(next.file, (percent, status) => {
          next.percent = percent
          next.statusText = status
        })
        next.result = result
        next.status = 'done'
      } catch (error) {
        next.statusText = getErrorMessage(error, '识别异常')
        next.status = 'failed'
      }
      // 仅当识别到「证券/期货」名称时才生成选项行；未识别到（或识别失败）直接跳过，
      // 避免把海报标题等无关文字生成为乱码选项
      if (next.result?.brokerName) {
        emit('add-rows', [{
          label: next.result.brokerName,
          redirectUrl: next.result.redirectUrl || ''
        }])
      }
    }
  } finally {
    processing.value = false
  }
}

const clearItems = () => {
  if (processing.value) return
  items.value.forEach(i => URL.revokeObjectURL(i.previewUrl))
  items.value = []
}

// 弹窗关闭且空闲时清理列表；识别进行中则保留，重新打开可查看进度
watch(() => props.modelValue, (visible) => {
  if (!visible && !processing.value) clearItems()
})

onBeforeUnmount(() => {
  items.value.forEach(i => URL.revokeObjectURL(i.previewUrl))
})
</script>

<style lang="scss" scoped>
.poster-list {
  margin-top: 14px;
  max-height: 360px;
  overflow-y: auto;
  border: 1px solid #ebeef5;
  border-radius: 4px;

  .poster-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 12px;
    background: #f5f7fa;
    font-size: 13px;
    color: #606266;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .poster-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-bottom: 1px solid #f0f2f5;

    &:last-child {
      border-bottom: none;
    }

    .poster-thumb {
      width: 52px;
      height: 52px;
      object-fit: cover;
      border-radius: 4px;
      border: 1px solid #ebeef5;
      flex-shrink: 0;
    }

    .poster-info {
      flex: 1;
      min-width: 0;

      .poster-name {
        font-size: 13px;
        color: #303133;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 2px;
      }

      .poster-status {
        font-size: 12px;
        color: #909399;

        &.processing {
          color: #409eff;
        }

        &.failed {
          color: #f56c6c;
        }
      }

      .poster-result {
        font-size: 12px;
        color: #606266;
        line-height: 1.6;
        display: flex;
        min-width: 0;

        .lbl {
          color: #909399;
          flex-shrink: 0;
          margin-right: 8px;

          &::after {
            content: '：';
          }
        }

        .url {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .missing {
          color: #e6a23c;
        }
      }

      .el-progress {
        margin: 2px 0;
      }
    }
  }
}

.footer-wrap {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .footer-summary {
    font-size: 12px;
    color: #909399;
  }
}
</style>
