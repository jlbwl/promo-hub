<template>
  <!-- 佣金概览卡片 -->
  <div class="commission-overview">
    <div class="overview-card">
      <div class="total-commission">
        <span class="label">累计佣金 · 已发放</span>
        <span class="amount"><i class="cur">¥</i>{{ displayAmount }}</span>
      </div>
      <div class="commission-details">
        <div class="detail-item">
          <span class="value">{{ overview.pending }}</span>
          <span class="label">待审核</span>
        </div>
        <div class="detail-item">
          <span class="value">{{ overview.approved }}</span>
          <span class="label">已通过</span>
        </div>
        <div class="detail-item">
          <span class="value">{{ overview.pendingPayment }}</span>
          <span class="label">待发放</span>
        </div>
        <div class="detail-item">
          <span class="value">{{ overview.settled }}</span>
          <span class="label">已发放</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  overview: {
    total: number
    pending: number
    approved: number
    pendingPayment: number
    settled: number
    settledAmount: number
    rejected: number
  }
}>()

const displayAmount = computed(() => (Number(props.overview.settledAmount) || 0).toFixed(2))
</script>

<style scoped lang="scss">
// 佣金概览
.commission-overview {
  padding: 12px 14px 4px;
}

.overview-card {
  position: relative;
  overflow: hidden;
  padding: 18px 16px 16px;
  border-radius: 14px;
  color: var(--on-dark);
  background: var(--mast);
  border: 1px solid rgba(216, 176, 122, 0.18);

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

.total-commission,
.commission-details {
  position: relative;
  z-index: 1;
}

.total-commission {
  text-align: center;
  margin-bottom: 16px;

  .label {
    display: block;
    font-size: 10px;
    letter-spacing: 0.14em;
    color: var(--on-dark-muted);
    margin-bottom: 6px;
  }

  .amount {
    display: block;
    font-size: 34px;
    font-weight: 750;
    line-height: 1;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    color: #e9c58c;

    .cur {
      margin-right: 3px;
      font-size: 15px;
      font-style: normal;
      font-weight: 600;
      color: inherit;
    }
  }
}

.commission-details {
  display: flex;
  justify-content: space-around;
  padding-top: 14px;
  border-top: 1px solid rgba(216, 176, 122, 0.22);

  .detail-item {
    text-align: center;

    .value {
      display: block;
      font-size: 17px;
      font-weight: 650;
      margin-bottom: 3px;
      font-variant-numeric: tabular-nums;
      color: var(--on-dark);
    }

    .label {
      font-size: 10px;
      color: var(--on-dark-muted);
    }
  }
}
</style>
