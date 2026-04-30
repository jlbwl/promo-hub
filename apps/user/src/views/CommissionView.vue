<template>
  <div class="commission-page">
    <!-- 顶部导航栏 -->
    <van-nav-bar
      title="我的佣金"
      fixed
      placeholder
    />

    <!-- 佣金概览卡片 -->
    <div class="commission-overview">
      <div class="overview-card">
        <div class="total-commission">
          <span class="label">总佣金（元）</span>
          <span class="amount">{{ overview.totalCommission }}</span>
        </div>
        <div class="commission-details">
          <div class="detail-item">
            <span class="value">{{ overview.pending }}</span>
            <span class="label">待审核</span>
          </div>
          <div class="detail-item">
            <span class="value">{{ overview.received }}</span>
            <span class="label">已到账</span>
          </div>
          <div class="detail-item">
            <span class="value">{{ overview.withdrawn }}</span>
            <span class="label">已提现</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 切换 -->
    <van-tabs v-model:active="activeTab" sticky>
      <van-tab title="全部" name="all" />
      <van-tab title="待审核" name="pending" />
      <van-tab title="已到账" name="received" />
      <van-tab title="已提现" name="withdrawn" />
    </van-tabs>

    <!-- 佣金记录列表 -->
    <van-list
      v-model:loading="loading"
      :finished="finished"
      finished-text="没有更多了"
      @load="loadRecords"
    >
      <div class="record-list">
        <div
          v-for="record in filteredRecords"
          :key="record.id"
          class="record-card"
        >
          <div class="record-left">
            <h4 class="record-title">{{ record.productName }}</h4>
            <span class="record-time">{{ record.time }}</span>
          </div>
          <div class="record-right">
            <span class="record-amount" :class="record.amountClass">
              {{ record.amountPrefix }}¥{{ record.amount }}
            </span>
            <van-tag
              :type="record.statusType"
              size="medium"
              round
            >
              {{ record.statusText }}
            </van-tag>
            <!-- 可领取的佣金显示领取按钮 -->
            <van-button
              v-if="record.showClaimBtn"
              type="primary"
              size="mini"
              round
              class="claim-btn"
              @click="handleClaim(record)"
            >
              领取
            </van-button>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <van-empty
        v-if="!loading && filteredRecords.length === 0"
        description="暂无佣金记录"
      />
    </van-list>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { showToast } from 'vant'

// 当前激活的 Tab
const activeTab = ref('all')

// 加载状态
const loading = ref(false)
const finished = ref(false)

// 佣金概览数据
const overview = reactive({
  totalCommission: '1,280.50',
  pending: '320.00',
  received: '680.50',
  withdrawn: '280.00'
})

// 佣金记录数据
const records = ref<any[]>([])

// 模拟佣金记录
const mockRecords = [
  {
    id: 1,
    productName: '无线蓝牙耳机 降噪运动防水',
    amount: '30.00',
    amountPrefix: '+',
    amountClass: 'income',
    status: 'received',
    statusType: 'success',
    statusText: '已到账',
    time: '2025-04-28 14:30',
    showClaimBtn: false
  },
  {
    id: 2,
    productName: '保湿面膜套装 补水修护',
    amount: '15.00',
    amountPrefix: '+',
    amountClass: 'income',
    status: 'pending',
    statusType: 'warning',
    statusText: '待审核',
    time: '2025-04-27 09:15',
    showClaimBtn: false
  },
  {
    id: 3,
    productName: '智能手表 多功能运动健康监测',
    amount: '60.00',
    amountPrefix: '+',
    amountClass: 'income',
    status: 'received',
    statusType: 'success',
    statusText: '已到账',
    time: '2025-04-26 16:45',
    showClaimBtn: false
  },
  {
    id: 4,
    productName: '有机坚果礼盒 每日坚果混合装',
    amount: '10.00',
    amountPrefix: '+',
    amountClass: 'income',
    status: 'claimable',
    statusType: 'primary',
    statusText: '可领取',
    time: '2025-04-25 11:20',
    showClaimBtn: true
  },
  {
    id: 5,
    productName: '便携式充电宝 20000mAh大容量',
    amount: '20.00',
    amountPrefix: '+',
    amountClass: 'income',
    status: 'withdrawn',
    statusType: 'default',
    statusText: '已提现',
    time: '2025-04-24 08:50',
    showClaimBtn: false
  },
  {
    id: 6,
    productName: '真丝睡衣套装 丝绸家居服',
    amount: '40.00',
    amountPrefix: '+',
    amountClass: 'income',
    status: 'received',
    statusType: 'success',
    statusText: '已到账',
    time: '2025-04-23 15:30',
    showClaimBtn: false
  },
  {
    id: 7,
    productName: '空气炸锅 家用多功能',
    amount: '45.00',
    amountPrefix: '+',
    amountClass: 'income',
    status: 'pending',
    statusType: 'warning',
    statusText: '待审核',
    time: '2025-04-22 10:10',
    showClaimBtn: false
  }
]

// 根据 Tab 过滤记录
const filteredRecords = computed(() => {
  if (activeTab.value === 'all') return records.value
  return records.value.filter((record) => record.status === activeTab.value)
})

// 加载佣金记录
const loadRecords = async () => {
  try {
    // TODO: 替换为实际 API 调用
    await new Promise((resolve) => setTimeout(resolve, 800))

    if (records.value.length >= mockRecords.length) {
      finished.value = true
    } else {
      records.value.push(...mockRecords)
    }
  } finally {
    loading.value = false
  }
}

// 领取佣金
const handleClaim = (record: any) => {
  showToast(`成功领取 ¥${record.amount} 佣金`)
  record.status = 'received'
  record.statusType = 'success'
  record.statusText = '已到账'
  record.showClaimBtn = false
  // TODO: 调用领取接口
}
</script>

<style scoped lang="scss">
.commission-page {
  min-height: 100%;
  background-color: #f7f8fa;
}

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

// 记录列表
.record-list {
  padding: 0 12px;
}

.record-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #ffffff;
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 8px;
}

.record-left {
  flex: 1;
  min-width: 0;
}

.record-title {
  font-size: 14px;
  font-weight: 500;
  color: #323233;
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.record-time {
  font-size: 12px;
  color: #969799;
}

.record-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
  margin-left: 12px;
}

.record-amount {
  font-size: 16px;
  font-weight: 600;

  &.income {
    color: #ee0a24;
  }

  &.expense {
    color: #323233;
  }
}

.claim-btn {
  min-width: 56px;
}
</style>
