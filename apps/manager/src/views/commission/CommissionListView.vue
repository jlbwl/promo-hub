<template>
  <div class="commission-list-page">
    <!-- 统计卡片 -->
    <StatCards
      :stats="stats"
      @select="openStatDetail"
      @payment="openPaymentDialog"
    />

    <!-- 筛选栏 -->
    <FilterBar
      v-model:keyword="filterKeyword"
      v-model:status="filterStatus"
      @change="fetchData"
      @reset="handleReset"
    />

    <!-- 数据表格与分页 -->
    <OrderTable
      v-model:page="pagination.page"
      v-model:page-size="pagination.pageSize"
      :loading="loading"
      :data="tableData"
      :total="pagination.total"
      @page-change="fetchData"
      @approve="handleApprove"
      @reject="handleReject"
      @add-to-payment="handleAddToPayment"
    />

    <!-- 弹窗组 -->
    <PaymentDialog
      ref="paymentDialogRef"
      @success="refreshAll"
    />
    <StatDetailDialog ref="statDetailDialogRef" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import StatCards from './components/StatCards.vue'
import FilterBar from './components/FilterBar.vue'
import OrderTable from './components/OrderTable.vue'
import PaymentDialog from './components/PaymentDialog.vue'
import StatDetailDialog from './components/StatDetailDialog.vue'
import { useCommissionList } from './composables/useCommissionList'

const {
  loading,
  filterStatus,
  filterKeyword,
  pagination,
  stats,
  tableData,
  fetchStats,
  fetchData,
  handleReset,
  handleApprove,
  handleReject,
  handleAddToPayment,
} = useCommissionList()

const paymentDialogRef = ref<{ open: () => void } | null>(null)
const statDetailDialogRef = ref<{ open: (status: string, title: string) => void } | null>(null)

// 打开统计明细弹窗
const openStatDetail = (status: string, title: string) => statDetailDialogRef.value?.open(status, title)

// 打开待发放结算弹窗
const openPaymentDialog = () => {
  if (stats.pendingPayment === 0) {
    ElMessage.info('暂无待付款订单')
    return
  }
  paymentDialogRef.value?.open()
}

// 订单变更（审核/发放）后统一刷新列表与统计
const refreshAll = () => {
  fetchStats()
  fetchData()
}
</script>
