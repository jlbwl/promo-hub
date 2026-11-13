<template>
  <div v-loading="loading" class="customer-card-grid">
    <div v-if="data.length === 0" class="card-grid-empty">暂无客户数据</div>
    <div v-else class="customer-grid">
      <div v-for="row in data" :key="row.id" class="customer-card">
        <div class="card-header">
          <div class="card-title">
            <span class="group-name">#{{ row.groupName }}</span>
            <el-tag :type="payMethodTagType(row.payMethod)" size="small">
              {{ row.payMethodLabel }}
            </el-tag>
          </div>
        </div>

        <div class="card-body">
          <div class="info-row">
            <span>对接人:</span>
            <span class="info-value">{{ row.contactName || '-' }}</span>
          </div>
          <div class="info-row">
            <span>备注/卡号:</span>
            <span class="info-value">{{ row.cardNo || '-' }}</span>
          </div>
          <div class="qr-section">
            <el-image
              v-if="row.qrCodeUrl"
              class="qr-image"
              :src="row.qrCodeUrl"
              :preview-src-list="[row.qrCodeUrl]"
              preview-teleported
              hide-on-click-modal
              fit="contain"
            >
              <template #error>
                <div class="qr-placeholder">收款码加载失败</div>
              </template>
            </el-image>
            <div v-else class="qr-placeholder">未上传收款码</div>
          </div>
        </div>

        <div class="card-footer">
          <el-button text type="primary" size="small" @click="emit('edit', row)">
            编辑
          </el-button>
          <el-button text type="primary" size="small" @click="pickFile(row)">
            换码
          </el-button>
          <el-button text type="danger" size="small" @click="emit('delete', row)">
            删除
          </el-button>
        </div>
      </div>
    </div>

    <input
      ref="fileInputRef"
      class="hidden-file-input"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      @change="handleFileChange"
    >
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { CustomerItem } from '../utils'

defineProps<{
  data: CustomerItem[]
  loading: boolean
}>()

const emit = defineEmits<{
  edit: [row: CustomerItem]
  delete: [row: CustomerItem]
  'replace-qrcode': [row: CustomerItem, file: File]
}>()

const payMethodTagType = (payMethod: string): 'primary' | 'success' | 'warning' => {
  if (payMethod === 'wechat') return 'success'
  if (payMethod === 'usdt') return 'warning'
  return 'primary'
}

// 卡片共用同一个隐藏 file input，避免每张卡片各挂一个
const fileInputRef = ref<HTMLInputElement | null>(null)
const pendingRow = ref<CustomerItem | null>(null)

const pickFile = (row: CustomerItem): void => {
  pendingRow.value = row
  fileInputRef.value?.click()
}

const handleFileChange = (event: Event): void => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const row = pendingRow.value
  // 清空以便连续选择同一张图片也能触发 change
  input.value = ''
  pendingRow.value = null
  if (!row || !file) return
  emit('replace-qrcode', row, file)
}
</script>

<style lang="scss" scoped>
.customer-card-grid {
  margin-top: 16px;
  min-height: 180px;
}

.customer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.customer-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-4px);
    border-color: var(--el-color-primary);
    box-shadow: 0 8px 12px rgba(0, 0, 0, 0.1);
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 15px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.group-name {
  overflow: hidden;
  font-size: 16px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  padding: 15px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.info-value {
  max-width: 60%;
  font-weight: 600;
  color: var(--el-text-color-primary);
  text-align: right;
  word-break: break-all;
}

.qr-section {
  padding: 10px;
  margin-top: 4px;
  text-align: center;
  background: var(--el-fill-color-lighter);
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
}

/* 二维码必须 contain：cover 会裁掉边缘导致扫不出来 */
.qr-image {
  display: block;
  width: 120px;
  height: 120px;
  margin: 0 auto;
  overflow: hidden;
  cursor: pointer;
  background: #fff;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.qr-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  margin: 0 auto;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.card-footer {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  padding: 10px 15px;
  background: var(--el-fill-color-light);
  border-top: 1px solid var(--el-border-color-lighter);
}

.card-grid-empty {
  padding: 40px;
  text-align: center;
  color: var(--el-text-color-secondary);
}

.hidden-file-input {
  display: none;
}

@media (max-width: 768px) {
  .customer-grid {
    grid-template-columns: 1fr;
  }
}
</style>
