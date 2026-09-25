<template>
  <!-- 佣金概览卡片 -->
  <div class="commission-overview">
    <div class="overview-card">
      <div class="total-commission">
        <span class="label">做单记录</span>
        <span class="amount">{{ overview.total }}</span>
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
defineProps<{
  overview: {
    total: number
    pending: number
    approved: number
    pendingPayment: number
    settled: number
    rejected: number
  }
}>()
</script>

<style scoped lang="scss">
// 佣金概览
.commission-overview {
  padding: 12px 16px;
}

.overview-card {
  background: linear-gradient(135deg, #1989fa 0%, #4fc3f7 100%);
  border-radius: 12px;
  padding: 24px 20px;
  color: #ffffff;
}

.total-commission {
  text-align: center;
  margin-bottom: 20px;

  .label {
    display: block;
    font-size: 13px;
    opacity: 0.8;
    margin-bottom: 8px;
  }

  .amount {
    display: block;
    font-size: 36px;
    font-weight: 700;
  }
}

.commission-details {
  display: flex;
  justify-content: space-around;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);

  .detail-item {
    text-align: center;

    .value {
      display: block;
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .label {
      font-size: 12px;
      opacity: 0.8;
    }
  }
}
</style>
