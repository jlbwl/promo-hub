<template>
  <!-- ====== 待发放发放模态框 ====== -->
  <el-dialog
    v-model="paymentDialogVisible"
    title="待发放发放"
    width="850px"
    destroy-on-close
  >
    <!-- 待付款列表 -->
    <div
      v-if="paymentStep === 'list'"
      class="payment-dialog-content"
      style="overflow: hidden;"
    >
      <el-alert
        v-if="truncated"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 12px;"
      >
        <template #title>
          待发放订单共 {{ pendingTotal }} 笔，本次仅加载 {{ paymentOrders.length }} 笔，另有 {{ remainingCount }} 笔未加载，请先处理当前批次后再继续
        </template>
      </el-alert>

      <div class="payment-summary">
        <span>共 <strong>{{ paymentOrders.length }}</strong> 笔待发放</span>
        <span class="payment-total">
          合计：<strong>{{ paymentTotal }}</strong>
        </span>
      </div>

      <el-table
        :data="paymentOrders"
        border
        size="small"
        max-height="400"
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
          width="90"
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
          width="80"
          align="right"
        >
          <template #default="{ row }">
            <span style="font-weight: 600; color: #409eff;">{{ row.productPrice }}</span>
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
        <el-button @click="paymentDialogVisible = false">
          关闭
        </el-button>
        <el-button
          type="primary"
          :disabled="paymentOrders.length === 0"
          @click="paymentStep = 'method'"
        >
          一键发放（{{ paymentOrders.length }}笔）
        </el-button>
      </div>
    </div>

    <!-- 选择发放方式 -->
    <div
      v-else-if="paymentStep === 'method'"
      class="payment-dialog-content"
    >
      <div class="payment-summary">
        <span>共 <strong>{{ paymentOrders.length }}</strong> 笔</span>
        <span class="payment-total">
          合计：<strong>{{ paymentTotal }}</strong>
        </span>
      </div>

      <div class="payment-methods">
        <div
          v-for="method in paymentMethods"
          :key="method.value"
          class="method-card"
          :class="{ active: selectedPaymentMethod === method.value }"
          @click="selectedPaymentMethod = method.value"
        >
          <div
            class="method-icon"
            :style="{ background: method.color }"
          >
            <span>{{ method.icon }}</span>
          </div>
          <div class="method-info">
            <span class="method-name">{{ method.label }}</span>
            <span class="method-desc">{{ method.desc }}</span>
          </div>
          <el-radio
            :model-value="selectedPaymentMethod"
            :value="method.value"
            style="margin-left: auto;"
          />
        </div>
      </div>

      <div class="payment-actions">
        <el-button @click="paymentStep = 'list'">
          返回
        </el-button>
        <el-button
          type="primary"
          :disabled="!selectedPaymentMethod"
          :loading="settleLoading"
          @click="handleBatchSettle"
        >
          确认发放 {{ paymentTotal }}
        </el-button>
      </div>
    </div>

    <!-- 发放成功 -->
    <div
      v-else-if="paymentStep === 'success'"
      class="payment-dialog-content"
    >
      <div class="success-result">
        <el-icon
          class="success-icon"
          style="color: #67c23a; font-size: 64px;"
        >
          <SuccessFilled />
        </el-icon>
        <h3>结算成功</h3>
        <p>已通过{{ methodLabel }}完成 {{ settledOrders.length }} 笔订单结算</p>
        <p class="success-amount">
          ¥{{ successTotal }}
        </p>
      </div>
      <div
        class="payment-actions"
        style="justify-content: center;"
      >
        <el-button
          type="primary"
          @click="closePaymentDialog"
        >
          完成
        </el-button>
      </div>
    </div>

    <!-- 部分失败：列出失败明细并支持重试 -->
    <div
      v-else-if="paymentStep === 'failed'"
      class="payment-dialog-content"
    >
      <el-alert
        type="error"
        :closable="false"
        show-icon
        :title="`本次成功 ${settledOrders.length} 笔，失败 ${failedOrders.length} 笔`"
        style="margin-bottom: 12px;"
      />

      <div class="payment-summary">
        <span>成功 <strong>{{ settledOrders.length }}</strong> 笔</span>
        <span class="payment-total">
          成功合计：<strong>{{ successTotal }}</strong>
        </span>
      </div>

      <el-table
        :data="failedOrders"
        border
        size="small"
        max-height="360"
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
          </template>
        </el-table-column>
        <el-table-column
          prop="userName"
          label="姓名"
          width="90"
          show-overflow-tooltip
        />
        <el-table-column
          prop="userPhone"
          label="手机号"
          width="110"
        >
          <template #default="{ row }">
            <span>{{ maskPhone(row.userPhone) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="productPrice"
          label="推广费"
          width="80"
          align="right"
        />
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
        <el-button @click="closePaymentDialog">
          关闭
        </el-button>
        <el-button
          type="primary"
          :loading="settleLoading"
          @click="handleRetryFailed"
        >
          重试失败项（{{ failedOrders.length }} 笔）
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { getErrorMessage } from '@promo/shared/utils/errors'
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { SuccessFilled } from '@element-plus/icons-vue'
import { put } from '@promo/shared/utils/request'
import { maskPhone, formatTime, getManagerId, fetchAllOrders, settleOrders, sumProductPrice } from '../utils'
import type { Order } from '@promo/shared/types'

const emit = defineEmits<{
  success: []
}>()

const paymentDialogVisible = ref(false)
const paymentStep = ref<'list' | 'method' | 'success' | 'failed'>('list')
const paymentOrders = ref<Order[]>([])
const settledOrders = ref<Order[]>([])
const failedOrders = ref<Order[]>([])
const selectedPaymentMethod = ref('')
const settleLoading = ref(false)
// 后端返回的待发放总数，以及是否因单次上限未拉全
const pendingTotal = ref(0)
const truncated = ref(false)
const remainingCount = ref(0)

const paymentMethods = [
  { value: 'alipay', label: '支付宝', desc: '推荐使用支付宝转账', icon: '支', color: '#1677ff' },
  { value: 'wechat', label: '微信支付', desc: '使用微信转账付款', icon: '微', color: '#07c160' },
  { value: 'bank', label: '银行卡', desc: '使用银行卡转账', icon: '银', color: '#e6a23c' },
]

const paymentTotal = computed(() => sumProductPrice(paymentOrders.value).toFixed(2))

// 成功金额只统计本次实际结算成功的订单
const successTotal = computed(() => sumProductPrice(settledOrders.value).toFixed(2))

const methodLabel = computed(() => {
  return paymentMethods.find(m => m.value === selectedPaymentMethod.value)?.label || ''
})

// 打开待发放结算弹窗并加载待发放订单
const open = async () => {
  paymentStep.value = 'list'
  selectedPaymentMethod.value = ''
  settledOrders.value = []
  failedOrders.value = []
  pendingTotal.value = 0
  truncated.value = false
  remainingCount.value = 0
  paymentDialogVisible.value = true

  // 加载全部待付款订单（分页拉取，避免后端单页上限导致漏结算）
  try {
    const result = await fetchAllOrders({
      managerId: getManagerId() || undefined,
      status: 'pending_payment',
    })
    paymentOrders.value = result.orders
    pendingTotal.value = result.total
    truncated.value = result.truncated
    remainingCount.value = result.remaining

    // 达到单次加载上限时必须明示，不能静默只处理前 5000 笔
    if (result.truncated) {
      ElMessage.warning(
        `待发放订单共 ${result.total} 笔，本次最多处理 ${result.orders.length} 笔，另有 ${result.remaining} 笔未加载`
      )
    }
  } catch (error) {
    ElMessage.error('获取待付款列表失败')
    paymentDialogVisible.value = false
  }
}

// 逐笔结算并汇总成功/失败明细
const runSettle = async (orders: Order[]) => {
  settleLoading.value = true
  try {
    const result = await settleOrders(orders, order => put(`/orders/${order.id}/settle`, { action: 'paid' }))
    settledOrders.value = [...settledOrders.value, ...result.settled]
    failedOrders.value = result.failed
    // 有失败时停留在失败页，展示明细并允许重试，不得直接关闭
    paymentStep.value = result.failed.length === 0 ? 'success' : 'failed'
    emit('success')
  } finally {
    settleLoading.value = false
  }
}

// 一键结算
const handleBatchSettle = async () => {
  if (!selectedPaymentMethod.value) {
    ElMessage.warning('请选择付款方式')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认通过${methodLabel.value}支付 ¥${paymentTotal.value}，结算 ${paymentOrders.value.length} 笔订单？`,
      '确认结算',
      { confirmButtonText: '确认付款', cancelButtonText: '取消', type: 'warning' }
    )

    await runSettle(paymentOrders.value)
  } catch (error) {
    if (error !== 'cancel') {
      const message = getErrorMessage(error, '')
      if (message) {
        ElMessage.error(message)
      }
    }
  }
}

// 仅重试失败项
const handleRetryFailed = async () => {
  if (failedOrders.value.length === 0) return
  await runSettle(failedOrders.value)
}

// 关闭结算弹窗
const closePaymentDialog = () => {
  paymentDialogVisible.value = false
  paymentStep.value = 'list'
  paymentOrders.value = []
  settledOrders.value = []
  failedOrders.value = []
  selectedPaymentMethod.value = ''
  pendingTotal.value = 0
  truncated.value = false
  remainingCount.value = 0
}

defineExpose({ open })
</script>

<style lang="scss" scoped>
// 待付款弹窗内容
.payment-dialog-content {
  .payment-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #f5f7fa;
    border-radius: 8px;
    margin-bottom: 16px;
    font-size: 14px;
    color: #606266;

    .payment-total {
      color: #409eff;
      font-size: 16px;
    }
  }

  .payment-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid #ebeef5;
  }

  // 付款方式选择
  .payment-methods {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 8px;
  }

  .method-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
    border: 2px solid #e4e7ed;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: #409eff;
      background: #f5f9ff;
    }

    &.active {
      border-color: #409eff;
      background: #ecf5ff;
    }

    .method-icon {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 18px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .method-info {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .method-name {
        font-size: 15px;
        font-weight: 600;
        color: #303133;
      }

      .method-desc {
        font-size: 12px;
        color: #909399;
      }
    }
  }

  // 结算成功
  .success-result {
    text-align: center;
    padding: 30px 0;

    .success-icon {
      margin-bottom: 16px;
    }

    h3 {
      font-size: 20px;
      color: #303133;
      margin-bottom: 8px;
    }

    p {
      color: #909399;
      font-size: 14px;
    }

    .success-amount {
      font-size: 32px;
      font-weight: 700;
      color: #67c23a;
      margin-top: 12px;
    }
  }
}
</style>
