<template>
  <div
    ref="pageRef"
    class="commission-list-page"
  >
    <!-- 移动端下拉刷新指示器（桌面端不触发） -->
    <PullRefreshHint
      :offset="pullOffset"
      :text="pullHint"
      :dragging="pullPulling"
      :refreshing="pullRefreshing"
    />

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
      v-model:review-date-range="filterReviewDateRange"
      v-model:only-duplicate="filterOnlyDuplicate"
      @change="handleFilterChange"
      @reset="handleReset"
    />

    <!-- 数据表格与分页 -->
    <OrderTable
      v-model:page="pagination.page"
      v-model:page-size="pagination.pageSize"
      :loading="loading"
      :data="tableData"
      :total="pagination.total"
      :only-duplicate="filterOnlyDuplicate"
      :load-error="loadError"
      @page-change="fetchData"
      @load-more="loadMore"
      @retry="fetchData"
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
import PullRefreshHint from '@/components/PullRefreshHint.vue'
import { usePullToRefresh } from '@/composables/usePullToRefresh'
import { useCommissionList } from './composables/useCommissionList'

const {
  loading,
  filterStatus,
  filterKeyword,
  filterReviewDateRange,
  filterOnlyDuplicate,
  pagination,
  stats,
  tableData,
  loadError,
  fetchStats,
  fetchData,
  loadMore,
  handleFilterChange,
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

// 下拉刷新：回到第一页重新拉取统计与列表；失败时恢复页码避免加载更多重复
const handleRefresh = async () => {
  const previousPage = pagination.page
  pagination.page = 1
  const [success] = await Promise.all([fetchData(), fetchStats()])
  if (!success) pagination.page = previousPage
}

const pageRef = ref<HTMLElement | null>(null)
const {
  offset: pullOffset,
  pulling: pullPulling,
  refreshing: pullRefreshing,
  hintText: pullHint,
} = usePullToRefresh(handleRefresh, pageRef)
</script>
