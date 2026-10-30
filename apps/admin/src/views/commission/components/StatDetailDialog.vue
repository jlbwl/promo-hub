<template>
  <!-- ====== 通用数据查看模态框 ====== -->
  <el-dialog
    v-model="visible"
    :title="title"
    width="1100px"
    destroy-on-close
  >
    <div
      class="stat-dialog-content"
      style="overflow: hidden;"
    >
      <div class="payment-summary">
        <span>共 <strong>{{ orders.length }}</strong> 条记录</span>
        <div class="payment-summary-right">
          <span class="payment-total">合计佣金：<strong>{{ total }}</strong></span>
          <el-popover
            placement="bottom-end"
            :width="180"
            trigger="click"
          >
            <template #reference>
              <el-button
                size="small"
                text
                bg
              >
                列设置
              </el-button>
            </template>
            <div class="column-settings">
              <el-checkbox
                v-for="col in columnOptions"
                :key="col.key"
                v-model="visibleColumns[col.key]"
              >
                {{ col.label }}
              </el-checkbox>
            </div>
          </el-popover>
        </div>
      </div>
      <el-table
        :data="orders"
        border
        size="small"
        max-height="450"
        style="width: 100%;"
      >
        <el-table-column
          type="index"
          label="#"
          width="40"
        />
        <el-table-column
          v-if="visibleColumns.productName"
          prop="productName"
          label="产品名称"
          min-width="200"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span>{{ row.productName }}</span>
            <el-tag
              v-if="row.optionLabel"
              size="small"
              type="info"
              style="margin-left: 4px;"
            >
              {{ row.optionLabel }}
            </el-tag>
            <el-tag
              v-if="row.fundAccount"
              size="small"
              type="primary"
              plain
              style="margin-left: 4px;"
            >
              {{ row.fundAccount }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          v-if="visibleColumns.userName"
          prop="userName"
          label="用户姓名"
          width="90"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span>{{ row.userName }}</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="visibleColumns.managerName"
          label="渠道名称"
          width="110"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span>{{ teamNameOf(row.managerId) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="visibleColumns.teamName"
          prop="teamName"
          label="团队名称"
          width="110"
          show-overflow-tooltip
        />
        <el-table-column
          v-if="visibleColumns.userPhone"
          prop="userPhone"
          label="手机号"
          width="100"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span>{{ maskPhone(row.userPhone) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="visibleColumns.productPrice"
          prop="productPrice"
          label="推广费"
          width="70"
          align="right"
        >
          <template #default="{ row }">
            <span style="font-weight: 600;">{{ row.productPrice }}</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="visibleColumns.createdAt"
          label="做单时间"
          width="130"
          align="center"
        >
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column
          v-if="visibleColumns.settledAt"
          prop="settledAt"
          label="结算时间"
          width="130"
          align="center"
        >
          <template #default="{ row }">
            <span>{{ row.settledAt ? formatTime(row.settledAt) : '--' }}</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="visibleColumns.rejectReason"
          prop="rejectReason"
          label="驳回理由"
          min-width="150"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span style="color: #f56c6c;">{{ row.rejectReason || '--' }}</span>
          </template>
        </el-table-column>
      </el-table>
      <div class="payment-actions">
        <el-button @click="visible = false">
          关闭
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { get } from '@promo/shared/utils/request'
import { maskPhone, formatTime, getManagerTeamName } from '../utils'
import type { Manager, Order, PaginatedResponse } from '@promo/shared/types'

const props = defineProps<{
  managers: Manager[]
}>()

const visible = ref(false)
const title = ref('')
const orders = ref<Order[]>([])
const total = computed(() => orders.value.reduce((s: number, o: Order) => s + (Number(o.productPrice) || 0), 0).toFixed(2))

// 列显示/隐藏配置（序号列固定显示，不提供开关）
const columnOptions = [
  { key: 'productName', label: '产品名称' },
  { key: 'userName', label: '用户姓名' },
  { key: 'managerName', label: '渠道名称' },
  { key: 'teamName', label: '团队名称' },
  { key: 'userPhone', label: '手机号' },
  { key: 'productPrice', label: '推广费' },
  { key: 'createdAt', label: '做单时间' },
  { key: 'settledAt', label: '结算时间' },
  { key: 'rejectReason', label: '驳回理由' },
] as const

type ColumnKey = (typeof columnOptions)[number]['key']

const visibleColumns = reactive<Record<ColumnKey, boolean>>({
  productName: true,
  userName: true,
  managerName: true,
  teamName: true,
  userPhone: true,
  productPrice: true,
  createdAt: true,
  settledAt: true,
  rejectReason: true,
})

// 根据经理 ID 获取渠道名称
const teamNameOf = (managerId: string) => getManagerTeamName(props.managers, managerId)

// 打开统计明细弹窗（status 为 'all' 时查询全部）
const open = async (status: string, t: string) => {
  title.value = t + '明细'
  visible.value = true
  try {
    const params: { pageSize: number; status?: string } = { pageSize: 999 }
    if (status !== 'all') params.status = status
    const res = await get<PaginatedResponse<Order>>('/orders', params)
    orders.value = res.data?.list || []
  } catch {
    ElMessage.error('获取数据失败')
    visible.value = false
  }
}

defineExpose({ open })
</script>

<style lang="scss" scoped>
.payment-summary { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #f5f7fa; border-radius: 8px; margin-bottom: 16px; font-size: 14px; color: #606266;
  .payment-summary-right { display: flex; align-items: center; gap: 12px; }
  .payment-total { color: #409eff; font-size: 16px; }
}
.column-settings { display: flex; flex-direction: column; gap: 6px;
  :deep(.el-checkbox) { margin-right: 0; }
}
.payment-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; padding-top: 16px; border-top: 1px solid #ebeef5; }

@media (max-width: 768px) {
  .payment-summary {
    flex-direction: column;
    gap: 8px;
    font-size: 13px;

    .payment-total {
      font-size: 14px;
    }
  }

  .payment-actions {
    justify-content: center;
  }
}
</style>
