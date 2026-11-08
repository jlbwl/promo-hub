<template>
  <div class="commission-page">
    <!-- 顶部 hero（与产品大厅一致：大标题在这里，不再用导航栏重复） -->
    <div class="commission-mast">
      <div class="mast-inner">
        <div class="mast-row">
          <span class="mast-brand">COMMISSION</span>
          <span
            class="recycle-link"
            @click="openRecycleBin"
          >
            回收站
          </span>
        </div>
        <div class="title-row">
          <h1>我的佣金</h1>
        </div>
      </div>
    </div>

    <!-- 页面内容（下拉刷新：概览 + 订单列表） -->
    <van-pull-refresh
      v-model="refreshing"
      @refresh="refreshData"
    >
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
    </van-pull-refresh>

    <!-- 回收站弹窗 -->
    <RecycleBinSheet
      v-model:show="showRecycleBin"
      :orders="deletedOrders"
      @restore="handleRestore"
      @purge="handlePurge"
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
  refreshing,
  overview,
  records,
  showRecycleBin,
  deletedOrders,
  loadRecords,
  refreshData,
  onTabChange,
  openRecycleBin,
  handleRestore,
  handlePurge,
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
  background-color: var(--paper);
}

.commission-mast {
  position: relative;
  overflow: hidden;
  padding: 10px 14px 14px;
  background: var(--mast);
  color: var(--on-dark);

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      96deg,
      rgba(255, 235, 205, 0.045) 0 1px,
      transparent 1px 7px
    );
  }
}

.mast-inner {
  position: relative;
  z-index: 1;
}

.mast-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;

  .mast-brand {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.22em;
    color: #d8b07a;
  }

  .recycle-link {
    font-size: 12px;
    color: #e2c48e;
  }
}

.title-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: 8px;

  h1 {
    margin: 0;
    font-size: var(--fs-display);
    font-weight: 650;
    letter-spacing: 0.01em;
    color: var(--on-dark);
  }
}

.commission-page :deep(.van-tabs__wrap) {
  border-bottom: 1px solid var(--line-soft);
}

.commission-page :deep(.van-tabs__nav) {
  padding: 0 6px;
}

.commission-page :deep(.van-tab) {
  font-size: 12px;
  font-weight: 500;
}

.commission-page :deep(.van-tab--active) {
  font-weight: 650;
}
</style>
