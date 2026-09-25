<template>
  <div class="commission-admin">
    <!-- 统计卡片 -->
    <StatCards
      :stats="stats"
      @select="openStatDetail"
    />

    <!-- 筛选栏 -->
    <FilterBar
      v-model:keyword="filterKeyword"
      v-model:status="filterStatus"
      v-model:manager="filterManager"
      v-model:user="filterUser"
      :managers="managers"
      :user-options="userOptions"
      @change="fetchData"
      @reset="handleReset"
    />

    <!-- 数据表格与分页 -->
    <OrderTable
      v-model:page="pagination.page"
      v-model:page-size="pagination.pageSize"
      :loading="loading"
      :data="tableData"
      :managers="managers"
      :total="pagination.total"
      @page-change="fetchData"
      @edit-team="openEditTeamName"
      @delete="openDelete"
    />

    <!-- 弹窗组 -->
    <EditTeamNameDialog
      ref="editTeamNameDialogRef"
      @success="refreshAll"
    />
    <DeleteOrderDialog
      ref="deleteDialogRef"
      @success="refreshAll"
    />
    <StatDetailDialog
      ref="statDetailDialogRef"
      :managers="managers"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import StatCards from './components/StatCards.vue'
import FilterBar from './components/FilterBar.vue'
import OrderTable from './components/OrderTable.vue'
import EditTeamNameDialog from './components/EditTeamNameDialog.vue'
import DeleteOrderDialog from './components/DeleteOrderDialog.vue'
import StatDetailDialog from './components/StatDetailDialog.vue'
import { useCommissionAdmin } from './composables/useCommissionAdmin'
import type { Order } from '@promo/shared/types'

const {
  loading,
  filterStatus,
  filterManager,
  filterUser,
  filterKeyword,
  pagination,
  tableData,
  managers,
  userOptions,
  stats,
  fetchData,
  handleReset,
  refreshAll,
} = useCommissionAdmin()

const editTeamNameDialogRef = ref<{ open: (row: Order) => void } | null>(null)
const deleteDialogRef = ref<{ open: (row: Order) => void } | null>(null)
const statDetailDialogRef = ref<{ open: (status: string, title: string) => void } | null>(null)

// 打开统计明细弹窗
const openStatDetail = (status: string, title: string) => statDetailDialogRef.value?.open(status, title)
// 打开编辑团队名称弹窗
const openEditTeamName = (row: Order) => editTeamNameDialogRef.value?.open(row)
// 打开删除确认弹窗
const openDelete = (row: Order) => deleteDialogRef.value?.open(row)
</script>

<style lang="scss" scoped>
.commission-admin {
  // 表格最小宽度：作用于订单表格与统计明细弹窗表格
  :deep(.el-table) {
    min-width: 900px;
  }
}

@media (max-width: 768px) {
  .commission-admin {
    :deep(.el-table) {
      font-size: 11px;
    }

    :deep(.el-table th) {
      font-size: 11px;
      padding: 6px 4px;
    }

    :deep(.el-table td) {
      padding: 6px 4px;
    }

    :deep(.el-dialog) {
      width: 95% !important;
    }
  }
}
</style>
