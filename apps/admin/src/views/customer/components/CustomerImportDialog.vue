<template>
  <el-dialog
    v-model="visible"
    title="批量导入客户"
    width="760px"
    destroy-on-close
    @closed="reset"
  >
    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="按「群号简称」判重，增量合并，不会清空既有数据；导入前请先预览确认。"
      description="支持源项目「客户预设」「客户数据」导出的文件：群号简称、对接人、收款方式、卡号/备注、是否有收款码、使用次数；多余列自动忽略。"
    />

    <div class="upload-row">
      <el-upload
        :auto-upload="false"
        :show-file-list="false"
        accept=".xlsx,.xls"
        :on-change="handleFileChange"
      >
        <el-button icon="FolderOpened" :loading="parsing">
          选择 Excel 文件
        </el-button>
      </el-upload>
      <span class="file-name">{{ fileName || '未选择文件' }}</span>
      <el-button v-if="rows.length" text type="primary" @click="emit('template')">
        下载模板
      </el-button>
    </div>

    <div v-if="rows.length" class="file-summary">
      已解析 {{ rows.length }} 行数据
      <span v-if="ignoredHeaders.length">（已忽略列：{{ ignoredHeaders.join('、') }}）</span>
    </div>

    <div class="mode-row">
      <span class="label">遇到已存在的群号简称：</span>
      <el-radio-group v-model="mode" @change="preview = null">
        <el-radio value="overwrite">
          覆盖更新
        </el-radio>
        <el-radio value="skip">
          跳过
        </el-radio>
      </el-radio-group>
      <el-button
        type="primary"
        plain
        :loading="previewing"
        :disabled="rows.length === 0"
        @click="handlePreview"
      >
        预览导入结果
      </el-button>
    </div>

    <template v-if="preview">
      <el-descriptions :column="4" border class="preview-summary">
        <el-descriptions-item label="新增">
          {{ preview.created }}
        </el-descriptions-item>
        <el-descriptions-item label="更新">
          {{ preview.updated }}
        </el-descriptions-item>
        <el-descriptions-item label="跳过">
          {{ preview.skipped }}
        </el-descriptions-item>
        <el-descriptions-item label="错误">
          {{ preview.errors }}
        </el-descriptions-item>
      </el-descriptions>

      <div v-if="preview.errorRows.length" class="issue-block">
        <div class="issue-header">
          <span class="issue-title">错误行（不会导入）</span>
          <el-button text type="primary" @click="downloadIssues(preview.errorRows, '导入错误行')">
            下载错误行
          </el-button>
        </div>
        <el-table :data="preview.errorRows" size="small" border max-height="200">
          <el-table-column prop="rowNumber" label="行号" width="80" />
          <el-table-column prop="groupName" label="群号简称" width="160" show-overflow-tooltip />
          <el-table-column prop="reason" label="原因" min-width="280" show-overflow-tooltip />
        </el-table>
      </div>

      <div v-if="preview.skippedRows.length" class="issue-block">
        <div class="issue-header">
          <span class="issue-title">跳过行</span>
          <el-button text type="primary" @click="downloadIssues(preview.skippedRows, '导入跳过行')">
            下载跳过行
          </el-button>
        </div>
        <el-table :data="preview.skippedRows" size="small" border max-height="160">
          <el-table-column prop="rowNumber" label="行号" width="80" />
          <el-table-column prop="groupName" label="群号简称" width="160" show-overflow-tooltip />
          <el-table-column prop="reason" label="原因" min-width="280" show-overflow-tooltip />
        </el-table>
      </div>
    </template>

    <template #footer>
      <el-button @click="visible = false">
        取消
      </el-button>
      <el-button
        type="primary"
        :loading="importing"
        :disabled="!canImport"
        @click="handleImport"
      >
        确认导入
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, type UploadFile } from 'element-plus'
import { post } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import {
  buildImportIssueWorkbook,
  downloadWorkbook,
  parseCustomerWorkbook,
  type CustomerImportIssue,
  type CustomerImportMode,
  type CustomerImportResult,
  type CustomerImportRowPayload,
} from '../utils'

const emit = defineEmits<{ success: []; template: [] }>()

const visible = ref(false)
const parsing = ref(false)
const previewing = ref(false)
const importing = ref(false)

const fileName = ref('')
const rows = ref<CustomerImportRowPayload[]>([])
const ignoredHeaders = ref<string[]>([])
const mode = ref<CustomerImportMode>('overwrite')
const preview = ref<CustomerImportResult | null>(null)

const canImport = computed(
  () => !!preview.value && preview.value.created + preview.value.updated > 0 && !importing.value
)

const open = () => {
  reset()
  visible.value = true
}

const reset = () => {
  parsing.value = false
  previewing.value = false
  importing.value = false
  fileName.value = ''
  rows.value = []
  ignoredHeaders.value = []
  mode.value = 'overwrite'
  preview.value = null
}

const handleFileChange = async (uploadFile: UploadFile) => {
  const file = uploadFile.raw
  if (!file) return

  parsing.value = true
  preview.value = null
  try {
    const result = await parseCustomerWorkbook(file)
    fileName.value = file.name
    rows.value = result.rows
    ignoredHeaders.value = result.ignoredHeaders
    if (result.rows.length === 0) {
      ElMessage.warning('文件中没有可导入的数据行')
    }
  } catch (error) {
    fileName.value = ''
    rows.value = []
    ignoredHeaders.value = []
    ElMessage.error(getErrorMessage(error, '文件解析失败'))
  } finally {
    parsing.value = false
  }
}

const requestImport = async (dryRun: boolean): Promise<CustomerImportResult> => {
  const res = await post<CustomerImportResult>('/admin/customers/import', {
    rows: rows.value,
    mode: mode.value,
    dryRun,
  })
  return res.data
}

const handlePreview = async () => {
  if (rows.value.length === 0) return
  previewing.value = true
  try {
    preview.value = await requestImport(true)
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '预览失败'))
  } finally {
    previewing.value = false
  }
}

const handleImport = async () => {
  if (!preview.value) return
  importing.value = true
  try {
    const result = await requestImport(false)
    ElMessage.success(`导入完成：新增 ${result.created} 条，更新 ${result.updated} 条，跳过 ${result.skipped} 条`)
    visible.value = false
    emit('success')
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '导入失败'))
  } finally {
    importing.value = false
  }
}

const downloadIssues = async (issues: CustomerImportIssue[], name: string) => {
  try {
    const workbook = await buildImportIssueWorkbook(issues)
    await downloadWorkbook(workbook, `${name}_${Date.now()}.xlsx`)
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '下载失败'))
  }
}

defineExpose({ open })
</script>

<style lang="scss" scoped>
.upload-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;

  .file-name {
    color: #606266;
    font-size: 13px;
  }
}

.file-summary {
  margin-top: 8px;
  font-size: 13px;
  color: #909399;
}

.mode-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  flex-wrap: wrap;

  .label {
    font-size: 13px;
    color: #606266;
  }
}

.preview-summary {
  margin-top: 16px;
}

.issue-block {
  margin-top: 16px;

  .issue-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .issue-title {
    font-size: 13px;
    font-weight: 600;
    color: #303133;
  }
}
</style>
