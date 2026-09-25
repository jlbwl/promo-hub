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
        <p>已通过{{ methodLabel }}完成 {{ paymentOrders.length }} 笔订单结算</p>
        <p class="success-amount">
          ¥{{ paymentTotal }}
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
  </el-dialog>
</template>

<script setup lang="ts">
import { logger } from '@promo/shared/utils/logger'
import { getErrorMessage } from '@promo/shared/utils/errors'
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { SuccessFilled } from '@element-plus/icons-vue'
import { get, put } from '@promo/shared/utils/request'
import { maskName, maskPhone, formatTime, getManagerId } from '../utils'
import type { Order, PaginatedResponse } from '@promo/shared/types'

const emit = defineEmits<{
  success: []
}>()

const paymentDialogVisible = ref(false)
const paymentStep = ref<'list' | 'method' | 'success'>('list')
const paymentOrders = ref<Order[]>([])
const selectedPaymentMethod = ref('')
const settleLoading = ref(false)

const paymentMethods = [
  { value: 'alipay', label: '支付宝', desc: '推荐使用支付宝转账', icon: '支', color: '#1677ff' },
  { value: 'wechat', label: '微信支付', desc: '使用微信转账付款', icon: '微', color: '#07c160' },
  { value: 'bank', label: '银行卡', desc: '使用银行卡转账', icon: '银', color: '#e6a23c' },
]

const paymentTotal = computed(() => {
  return paymentOrders.value.reduce((sum: number, o: Order) => sum + (Number(o.productPrice) || 0), 0).toFixed(2)
})

const methodLabel = computed(() => {
  return paymentMethods.find(m => m.value === selectedPaymentMethod.value)?.label || ''
})

// 打开待发放结算弹窗并加载待发放订单
const open = async () => {
  paymentStep.value = 'list'
  selectedPaymentMethod.value = ''
  paymentDialogVisible.value = true

  // 加载待付款订单
  try {
    const res = await get<PaginatedResponse<Order>>('/orders', {
      managerId: getManagerId() || undefined,
      status: 'pending_payment',
      pageSize: 999,
    })
    paymentOrders.value = res.data?.list || []
  } catch (error) {
    ElMessage.error('获取待付款列表失败')
    paymentDialogVisible.value = false
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

    settleLoading.value = true
    // 逐笔结算
    let successCount = 0
    for (const order of paymentOrders.value) {
      try {
        await put(`/orders/${order.id}/settle`, { action: 'paid' })
        successCount++
      } catch (e) {
        logger.error(`结算订单 ${order.id} 失败:`, e)
      }
    }

    if (successCount === paymentOrders.value.length) {
      paymentStep.value = 'success'
    } else {
      ElMessage.warning(`成功结算 ${successCount}/${paymentOrders.value.length} 笔`)
      paymentDialogVisible.value = false
    }

    emit('success')
  } catch (error) {
    if (error !== 'cancel') {
      const message = getErrorMessage(error, '')
      if (message) {
        ElMessage.error(message)
      }
    }
  } finally {
    settleLoading.value = false
  }
}

// 关闭结算弹窗
const closePaymentDialog = () => {
  paymentDialogVisible.value = false
  paymentStep.value = 'list'
  paymentOrders.value = []
  selectedPaymentMethod.value = ''
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
