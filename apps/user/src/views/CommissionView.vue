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
            <span class="label">待付款</span>
          </div>
          <div class="detail-item">
            <span class="value">{{ overview.settled }}</span>
            <span class="label">已结算</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 切换 -->
    <van-tabs v-model:active="activeTab" sticky @change="onTabChange">
      <van-tab title="全部" name="all" />
      <van-tab title="待审核" name="pending" />
      <van-tab title="已通过" name="approved" />
      <van-tab title="待付款" name="pending_payment" />
      <van-tab title="已结算" name="settled" />
      <van-tab title="已驳回" name="rejected" />
    </van-tabs>

    <!-- 订单记录列表 -->
    <van-list
      v-model:loading="loading"
      :finished="finished"
      finished-text="没有更多了"
      @load="loadRecords"
    >
      <div class="record-list">
        <div
          v-for="record in records"
          :key="record.id"
          class="record-card"
        >
          <div class="record-left">
            <h4 class="record-title">{{ record.productName }} <van-tag v-if="record.optionLabel" type="primary" plain size="medium" style="vertical-align: middle; margin-left: 4px;">{{ record.optionLabel }}</van-tag></h4>
            <span class="record-time">{{ formatTime(record.createdAt) }}</span>
            <span v-if="record.rejectReason" class="reject-reason">驳回原因：{{ record.rejectReason }}</span>
          </div>
          <div class="record-right">
            <span class="record-price">¥{{ record.productPrice }}</span>
            <van-tag
              :type="(statusType(record.status) as any)"
              size="medium"
              round
            >
              {{ statusLabel(record.status) }}
            </van-tag>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <van-empty
        v-if="!loading && records.length === 0"
        description="暂无做单记录"
      />
    </van-list>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { get } from '@promo/shared/utils/request'

// 当前激活的 Tab
const activeTab = ref('all')

// 加载状态
const loading = ref(false)
const finished = ref(false)

// 分页
const page = ref(1)
const pageSize = 20

// 佣金概览数据
const overview = reactive({
  total: 0,
  pending: 0,
  approved: 0,
  pendingPayment: 0,
  settled: 0,
  rejected: 0
})

// 订单记录
const records = ref<any[]>([])

// 获取当前用户 ID
const getUserId = () => {
  try {
    const info = JSON.parse(localStorage.getItem('user_info') || '{}')
    return info.id || ''
  } catch { return '' }
}

// 状态映射
const statusType = (status: string) => {
  const map: Record<string, string> = {
    pending: 'warning',
    approved: 'success',
    pending_payment: 'primary',
    settled: 'success',
    rejected: 'danger',
  }
  return map[status] || 'default'
}

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending: '待审核',
    approved: '已通过',
    pending_payment: '待付款',
    settled: '已结算',
    rejected: '已驳回',
  }
  return map[status] || status
}

// 格式化时间
const formatTime = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 加载统计数据
const loadStats = async () => {
  try {
    const res = await get<any>('/orders/stats', { userId: getUserId() || undefined })
    if (res.data) {
      overview.total = res.data.total || 0
      overview.pending = res.data.pending || 0
      overview.approved = res.data.approved || 0
      overview.pendingPayment = res.data.pendingPayment || 0
      overview.settled = res.data.settled || 0
      overview.rejected = res.data.rejected || 0
    }
  } catch (error) {
    console.error('获取统计失败:', error)
  }
}

// 加载订单记录
const loadRecords = async () => {
  try {
    const params: any = {
      page: page.value,
      pageSize,
      userId: getUserId() || undefined,
    }
    if (activeTab.value !== 'all') {
      params.status = activeTab.value
    }

    const res = await get<any>('/orders', params)
    if (res.data) {
      const { list, total } = res.data
      if (page.value === 1) {
        records.value = list || []
      } else {
        records.value.push(...(list || []))
      }
      if (records.value.length >= total) {
        finished.value = true
      }
      page.value++
    }
  } catch (error) {
    console.error('获取订单失败:', error)
    finished.value = true
  } finally {
    loading.value = false
  }
}

// Tab 切换
const onTabChange = () => {
  page.value = 1
  records.value = []
  finished.value = false
  loadRecords()
}

// 初始化加载
loadStats()
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
  display: block;
  margin-bottom: 2px;
}

.reject-reason {
  font-size: 12px;
  color: #ee0a24;
  display: block;
  margin-top: 4px;
}

.record-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
  margin-left: 12px;
}

.record-price {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}
</style>
