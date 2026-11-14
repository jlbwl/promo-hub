<template>
  <!-- 统计卡片：5 张等分铺满整行 -->
  <div class="stat-cards">
    <el-card
      v-for="card in cards"
      :key="card.status"
      shadow="hover"
      class="stat-card clickable"
      :class="{ 'has-items': card.isPayment && stats.pendingPayment > 0, 'is-payment': card.isPayment }"
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
  </div>
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
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  position: relative;
  cursor: default;
  min-width: 0;

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

// 触屏设备无 hover，用按压缩放反馈替代抬升
@media (hover: hover) {
  .stat-card.clickable:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(64, 158, 255, 0.3);
  }
}

.stat-card.clickable:active {
  background-color: #f5f9ff;
}

// 窄屏换行：平板两列
@media (max-width: 991px) {
  .stat-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

// 手机：两列紧凑，待发放卡片跨两列作为强调操作入口
@media (max-width: 767px) {
  .stat-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 12px;
  }

  .stat-card {
    :deep(.el-card__body) {
      padding: 12px;
    }

    .stat-content {
      .stat-info {
        min-width: 0;

        .stat-label {
          margin-bottom: 4px;
          font-size: 12px;
        }
      }

      :deep(.el-statistic__content) {
        font-size: 20px;
      }

      .stat-icon {
        flex: none;
        width: 36px;
        height: 36px;
        border-radius: 10px;
        font-size: 19px;
      }
    }

    // 普通卡片在手机上去掉角标，避免与数字挤在一起
    &:not(.is-payment) .card-badge {
      display: none;
    }

    // 待发放：整行强调卡，右侧「去结算」满足 44px 触控
    &.is-payment {
      grid-column: span 2;
      display: flex;
      align-items: center;

      :deep(.el-card__body) {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        width: 100%;
      }

      .stat-content {
        flex: 1;
        min-width: 0;
      }

      .card-badge {
        position: static;
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 0 18px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        background: linear-gradient(135deg, #409eff, #66b1ff);
      }
    }
  }
}
</style>
