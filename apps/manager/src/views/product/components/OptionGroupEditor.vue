<template>
  <!-- 单选框组配置 -->
  <div class="option-group-config">
    <div class="option-group-header">
      <span style="font-size: 13px; color: #606266;">用户使用时需选择的选项（如套餐、规格等）</span>
      <div>
        <el-button
          type="primary"
          size="small"
          @click="openBatchAdd"
        >
          批量添加
        </el-button>
        <el-button
          size="small"
          @click="confirmClear"
        >
          清空
        </el-button>
      </div>
    </div>

    <!-- 选项表格 -->
    <div
      v-if="options.length > 0"
      class="option-table-wrapper"
    >
      <table class="option-table">
        <thead>
          <tr>
            <th style="width: 160px;">
              选项
            </th>
            <th style="width: 120px;">
              限制做单量
            </th>
            <th style="min-width: 200px;">
              提交后跳转
            </th>
            <th style="width: 100px;">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(opt, idx) in options"
            :key="idx"
          >
            <td>
              <el-input
                :model-value="opt.label"
                placeholder="请输入"
                size="small"
                @update:model-value="emit('update-field', idx, 'label', $event)"
              />
            </td>
            <td>
              <el-input
                :model-value="opt.limit"
                placeholder="请输入"
                size="small"
                @update:model-value="emit('update-field', idx, 'limit', $event)"
              />
            </td>
            <td>
              <div class="redirect-input-wrap">
                <el-input
                  :model-value="opt.redirectUrl"
                  placeholder="输入跳转链接（不填则不跳转）"
                  size="small"
                  @update:model-value="emit('update-field', idx, 'redirectUrl', $event)"
                />
                <el-upload
                  :show-file-list="false"
                  :auto-upload="false"
                  accept="image/*"
                  @change="(file: UploadFile) => emit('qr-upload', file, idx)"
                >
                  <el-button
                    type="primary"
                    text
                    size="small"
                    :loading="opt._qrLoading"
                    title="上传二维码识别链接"
                  >
                    <el-icon><PictureFilled /></el-icon>
                  </el-button>
                </el-upload>
              </div>
            </td>
            <td>
              <div class="option-actions">
                <el-button
                  type="primary"
                  text
                  size="small"
                  @click="emit('copy', idx)"
                >
                  复制
                </el-button>
                <el-button
                  type="danger"
                  text
                  size="small"
                  @click="emit('remove', idx)"
                >
                  删除
                </el-button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 添加一行 -->
    <div
      class="add-option-area"
      @click="emit('add')"
    >
      <el-icon><Plus /></el-icon>
      <span>添加一行数据</span>
    </div>

    <!-- 批量添加弹窗：上传海报自动识别二维码链接与券商名称 -->
    <PosterBatchAddDialog
      v-model="batchDialogVisible"
      @add-rows="rows => emit('batch-add', rows)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessageBox, type UploadFile } from 'element-plus'
import { Plus, PictureFilled } from '@element-plus/icons-vue'
import PosterBatchAddDialog from './PosterBatchAddDialog.vue'
import type { BatchOptionRow, ProductOptionItem } from '../composables/useProductEdit'

const props = defineProps<{
  options: ProductOptionItem[]
}>()

const emit = defineEmits<{
  add: []
  copy: [idx: number]
  remove: [idx: number]
  clear: []
  'batch-add': [rows: BatchOptionRow[]]
  'update-field': [idx: number, field: 'label' | 'limit' | 'redirectUrl', value: string]
  'qr-upload': [file: UploadFile, idx: number]
}>()

// 批量添加弹窗
const batchDialogVisible = ref(false)

// 清空所有选项
const confirmClear = () => {
  if (props.options.length === 0) return
  ElMessageBox.confirm('确定清空所有选项？', '提示', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
    .then(() => emit('clear'))
    .catch(() => {})
}

// 批量添加：打开海报上传识别弹窗（上传多张海报自动生成选项行）
const openBatchAdd = () => {
  batchDialogVisible.value = true
}
</script>

<style lang="scss" scoped>
// 单选框组配置
.option-group-config {
  width: 100%;

  .option-group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .option-table-wrapper {
    border: 1px solid #ebeef5;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 12px;
  }

  .option-table {
    width: 100%;
    border-collapse: collapse;

    th {
      background: #f5f7fa;
      padding: 8px 12px;
      font-size: 13px;
      font-weight: 500;
      color: #606266;
      text-align: left;
      border-bottom: 1px solid #ebeef5;
    }

    td {
      padding: 6px 12px;
      border-bottom: 1px solid #f0f2f5;

      .option-actions {
        display: flex;
        gap: 4px;
      }
    }

    tbody tr:last-child td {
      border-bottom: none;
    }
  }

  .add-option-area {
    border: 1px dashed #dcdfe6;
    border-radius: 4px;
    padding: 10px;
    text-align: center;
    color: #909399;
    cursor: pointer;
    transition: all 0.3s;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;

    &:hover {
      border-color: #409eff;
      color: #409eff;
    }
  }

  .redirect-input-wrap {
    display: flex;
    align-items: center;
    gap: 4px;

    .el-input {
      flex: 1;
    }
  }
}
</style>
