<template>
  <div class="category-manage">
    <!-- 工具栏 -->
    <CategoryToolbar
      @add="openAddDialog"
      @export-products="handleExport"
      @show-qr="openQrCodeDialog"
      @refresh="loadData"
    />

    <!-- 分类表格 -->
    <CategoryTable
      :loading="loading"
      :data="tableData"
      @edit="openEditDialog"
      @toggle-status="handleToggleStatus"
    />

    <!-- 弹窗组 -->
    <CategoryEditDialog
      ref="editDialogRef"
      @success="loadData"
    />
    <QrCodeDialog ref="qrCodeDialogRef" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CategoryToolbar from './components/CategoryToolbar.vue'
import CategoryTable from './components/CategoryTable.vue'
import CategoryEditDialog from './components/CategoryEditDialog.vue'
import QrCodeDialog from './components/QrCodeDialog.vue'
import { useCategoryAdmin } from './composables/useCategoryAdmin'
import type { ProductCategory } from '@promo/shared/types'

const {
  loading,
  tableData,
  loadData,
  handleToggleStatus,
  exportProducts,
} = useCategoryAdmin()

const editDialogRef = ref<{ open: (row?: ProductCategory) => void } | null>(null)
const qrCodeDialogRef = ref<{ open: () => void; dataUrl: string } | null>(null)

// 打开添加分类弹窗
const openAddDialog = () => editDialogRef.value?.open()
// 打开编辑分类弹窗
const openEditDialog = (row: ProductCategory) => editDialogRef.value?.open(row)
// 打开网址转二维码弹窗
const openQrCodeDialog = () => qrCodeDialogRef.value?.open()
// 一键派单导出（弹窗内当前生成的二维码作为默认二维码获取失败时的回退）
const handleExport = () => exportProducts(qrCodeDialogRef.value?.dataUrl || '')
</script>

<style lang="scss" scoped>
// 表格样式同时作用于分类表格与二维码弹窗内的表格
.category-manage {
  :deep(.el-table) {
    min-width: 768px;
  }
}

@media (max-width: 768px) {
  .category-manage {
    :deep(.el-table) {
      font-size: 12px;
    }

    :deep(.el-table th) {
      font-size: 12px;
      padding: 8px 4px;
    }

    :deep(.el-table td) {
      padding: 8px 4px;
    }

    :deep(.el-dialog) {
      width: 95% !important;
    }

    :deep(.el-form-item__label) {
      width: 90px !important;
      font-size: 13px;
    }

    :deep(.el-form-item__content) {
      margin-left: 90px !important;
    }
  }
}
</style>
