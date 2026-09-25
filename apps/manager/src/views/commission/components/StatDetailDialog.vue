<template>
  <!-- ====== 通用数据查看模态框 ====== -->
  <el-dialog
    v-model="statDialogVisible"
    :title="statDialogTitle"
    width="950px"
    destroy-on-close
  >
    <div
      class="stat-dialog-content"
      style="overflow: hidden;"
    >
      <div class="payment-summary">
        <span>共 <strong>{{ statDialogOrders.length }}</strong> 条记录</span>
        <span class="payment-total">
          合计推广费：<strong>{{ statDialogTotal }}</strong>
        </span>
      </div>

      <el-table
        :data="statDialogOrders"
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
          min-width="140"
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
          label="姓名"
          width="80"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span>{{ maskName(row.userName) }}</span>
          </template>
        </el-table-column>
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
          prop="status"
          label="状态"
          width="70"
          align="center"
        >
          <template #default="{ row }">
            <el-tag
              :type="statusTagType(row.status)"
              size="small"
            >
              {{ statusText(row.status) }}
            </el-tag>
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
        <el-table-column
          prop="rejectReason"
          label="驳回原因"
          width="100"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span style="color: #f56c6c;">{{ row.rejectReason || '--' }}</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="settledAt"
          label="结算日期"
          width="130"
          align="center"
        >
          <template #default="{ row }">
            <span>{{ row.settledAt ? formatTime(row.settledAt) : '--' }}</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="payment-actions">
        <el-button @click="statDialogVisible = false">
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
import { maskName, maskPhone, formatTime, statusTagType, statusText, getManagerId } from '../utils'
import type { Order, PaginatedResponse } from '@promo/shared/types'

const statDialogVisible = ref(false)
const statDialogTitle = ref('')
const statDialogOrders = ref<Order[]>([])

const statDialogTotal = computed(() => {
  return statDialogOrders.value.reduce((sum: number, o: Order) => sum + (Number(o.productPrice) || 0), 0).toFixed(2)
})

// 打开通用数据查看弹窗
const open = async (status: string, title: string) => {
  statDialogTitle.value = title + '明细'
  statDialogVisible.value = true

  try {
    const params: {
      managerId?: string
      pageSize: number
      status?: string
    } = {
      managerId: getManagerId() || undefined,
      pageSize: 999,
    }
    if (status !== 'all') params.status = status

    const res = await get<PaginatedResponse<Order>>('/orders', params)
    statDialogOrders.value = res.data?.list || []
  } catch (error) {
    ElMessage.error('获取数据失败')
    statDialogVisible.value = false
  }
}

defineExpose({ open })
</script>
