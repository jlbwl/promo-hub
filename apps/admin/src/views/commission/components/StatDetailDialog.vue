<template>
  <!-- ====== 通用数据查看模态框 ====== -->
  <el-dialog
    v-model="visible"
    :title="title"
    width="950px"
    destroy-on-close
  >
    <div
      class="stat-dialog-content"
      style="overflow: hidden;"
    >
      <div class="payment-summary">
        <span>共 <strong>{{ orders.length }}</strong> 条记录</span>
        <span class="payment-total">合计佣金：<strong>{{ total }}</strong></span>
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
          prop="userName"
          label="用户姓名"
          width="90"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span>{{ maskName(row.userName) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          label="渠道名称"
          width="110"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span>{{ teamNameOf(row.managerId) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="teamName"
          label="团队名称"
          width="110"
          show-overflow-tooltip
        />
        <el-table-column
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
          label="做单时间"
          width="130"
          align="center"
        >
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
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
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { get } from '@promo/shared/utils/request'
import { maskName, maskPhone, formatTime, getManagerTeamName } from '../utils'
import type { Manager, Order, PaginatedResponse } from '@promo/shared/types'

const props = defineProps<{
  managers: Manager[]
}>()

const visible = ref(false)
const title = ref('')
const orders = ref<Order[]>([])
const total = computed(() => orders.value.reduce((s: number, o: Order) => s + (Number(o.productPrice) || 0), 0).toFixed(2))

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
  .payment-total { color: #409eff; font-size: 16px; }
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
