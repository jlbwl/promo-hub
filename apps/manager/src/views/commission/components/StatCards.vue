<template>
  <!-- 统计卡片 -->
  <el-row
    :gutter="20"
    class="stat-cards"
    justify="center"
  >
    <el-col
      v-for="card in cards"
      :key="card.status"
      :xs="24"
      :sm="12"
      :md="4"
    >
      <el-card
        shadow="hover"
        class="stat-card clickable"
        :class="{ 'has-items': card.isPayment && stats.pendingPayment > 0 }"
        @click="handleCardClick(card)"
      >
        <div class="stat-content">
          <div class="stat-info">
            <span class="stat-label">{{ card.label }}</span>
            <el-statistic :value="getCardValue(card)" />
          </div>
          <el-icon
            class="stat-icon"
            :style="card.iconStyle"
          >
            <component :is="card.icon" />
          </el-icon>
        </div>
        <div
          v-if="getCardValue(card) > 0"
          class="card-badge"
          :style="card.badgeStyle"
        >
          {{ card.badgeText }}
        </div>
      </el-card>
    </el-col>
  </el-row>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { Document, Clock, CircleCheck, Wallet, SuccessFilled } from '@element-plus/icons-vue'

// 统计数据
interface CommissionStats {
  total: number
  pending: number
  approved: number
  pendingPayment: number
  settled: number
  rejected: number
}

// 统计卡片配置（isPayment 的卡片点击打开待发放结算弹窗，其余打开明细弹窗）
interface StatCardItem {
  status: string
  label: string
  title: string
  statKey: keyof CommissionStats
  /** 需要合并到本卡片计数的其他状态（如已发放卡片并入已驳回笔数） */
  extraStatKeys?: (keyof CommissionStats)[]
  icon: Component
  iconStyle: string
  badgeText: string
  badgeStyle: string
  isPayment?: boolean
}

const props = defineProps<{
  stats: CommissionStats
}>()

const emit = defineEmits<{
  select: [status: string, title: string]
  payment: []
}>()

const cards: StatCardItem[] = [
  { status: 'all', label: '总订单', title: '总订单', statKey: 'total', icon: Document, iconStyle: 'color: #409eff; background: #ecf5ff;', badgeText: '查看', badgeStyle: '' },
  { status: 'pending', label: '待审核', title: '待审核', statKey: 'pending', icon: Clock, iconStyle: 'color: #e6a23c; background: #fdf6ec;', badgeText: '查看', badgeStyle: 'background: linear-gradient(135deg, #e6a23c, #f5c77e);' },
  { status: 'approved', label: '已通过', title: '已通过', statKey: 'approved', icon: CircleCheck, iconStyle: 'color: #67c23a; background: #f0f9eb;', badgeText: '查看', badgeStyle: 'background: linear-gradient(135deg, #67c23a, #95d475);' },
  { status: 'pending_payment', label: '待发放', title: '待付款', statKey: 'pendingPayment', icon: Wallet, iconStyle: 'color: #409eff; background: #ecf5ff;', badgeText: '去结算', badgeStyle: '', isPayment: true },
  // 已发放并入已驳回笔数：驳回单不产生推广费，明细中按 0 展示
  { status: 'settled,rejected', label: '已发放', title: '已发放', statKey: 'settled', extraStatKeys: ['rejected'], icon: SuccessFilled, iconStyle: 'color: #67c23a; background: #f0f9eb;', badgeText: '查看', badgeStyle: 'background: linear-gradient(135deg, #67c23a, #95d475);' },
]

// 卡片数值：基础状态 + 合并状态的笔数之和
const getCardValue = (card: StatCardItem) => {
  const keys = [card.statKey, ...(card.extraStatKeys || [])]
  return keys.reduce((sum, key) => sum + (Number(props.stats[key]) || 0), 0)
}

// 点击卡片
const handleCardClick = (card: StatCardItem) => {
  if (card.isPayment) {
    emit('payment')
  } else {
    emit('select', card.status, card.title)
  }
}
</script>

<style lang="scss" scoped>
.stat-cards {
  margin-bottom: 20px;
}

.stat-card {
  margin-bottom: 16px;
  position: relative;
  cursor: default;

  .stat-content {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .stat-info {
      .stat-label {
        display: block;
        font-size: 14px;
        color: #909399;
        margin-bottom: 8px;
      }
    }

    .stat-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
    }
  }

  // 可点击的待付款卡片
  &.clickable {
    cursor: pointer;
    transition: all 0.3s;
    border: 2px solid transparent;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(64, 158, 255, 0.3);
    }

    &.has-items {
      border-color: #409eff;
    }
  }

  .card-badge {
    position: absolute;
    top: 12px;
    right: 12px;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    color: #ffffff;
    background: linear-gradient(135deg, #409eff, #66b1ff);
  }
}
</style>
