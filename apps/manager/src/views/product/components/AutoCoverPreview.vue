<template>
  <div class="auto-cover-preview">
    <el-image
      v-if="displayUrl"
      :src="displayUrl"
      fit="cover"
      class="cover-image"
      :preview-src-list="[displayUrl]"
      preview-teleported
    />
    <div
      v-else
      class="cover-placeholder"
    >
      <el-icon class="placeholder-icon">
        <Picture />
      </el-icon>
      <span>填写产品标题并选择分类后，系统会自动生成封面</span>
    </div>
    <div class="cover-hint">
      {{ hint }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Picture } from '@element-plus/icons-vue'
import type { ProductCategory } from '@promo/shared/types'
import { buildCoverTemplate, isAutoCover } from '../utils/coverTemplate'
import { renderCoverBlob } from '../utils/coverRenderer'

const props = defineProps<{
  cover: string
  title: string
  category: string
  categories: ProductCategory[]
}>()

// 人工上传的封面保持原样，不参与本地重绘
const hasManualCover = computed(() => !!props.cover && !isAutoCover(props.cover))

const previewUrl = ref('')
let objectUrl = ''
let timer: ReturnType<typeof setTimeout> | null = null
let renderSeq = 0

const releaseObjectUrl = () => {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = ''
  }
}

const displayUrl = computed(() => {
  if (hasManualCover.value) return props.cover
  return previewUrl.value || props.cover || ''
})

const hint = computed(() => {
  if (hasManualCover.value) return '该产品已有封面，将保持不变'
  if (props.cover) return '封面由系统自动生成，修改标题或分类后保存会自动更新'
  return '封面由系统自动生成，无需手动上传'
})

const renderPreview = async () => {
  const token = (renderSeq += 1)
  const title = (props.title || '').trim()
  const category = props.categories.find((item) => item.value === props.category)

  if (hasManualCover.value || !title || !category) {
    releaseObjectUrl()
    previewUrl.value = ''
    return
  }

  try {
    const blob = await renderCoverBlob(buildCoverTemplate(category), title)
    if (token !== renderSeq) return
    releaseObjectUrl()
    objectUrl = URL.createObjectURL(blob)
    previewUrl.value = objectUrl
  } catch {
    // 预览失败时回退到已有封面或占位，不影响保存
    if (token !== renderSeq) return
    releaseObjectUrl()
    previewUrl.value = ''
  }
}

const schedulePreview = () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(renderPreview, 300)
}

watch(
  () => [props.title, props.category, props.cover, props.categories],
  schedulePreview,
  { immediate: true }
)

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
  releaseObjectUrl()
})
</script>

<style lang="scss" scoped>
.auto-cover-preview {
  width: 320px;

  .cover-image {
    width: 320px;
    height: 160px;
    border-radius: 8px;
    background: #f6eedf;
  }

  .cover-placeholder {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    justify-content: center;
    width: 320px;
    height: 160px;
    padding: 0 24px;
    font-size: 12px;
    color: #909399;
    text-align: center;
    background: #f6eedf;
    border-radius: 8px;

    .placeholder-icon {
      font-size: 28px;
      color: #c0b39a;
    }
  }

  .cover-hint {
    margin-top: 8px;
    font-size: 12px;
    line-height: 1.4;
    color: #909399;
  }
}
</style>
