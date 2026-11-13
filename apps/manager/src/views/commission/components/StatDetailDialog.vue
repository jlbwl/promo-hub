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
      <el-alert
        v-if="statDialogTruncated"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 12px;"
      >
        <template #title>
          数据共 {{ statDialogTotalCount }} 条，已达到单次加载上限，当前仅展示 {{ statDialogOrders.length }} 条，另有 {{ statDialogRemaining }} 条未加载，合计不完整
        </template>
      </el-alert>

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
            <span>{{ row.userName }}</span>
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
            <span style="font-weight: 600;">{{ displayProductPrice(row) }}</span>
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
          label="审核结果"
          width="100"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span :style="row.status === 'rejected' ? 'color: #f56c6c;' : ''">{{ auditResultText(row) }}</span>
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
import { maskPhone, formatTime, statusTagType, statusText, getManagerId, fetchAllOrders, displayProductPrice, sumDisplayProductPrice, auditResultText } from '../utils'
import type { Order } from '@promo/shared/types'

const statDialogVisible = ref(false)
const statDialogTitle = ref('')
const statDialogOrders = ref<Order[]>([])
// 后端总条数与截断信息，达到单次上限时必须明确展示
const statDialogTotalCount = ref(0)
const statDialogTruncated = ref(false)
const statDialogRemaining = ref(0)

const statDialogTotal = computed(() => {
  return sumDisplayProductPrice(statDialogOrders.value).toFixed(2)
})

// 打开通用数据查看弹窗；status 支持逗号分隔的多状态（如 settled,rejected）
const open = async (status: string, title: string) => {
  statDialogTitle.value = title + '明细'
  statDialogTruncated.value = false
  statDialogRemaining.value = 0
  statDialogTotalCount.value = 0
  statDialogVisible.value = true

  const statuses = status && status !== 'all' ? status.split(',') : []
  try {
    // 分页拉取全部订单，避免后端单页上限导致明细与合计失真
    const results = await Promise.all(
      (statuses.length > 0 ? statuses : ['']).map((item) =>
        fetchAllOrders({
          managerId: getManagerId() || undefined,
          ...(item ? { status: item } : {}),
        })
      )
    )
    let orders = results.flatMap((result) => result.orders)
    // 多状态合并展示时按审核时间倒序，便于按天回看审核结果
    if (statuses.length > 1) {
      orders = [...orders].sort((a, b) => (b.reviewedAt || '').localeCompare(a.reviewedAt || ''))
    }
    statDialogOrders.value = orders
    statDialogTotalCount.value = results.reduce((sum, result) => sum + result.total, 0)
    statDialogTruncated.value = results.some((result) => result.truncated)
    statDialogRemaining.value = results.reduce((sum, result) => sum + result.remaining, 0)
  } catch (error) {
    ElMessage.error('获取数据失败')
    statDialogVisible.value = false
  }
}

defineExpose({ open })
</script>
