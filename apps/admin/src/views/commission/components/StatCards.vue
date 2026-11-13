<template>
  <!-- 统计卡片：5 张等分铺满整行 -->
  <div class="stat-cards">
    <el-card
      v-for="card in cards"
      :key="card.status"
      shadow="hover"
      class="stat-card clickable"
      @click="emit('select', card.status, card.title)"
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
import { Document, Clock, CircleCheck, Wallet, SuccessFilled } from '@element-plus/icons-vue'

interface StatCardItem {
  status: string
  label: string
  title: string
  statKey: 'total' | 'pending' | 'approved' | 'pendingPayment' | 'settled' | 'rejected'
  /** 需要合并到本卡片计数的其他状态（如已发放卡片并入已驳回笔数） */
  extraStatKeys?: ('total' | 'pending' | 'approved' | 'pendingPayment' | 'settled' | 'rejected')[]
  icon: unknown
  iconStyle: string
  badgeText: string
  badgeStyle: string
}

// 统计数据（label 为卡片文案，title 为点击查看时弹窗标题）
const props = defineProps<{
  stats: {
    total: number
    pending: number
    approved: number
    pendingPayment: number
    settled: number
    rejected: number
  }
}>()

const emit = defineEmits<{
  select: [status: string, title: string]
}>()

const cards: StatCardItem[] = [
  { status: 'all', label: '总订单', title: '总订单', statKey: 'total', icon: Document, iconStyle: 'color: #409eff; background: #ecf5ff;', badgeText: '查看', badgeStyle: '' },
  { status: 'pending', label: '待审核', title: '待审核', statKey: 'pending', icon: Clock, iconStyle: 'color: #e6a23c; background: #fdf6ec;', badgeText: '查看', badgeStyle: 'background: linear-gradient(135deg, #e6a23c, #f5c77e);' },
  { status: 'approved', label: '已通过', title: '已通过', statKey: 'approved', icon: CircleCheck, iconStyle: 'color: #67c23a; background: #f0f9eb;', badgeText: '查看', badgeStyle: 'background: linear-gradient(135deg, #67c23a, #95d475);' },
  { status: 'pending_payment', label: '待发放', title: '待付款', statKey: 'pendingPayment', icon: Wallet, iconStyle: 'color: #409eff; background: #ecf5ff;', badgeText: '去结算', badgeStyle: '' },
  // 已发放并入已驳回笔数：驳回单不产生推广费，明细中按 0 展示
  { status: 'settled,rejected', label: '已发放', title: '已发放', statKey: 'settled', extraStatKeys: ['rejected'], icon: SuccessFilled, iconStyle: 'color: #67c23a; background: #f0f9eb;', badgeText: '查看', badgeStyle: 'background: linear-gradient(135deg, #67c23a, #95d475);' },
]

// 卡片数值：基础状态 + 合并状态的笔数之和
const getCardValue = (card: StatCardItem) => {
  const keys = [card.statKey, ...(card.extraStatKeys || [])]
  return keys.reduce((sum, key) => sum + (Number(props.stats[key]) || 0), 0)
}
</script>

<style lang="scss" scoped>
.stat-cards { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 20px; margin-bottom: 20px; }
.stat-card {
  position: relative; cursor: default; min-width: 0;
  .stat-content { display: flex; align-items: center; justify-content: space-between;
    .stat-info { .stat-label { display: block; font-size: 14px; color: #909399; margin-bottom: 8px; } }
    .stat-icon { width: 56px; height: 56px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 28px; }
  }
  &.clickable { cursor: pointer; transition: all 0.3s; border: 2px solid transparent;
    &:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(64,158,255,0.3); }
  }
  .card-badge { position: absolute; top: 12px; right: 12px; padding: 2px 8px; border-radius: 10px; font-size: 11px; color: #fff; background: linear-gradient(135deg, #409eff, #66b1ff); }
}

@media (max-width: 991px) {
  .stat-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .stat-cards {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .stat-card {
    .stat-content {
      .stat-info {
        .stat-label {
          font-size: 12px;
        }
      }
      .stat-icon {
        width: 48px;
        height: 48px;
        font-size: 24px;
      }
    }
    .card-badge {
      font-size: 10px;
      padding: 2px 6px;
    }
  }
}
</style>
