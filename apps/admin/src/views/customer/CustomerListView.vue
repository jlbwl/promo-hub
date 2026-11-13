<template>
  <div class="customer-manage">
    <CustomerToolbar
      v-model:keyword="searchKeyword"
      v-model:pay-method="searchPayMethod"
      v-model:status="searchStatus"
      v-model:view-mode="viewModeModel"
      @search="handleSearch"
      @reset="handleReset"
      @add="openAddDialog"
      @import="openImportDialog"
      @qrcode="openQrcodeDialog"
      @export="exportCustomers"
      @template="downloadTemplate"
    />

    <CustomerTable
      v-if="viewMode === 'table'"
      :data="tableData"
      :loading="loading"
      @edit="openEditDialog"
      @delete="handleDelete"
      @sort-change="handleSortChange"
    />

    <CustomerCardGrid
      v-else
      :data="tableData"
      :loading="loading"
      @edit="openEditDialog"
      @delete="handleDelete"
      @replace-qrcode="replaceQrcode"
    />

    <div class="customer-pagination">
      <el-pagination
        :current-page="pagination.page"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>

    <CustomerFormDialog
      ref="formDialogRef"
      :save="saveCustomer"
      @success="loadData"
    />

    <CustomerImportDialog
      ref="importDialogRef"
      @success="loadData"
      @template="downloadTemplate"
    />

    <CustomerQrcodeUploadDialog
      ref="qrcodeDialogRef"
      @success="loadData"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import CustomerToolbar from './components/CustomerToolbar.vue'
import CustomerTable from './components/CustomerTable.vue'
import CustomerCardGrid from './components/CustomerCardGrid.vue'
import CustomerFormDialog from './components/CustomerFormDialog.vue'
import CustomerImportDialog from './components/CustomerImportDialog.vue'
import CustomerQrcodeUploadDialog from './components/CustomerQrcodeUploadDialog.vue'
import { useCustomerAdmin } from './composables/useCustomerAdmin'
import type { CustomerItem, CustomerViewMode } from './utils'

const {
  searchKeyword,
  searchPayMethod,
  searchStatus,
  loading,
  pagination,
  tableData,
  viewMode,
  setViewMode,
  loadData,
  handleSearch,
  handleReset,
  handleSortChange,
  replaceQrcode,
  saveCustomer,
  handleDelete,
  exportCustomers,
  downloadTemplate,
} = useCustomerAdmin()

const formDialogRef = ref<{ open: (row?: CustomerItem) => void } | null>(null)
const importDialogRef = ref<{ open: () => void } | null>(null)
const qrcodeDialogRef = ref<{ open: () => void } | null>(null)

// 切换视图时同步写入 localStorage，下次进入沿用
const viewModeModel = computed<CustomerViewMode>({
  get: () => viewMode.value,
  set: (mode) => setViewMode(mode),
})

const openAddDialog = () => formDialogRef.value?.open()
const openEditDialog = (row: CustomerItem) => formDialogRef.value?.open(row)
const openImportDialog = () => importDialogRef.value?.open()
const openQrcodeDialog = () => qrcodeDialogRef.value?.open()

const handlePageChange = (page: number) => {
  pagination.page = page
  loadData()
}

const handleSizeChange = (pageSize: number) => {
  pagination.pageSize = pageSize
  pagination.page = 1
  loadData()
}
</script>

<style lang="scss" scoped>
.customer-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

@media (max-width: 768px) {
  .customer-manage {
    :deep(.el-dialog) {
      width: 95% !important;
    }
  }

  .customer-pagination {
    justify-content: center;
  }
}
</style>
