<template>
  <div class="commission-page">
    <!-- 顶部导航栏 -->
    <van-nav-bar
      title="我的佣金"
      fixed
      placeholder
      right-text="回收站"
      @click-right="openRecycleBin"
    />

    <!-- 佣金概览卡片 -->
    <OverviewCard :overview="overview" />

    <!-- Tab 切换 -->
    <van-tabs
      v-model:active="activeTab"
      sticky
      @change="onTabChange"
    >
      <van-tab
        title="全部"
        name="all"
      />
      <van-tab
        title="待审核"
        name="pending"
      />
      <van-tab
        title="已通过"
        name="approved"
      />
      <van-tab
        title="待发放"
        name="pending_payment"
      />
      <van-tab
        title="已发放"
        name="settled"
      />
      <van-tab
        title="已驳回"
        name="rejected"
      />
    </van-tabs>

    <!-- 订单记录列表 -->
    <RecordList
      v-model:loading="loading"
      :finished="finished"
      :records="records"
      @load="loadRecords"
      @deleted="handleDeleted"
      @fund-submitted="handleFundSubmitted"
    />

    <!-- 回收站弹窗 -->
    <RecycleBinSheet
      v-model:show="showRecycleBin"
      :orders="deletedOrders"
      @restore="handleRestore"
    />
  </div>
</template>

<script setup lang="ts">
import OverviewCard from './commission/components/OverviewCard.vue'
import RecordList from './commission/components/RecordList.vue'
import RecycleBinSheet from './commission/components/RecycleBinSheet.vue'
import { useCommission } from './commission/composables/useCommission'
import type { Order } from '@promo/shared/types'

const {
  activeTab,
  loading,
  finished,
  overview,
  records,
  showRecycleBin,
  deletedOrders,
  loadRecords,
  onTabChange,
  openRecycleBin,
  handleRestore,
} = useCommission()

// 删除成功后：从列表中移除记录并更新统计
const handleDeleted = (record: Order) => {
  const index = records.value.findIndex(r => r.id === record.id)
  if (index > -1) {
    records.value.splice(index, 1)
  }
  // 更新统计
  overview.total--
  const statusKey = record.status === 'pending_payment' ? 'pendingPayment' : record.status
  if (overview[statusKey as keyof typeof overview]) {
    (overview[statusKey as keyof typeof overview] as number)--
  }
}

// 提交资金号成功后：更新订单记录中的资金号
const handleFundSubmitted = (record: Order, fundAccount: string) => {
  record.fundAccount = fundAccount
}
</script>

<style scoped lang="scss">
.commission-page {
  min-height: 100%;
  background-color: #f7f8fa;
}
</style>
