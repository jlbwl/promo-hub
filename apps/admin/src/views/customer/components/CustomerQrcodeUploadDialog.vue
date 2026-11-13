<template>
  <el-dialog
    v-model="visible"
    title="批量上传收款码"
    width="780px"
    destroy-on-close
    @closed="reset"
  >
    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="图片按文件名中的群号简称匹配客户，支持多选图片或 ZIP 压缩包（前端解压）。"
      description="仅接受 png/jpg/jpeg/webp，单张不超过 5MB；同一群号对应多张图片会列为冲突，不会上传。"
    />

    <div class="pick-row">
      <el-upload
        :auto-upload="false"
        :show-file-list="false"
        multiple
        accept="image/png,image/jpeg,image/webp"
        :on-change="handleImagesChange"
      >
        <el-button icon="Picture" :loading="zipParsing">
          选择图片
        </el-button>
      </el-upload>

      <el-upload
        :auto-upload="false"
        :show-file-list="false"
        accept=".zip"
        :on-change="handleZipChange"
      >
        <el-button icon="Files" :loading="zipParsing">
          选择 ZIP
        </el-button>
      </el-upload>

      <span class="picked-count">已选择 {{ picked.length }} 个文件</span>
      <el-button v-if="picked.length" text type="danger" @click="clearPicked">
        清空
      </el-button>

      <el-button
        type="primary"
        plain
        :loading="previewing"
        :disabled="picked.length === 0"
        @click="handlePreview"
      >
        解析匹配
      </el-button>
    </div>

    <template v-if="plan">
      <el-descriptions :column="3" border class="plan-summary">
        <el-descriptions-item label="匹配成功群号">
          {{ plan.matchedGroupCount }}
        </el-descriptions-item>
        <el-descriptions-item label="找不到客户">
          {{ plan.unmatchedGroups.length }}
        </el-descriptions-item>
        <el-descriptions-item label="重名冲突">
          {{ plan.conflicts.length }}
        </el-descriptions-item>
        <el-descriptions-item label="格式不支持">
          {{ plan.unsupported.length }}
        </el-descriptions-item>
        <el-descriptions-item label="超过 5MB">
          {{ plan.oversize.length }}
        </el-descriptions-item>
        <el-descriptions-item label="无法识别群号">
          {{ plan.unparsed.length }}
        </el-descriptions-item>
      </el-descriptions>

      <div v-if="plan.unmatchedGroups.length" class="issue-block">
        <div class="issue-title">找不到对应客户的群号</div>
        <div class="tag-list">
          <el-tag v-for="group in plan.unmatchedGroups" :key="group" type="warning" size="small">
            {{ group }}
          </el-tag>
        </div>
      </div>

      <div v-if="plan.conflicts.length" class="issue-block">
        <div class="issue-title">重名冲突（同一群号多张图片，已跳过）</div>
        <el-table :data="plan.conflicts" size="small" border max-height="180">
          <el-table-column prop="groupName" label="群号简称" width="180" show-overflow-tooltip />
          <el-table-column label="文件" min-width="320">
            <template #default="{ row }">
              {{ row.fileNames.join('、') }}
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div v-if="plan.unsupported.length" class="issue-block">
        <div class="issue-title">格式不支持</div>
        <div class="tag-list">
          <el-tag v-for="name in plan.unsupported" :key="name" type="info" size="small">
            {{ name }}
          </el-tag>
        </div>
      </div>

      <div v-if="plan.oversize.length" class="issue-block">
        <div class="issue-title">超过 5MB</div>
        <div class="tag-list">
          <el-tag v-for="name in plan.oversize" :key="name" type="danger" size="small">
            {{ name }}
          </el-tag>
        </div>
      </div>

      <div v-if="plan.unparsed.length" class="issue-block">
        <div class="issue-title">无法从文件名识别群号</div>
        <div class="tag-list">
          <el-tag v-for="name in plan.unparsed" :key="name" type="info" size="small">
            {{ name }}
          </el-tag>
        </div>
      </div>
    </template>

    <el-progress
      v-if="uploading"
      class="upload-progress"
      :percentage="progressPercent"
      :format="() => `${progress.done}/${progress.total}`"
    />

    <div v-if="result" class="issue-block">
      <div class="issue-title">
        上传完成：成功 {{ result.success }} 张，失败 {{ result.failures.length }} 张
      </div>
      <el-table
        v-if="result.failures.length"
        :data="result.failures"
        size="small"
        border
        max-height="200"
      >
        <el-table-column prop="groupName" label="群号简称" width="150" show-overflow-tooltip />
        <el-table-column prop="fileName" label="文件" width="200" show-overflow-tooltip />
        <el-table-column label="阶段" width="90">
          <template #default="{ row }">
            {{ row.stage === 'save' ? '回写档案' : '上传图片' }}
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="原因" min-width="240" show-overflow-tooltip />
      </el-table>
    </div>

    <template #footer>
      <el-button @click="visible = false">
        关闭
      </el-button>
      <el-button
        type="primary"
        :loading="uploading"
        :disabled="!plan || plan.targets.length === 0 || !!result"
        @click="handleUpload"
      >
        确认上传（{{ plan?.targets.length || 0 }} 张）
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, type UploadFile } from 'element-plus'
import { get, post, put } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import {
  buildQrcodePlan,
  pickLocalImages,
  readZipEntries,
  runQrcodeUploads,
  type PickedImage,
  type QrcodePlan,
  type QrcodeUploadResult,
} from '../qrcodeUtils'

const emit = defineEmits<{ success: [] }>()

const visible = ref(false)
const zipParsing = ref(false)
const previewing = ref(false)
const uploading = ref(false)

const picked = ref<PickedImage[]>([])
const plan = ref<QrcodePlan | null>(null)
const result = ref<QrcodeUploadResult | null>(null)
const progress = ref({ done: 0, total: 0 })

const progressPercent = computed(() =>
  progress.value.total === 0 ? 0 : Math.round((progress.value.done / progress.value.total) * 100)
)

const open = () => {
  reset()
  visible.value = true
}

const reset = () => {
  picked.value = []
  plan.value = null
  result.value = null
  progress.value = { done: 0, total: 0 }
  zipParsing.value = false
  previewing.value = false
  uploading.value = false
}

const appendPicked = (items: PickedImage[]) => {
  if (items.length > 0) {
    picked.value = [...picked.value, ...items]
    // 文件变化后旧预览失效
    plan.value = null
    result.value = null
  }
}

const handleImagesChange = (uploadFile: UploadFile) => {
  if (uploadFile.raw) {
    appendPicked(pickLocalImages([uploadFile.raw]))
  }
}

const handleZipChange = async (uploadFile: UploadFile) => {
  const file = uploadFile.raw
  if (!file) return
  zipParsing.value = true
  try {
    const entries = await readZipEntries(file)
    appendPicked(entries)
    if (entries.length === 0) {
      ElMessage.warning('压缩包内没有可用文件')
    }
  } catch (error) {
    ElMessage.error(getErrorMessage(error, 'ZIP 解析失败'))
  } finally {
    zipParsing.value = false
  }
}

const clearPicked = () => {
  picked.value = []
  plan.value = null
  result.value = null
}

const handlePreview = async () => {
  if (picked.value.length === 0) return
  previewing.value = true
  try {
    const res = await get<{
      list: Array<{ id: string; groupName: string }>
      truncated: boolean
    }>('/admin/customers/export')
    const customers = res.data?.list || []
    if (res.data?.truncated) {
      ElMessage.warning('客户数量超过导出上限，部分群号可能无法匹配')
    }
    plan.value = buildQrcodePlan(picked.value, customers)
    result.value = null
    if (plan.value.targets.length === 0) {
      ElMessage.warning('没有可上传的收款码，请查看预览明细')
    }
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '匹配失败'))
  } finally {
    previewing.value = false
  }
}

const handleUpload = async () => {
  if (!plan.value || plan.value.targets.length === 0) return
  uploading.value = true
  progress.value = { done: 0, total: plan.value.targets.length }
  try {
    const uploadResult = await runQrcodeUploads(plan.value.targets, {
      upload: async (blob, fileName) => {
        const formData = new FormData()
        formData.append('file', blob, fileName)
        const res = await post<{ url: string }>('/admin/customers/qrcode/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        return res.data?.url || ''
      },
      save: async (customerId, url) => {
        await put(`/admin/customers/${customerId}/qrcode`, { url })
      },
      onProgress: (done, total) => {
        progress.value = { done, total }
      },
    })
    result.value = uploadResult
    if (uploadResult.success > 0) {
      emit('success')
    }
    if (uploadResult.failures.length > 0) {
      ElMessage.warning(`有 ${uploadResult.failures.length} 张上传失败，请查看明细`)
    } else {
      ElMessage.success('收款码上传完成')
    }
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '上传失败'))
  } finally {
    uploading.value = false
  }
}

defineExpose({ open })
</script>

<style lang="scss" scoped>
.pick-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 16px;

  .picked-count {
    font-size: 13px;
    color: #606266;
  }
}

.plan-summary {
  margin-top: 16px;
}

.issue-block {
  margin-top: 14px;

  .issue-title {
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 600;
    color: #303133;
  }
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 120px;
  overflow-y: auto;
}

.upload-progress {
  margin-top: 16px;
}
</style>
