<template>
  <!-- ====== 通用数据查看模态框：移动端全屏 + 卡片列表 ====== -->
  <el-dialog
    v-model="statDialogVisible"
    :title="statDialogTitle"
    :width="isMobile ? '100%' : '950px'"
    :fullscreen="isMobile"
    class="stat-detail-dialog"
    body-class="stat-detail-body"
    destroy-on-close
  >
    <div class="stat-dialog-content">
      <div class="stat-dialog-scroll">
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

        <div
          class="payment-summary"
          :class="{ 'is-mobile': isMobile }"
        >
          <span>共 <strong>{{ statDialogOrders.length }}</strong> 条记录</span>
          <span class="payment-total">
            合计推广费：<strong>{{ statDialogTotal }}</strong>
          </span>
        </div>

        <!-- 移动端：单列明细，避免弹窗内再横向滚动 -->
        <div
          v-if="isMobile"
          class="stat-list"
        >
          <div
            v-for="(row, index) in statDialogOrders"
            :key="row.id"
            class="stat-item"
          >
            <div class="stat-item-head">
              <span class="stat-item-index">{{ index + 1 }}</span>
              <span class="stat-item-name">{{ row.productName }}</span>
              <el-tag
                :type="statusTagType(row.status)"
                size="small"
              >
                {{ statusText(row.status) }}
              </el-tag>
            </div>
            <div
              v-if="row.optionLabel || row.fundAccount"
              class="stat-item-tags"
            >
              <el-tag
                v-if="row.optionLabel"
                size="small"
                type="info"
              >
                {{ row.optionLabel }}
              </el-tag>
              <el-tag
                v-if="row.fundAccount"
                size="small"
                type="primary"
                plain
              >
                {{ row.fundAccount }}
              </el-tag>
            </div>
            <div class="stat-item-row">
              <span>{{ row.userName || '--' }} · {{ maskPhone(row.userPhone) }}</span>
              <span class="stat-item-price">{{ displayProductPrice(row) }}</span>
            </div>
            <div class="stat-item-row is-muted">
              <span>做单 {{ formatTime(row.createdAt) }}</span>
              <span>结算 {{ row.settledAt ? formatTime(row.settledAt) : '--' }}</span>
            </div>
            <div class="stat-item-row is-muted">
              <span>审核结果</span>
              <span :class="{ 'is-danger': row.status === 'rejected' }">{{ auditResultText(row) }}</span>
            </div>
          </div>
          <p
            v-if="statDialogOrders.length === 0"
            class="stat-empty"
          >
            暂无数据
          </p>
        </div>

        <!-- 桌面端：保持原表格 -->
        <el-table
          v-else
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
      </div>

      <BottomActionBar
        class="payment-actions"
        fixed
        align="end"
      >
        <el-button @click="statDialogVisible = false">
          关闭
        </el-button>
      </BottomActionBar>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { maskPhone, formatTime, statusTagType, statusText, getManagerId, fetchAllOrders, displayProductPrice, sumDisplayProductPrice, auditResultText } from '../utils'
import { useIsMobile } from '@/composables/useIsMobile'
import BottomActionBar from '@/components/BottomActionBar.vue'
import type { Order } from '@promo/shared/types'

const { isMobile } = useIsMobile()

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

<style lang="scss" scoped>
.stat-dialog-content {
  overflow: hidden;
}

.payment-summary {
  &.is-mobile {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 12px 14px;
    margin-bottom: 12px;
    font-size: 14px;
    color: #606266;
    background-color: #f5f7fa;
    border-radius: 10px;

    .payment-total {
      color: #409eff;
      font-size: 16px;
    }
  }
}

/* ===== 移动端明细列表 ===== */
.stat-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stat-item {
  padding: 12px 14px;
  background-color: #ffffff;
  border: 1px solid #ebeef5;
  border-radius: 12px;
}

.stat-item-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;

  .stat-item-index {
    flex: none;
    min-width: 18px;
    font-size: 12px;
    line-height: 20px;
    color: #c0c4cc;
  }

  .stat-item-name {
    flex: 1;
    min-width: 0;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
    color: #303133;
    word-break: break-all;
  }
}

.stat-item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0 0 26px;
}

.stat-item-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-top: 6px;
  padding-left: 26px;
  font-size: 13px;
  color: #303133;

  &.is-muted {
    font-size: 12px;
    color: #909399;
  }

  .is-danger {
    color: #f56c6c;
  }
}

.stat-item-price {
  flex: none;
  font-size: 15px;
  font-weight: 600;
  color: #409eff;
}

.stat-empty {
  padding: 40px 0;
  font-size: 14px;
  color: #909399;
  text-align: center;
}
</style>

<style lang="scss">
/* 全屏弹窗由 teleport 渲染，容器结构用全局样式控制 */
.stat-detail-dialog.is-fullscreen {
  display: flex;
  flex-direction: column;
  margin: 0;
  overflow: hidden;
  border-radius: 0;
}

.stat-detail-dialog.is-fullscreen .stat-detail-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 12px 14px 0;
}

.stat-detail-dialog.is-fullscreen .stat-dialog-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.stat-detail-dialog.is-fullscreen .stat-dialog-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
