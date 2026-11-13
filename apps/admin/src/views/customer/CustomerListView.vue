<template>
  <div class="customer-manage">
    <CustomerToolbar
      v-model:keyword="searchKeyword"
      v-model:pay-method="searchPayMethod"
      v-model:status="searchStatus"
      @search="handleSearch"
      @reset="handleReset"
      @add="openAddDialog"
      @import="openImportDialog"
      @qrcode="openQrcodeDialog"
      @export="exportCustomers"
      @template="downloadTemplate"
    />

    <CustomerTable
      :data="tableData"
      :loading="loading"
      :pagination="pagination"
      @edit="openEditDialog"
      @delete="handleDelete"
      @page-change="handlePageChange"
      @size-change="handleSizeChange"
    />

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
import { ref } from 'vue'
import CustomerToolbar from './components/CustomerToolbar.vue'
import CustomerTable from './components/CustomerTable.vue'
import CustomerFormDialog from './components/CustomerFormDialog.vue'
import CustomerImportDialog from './components/CustomerImportDialog.vue'
import CustomerQrcodeUploadDialog from './components/CustomerQrcodeUploadDialog.vue'
import { useCustomerAdmin } from './composables/useCustomerAdmin'
import type { CustomerItem } from './utils'

const {
  searchKeyword,
  searchPayMethod,
  searchStatus,
  loading,
  pagination,
  tableData,
  loadData,
  handleSearch,
  handleReset,
  saveCustomer,
  handleDelete,
  exportCustomers,
  downloadTemplate,
} = useCustomerAdmin()

const formDialogRef = ref<{ open: (row?: CustomerItem) => void } | null>(null)
const importDialogRef = ref<{ open: () => void } | null>(null)
const qrcodeDialogRef = ref<{ open: () => void } | null>(null)

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
@media (max-width: 768px) {
  .customer-manage {
    :deep(.el-dialog) {
      width: 95% !important;
    }
  }
}
</style>
