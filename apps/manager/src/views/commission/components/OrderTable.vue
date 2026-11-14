<template>
  <!-- ===== 移动端：卡片列表 + 分页，替代横向滚动的多列表格 ===== -->
  <div
    v-if="isMobile"
    ref="listRef"
    class="order-cards"
  >
    <!-- 首屏骨架：与其它列表页共用统一加载态 -->
    <SkeletonList
      v-if="firstLoading"
      variant="text"
    />

    <!-- 首屏失败：整块给出可重试反馈 -->
    <div
      v-if="loadError && !data.length && !loading"
      class="load-feedback"
    >
      <p class="load-feedback-text">
        {{ loadError }}
      </p>
      <el-button
        type="primary"
        @click="emit('retry')"
      >
        重新加载
      </el-button>
    </div>

    <!-- 已有数据时的失败提示，保留列表并允许重试 -->
    <div
      v-if="loadError && data.length > 0"
      class="load-feedback is-inline"
    >
      <span class="load-feedback-text">{{ loadError }}</span>
      <el-button
        type="primary"
        plain
        size="small"
        @click="emit('retry')"
      >
        重试
      </el-button>
    </div>

    <SwipeActionCell
      v-for="row in data"
      :key="row.id"
      class="order-swipe-cell"
      :data-order-id="row.id"
      :open="openOrderId === row.id"
      :disabled="row.status !== 'pending'"
      @update:open="value => handleSwipeOpen(row, value)"
    >
      <!-- 卡片信息层级对齐用户端佣金记录：左侧标题/辅助信息，右侧金额/状态 -->
      <article class="order-card">
        <div class="card-main">
          <div class="card-left">
            <h4 class="card-title">
              <span class="card-title-text">{{ row.productName }}</span>
              <el-tag
                v-if="row.optionLabel"
                size="small"
                type="info"
                effect="plain"
              >
                {{ row.optionLabel }}
              </el-tag>
              <el-tag
                v-if="row.fundAccount"
                size="small"
                type="primary"
                effect="plain"
              >
                {{ row.fundAccount }}
              </el-tag>
              <el-tag
                v-if="row.duplicate"
                size="small"
                type="warning"
              >
                重单
              </el-tag>
            </h4>
            <div
              v-if="row.userName || row.userPhone"
              class="card-user"
            >
              <span v-if="row.userName">姓名：{{ row.userName }}</span>
              <span v-if="row.userPhone">手机：{{ maskPhone(row.userPhone) }}</span>
            </div>
            <span class="card-time">{{ formatTime(row.createdAt) }}</span>
            <span
              v-if="row.status === 'rejected'"
              class="card-reject"
            >驳回原因：{{ auditResultText(row) }}</span>
            <span
              v-else-if="row.settledAt"
              class="card-settled"
            >发放：{{ formatTime(row.settledAt) }}</span>
          </div>
          <div class="card-right">
            <span class="card-price">{{ displayProductPrice(row) }}</span>
            <el-tag
              :type="statusTagType(row.status)"
              size="small"
              round
            >
              {{ statusText(row.status) }}
            </el-tag>
          </div>
        </div>

        <BottomActionBar
          v-if="row.status === 'approved'"
        >
          <el-button
            type="primary"
            @click="emit('add-to-payment', row)"
          >
            添加到待发放
          </el-button>
        </BottomActionBar>
      </article>

      <!-- 待审核订单的左滑审核入口（44px 以上触控高度） -->
      <template #actions="{ open }">
        <button
          type="button"
          class="swipe-action is-success"
          :tabindex="open ? 0 : -1"
          @click="handleAuditAction(row, 'approve')"
        >
          审核通过
        </button>
        <button
          type="button"
          class="swipe-action is-danger"
          :tabindex="open ? 0 : -1"
          @click="handleAuditAction(row, 'reject')"
        >
          驳回
        </button>
      </template>
    </SwipeActionCell>

    <p
      v-if="!loading && !loadError && data.length === 0"
      class="card-empty"
    >
      {{ onlyDuplicate ? '当前筛选条件下没有重单' : '暂无数据' }}
    </p>

    <!-- 移动端分页：每页固定 10 条，展示总条数与页码，与产品列表保持一致 -->
    <div
      v-if="total > 0"
      class="pagination-container pagination-container--mobile"
    >
      <el-pagination
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        :pager-count="5"
        size="small"
        background
        layout="total, prev, pager, next"
        @current-change="handleMobilePageChange"
      />
    </div>
  </div>

  <!-- ===== 桌面端：保持原数据表格与分页 ===== -->
  <template v-else>
    <el-table
      v-loading="loading"
      :data="data"
      :empty-text="onlyDuplicate ? '当前筛选条件下没有重单' : '暂无数据'"
      border
      stripe
      style="width: 100%;"
    >
      <el-table-column
        prop="productName"
        label="产品名称"
        min-width="180"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <span>{{ row.productName }}</span>
          <el-tag
            v-if="row.optionLabel"
            size="small"
            type="info"
            style="margin-left: 6px;"
          >
            {{ row.optionLabel }}
          </el-tag>
          <el-tag
            v-if="row.fundAccount"
            size="small"
            type="primary"
            plain
            style="margin-left: 6px;"
          >
            {{ row.fundAccount }}
          </el-tag>
          <!-- M1：同客户同产品存在多笔在流程订单时标记「重单」，仅提示不阻断 -->
          <el-tag
            v-if="row.duplicate"
            size="small"
            type="warning"
            style="margin-left: 6px;"
          >
            重单
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        prop="userName"
        label="用户姓名"
        width="120"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <span>{{ row.userName }}</span>
        </template>
      </el-table-column>
      <el-table-column
        prop="userPhone"
        label="手机号"
        width="130"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <span>{{ maskPhone(row.userPhone) }}</span>
        </template>
      </el-table-column>
      <el-table-column
        prop="productPrice"
        label="推广费"
        width="100"
        align="right"
      >
        <template #default="{ row }">
          <span style="font-weight: 500;">{{ displayProductPrice(row) }}</span>
        </template>
      </el-table-column>
      <el-table-column
        prop="status"
        label="状态"
        width="100"
        align="center"
      >
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)">
            {{ statusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="做单时间"
        width="170"
        align="center"
      >
        <template #default="{ row }">
          {{ formatTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column
        label="审核结果"
        width="120"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <span :style="row.status === 'rejected' ? 'color: #f56c6c;' : ''">{{ auditResultText(row) }}</span>
        </template>
      </el-table-column>
      <el-table-column
        prop="settledAt"
        label="发放日期"
        width="170"
        align="center"
      >
        <template #default="{ row }">
          <span>{{ row.settledAt ? formatTime(row.settledAt) : '--' }}</span>
        </template>
      </el-table-column>
      <el-table-column
        label="操作"
        width="200"
        align="center"
        fixed="right"
      >
        <template #default="{ row }">
          <div class="table-actions">
            <template v-if="row.status === 'pending'">
              <el-button
                type="success"
                text
                size="small"
                @click="emit('approve', row)"
              >
                审核通过
              </el-button>
              <el-button
                type="danger"
                text
                size="small"
                @click="emit('reject', row)"
              >
                驳回
              </el-button>
            </template>
            <template v-else-if="row.status === 'approved'">
              <el-button
                type="primary"
                text
                size="small"
                @click="emit('add-to-payment', row)"
              >
                添加到待发放
              </el-button>
            </template>
            <template v-else>
              <span style="color: #909399; font-size: 13px;">--</span>
            </template>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-container">
      <el-pagination
        :current-page="page"
        :page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @update:current-page="emit('update:page', $event)"
        @update:page-size="emit('update:pageSize', $event)"
        @size-change="emit('page-change')"
        @current-change="emit('page-change')"
      />
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { maskPhone, formatTime, statusTagType, statusText, displayProductPrice, auditResultText } from '../utils'
import { useIsMobile } from '@/composables/useIsMobile'
import SkeletonList from '@/components/SkeletonList.vue'
import BottomActionBar from '@/components/BottomActionBar.vue'
import SwipeActionCell from '@/components/SwipeActionCell.vue'
import type { Order } from '@promo/shared/types'

const props = defineProps<{
  loading: boolean
  data: Order[]
  total: number
  page: number
  pageSize: number
  onlyDuplicate: boolean
  /** 列表加载失败提示（移动端展示），空字符串表示无错误 */
  loadError?: string
}>()

const emit = defineEmits<{
  'update:page': [value: number]
  'update:pageSize': [value: number]
  'page-change': []
  retry: []
  approve: [row: Order]
  reject: [row: Order]
  'add-to-payment': [row: Order]
}>()

const { isMobile } = useIsMobile()

// 首屏加载中（移动端展示骨架卡片）
const firstLoading = computed(() => props.loading && props.data.length === 0)

// 左滑审核：同一时刻只允许一张卡片展开
const openOrderId = ref<string | null>(null)

const handleSwipeOpen = (row: Order, open: boolean) => {
  if (open) {
    openOrderId.value = row.id
  } else if (openOrderId.value === row.id) {
    openOrderId.value = null
  }
}

// 审核入口复用父级原有逻辑（通过需确认、驳回需填写原因）
const handleAuditAction = (row: Order, action: 'approve' | 'reject') => {
  openOrderId.value = null
  if (action === 'approve') {
    emit('approve', row)
    return
  }
  emit('reject', row)
}

const closeSwipeActions = () => {
  openOrderId.value = null
}

// 点击展开卡片以外的区域时收起
const handleDocumentPointerDown = (event: PointerEvent) => {
  if (!openOrderId.value) return
  const target = event.target as HTMLElement | null
  const cell = target?.closest('[data-order-id]') as HTMLElement | null
  if (!cell || cell.dataset.orderId !== openOrderId.value) {
    openOrderId.value = null
  }
}

// 移动端翻页：更新页码后重新拉取，并回到列表顶部
const listRef = ref<HTMLElement | null>(null)

const handleMobilePageChange = (nextPage: number) => {
  emit('update:page', nextPage)
  emit('page-change')
  scrollListToTop()
}

// 移动端滚动容器是布局里的 .mobile-main，回到顶部避免翻页后停在半截
const scrollListToTop = () => {
  const scroller = listRef.value?.closest('.mobile-main')
  if (scroller) {
    scroller.scrollTo({ top: 0 })
    return
  }
  window.scrollTo({ top: 0 })
}

onUnmounted(() => {
  window.removeEventListener('scroll', closeSwipeActions, true)
  window.removeEventListener('pointerdown', handleDocumentPointerDown, true)
})

onMounted(() => {
  // 滚动（含列表容器）或点击外部时收起左滑操作
  window.addEventListener('scroll', closeSwipeActions, true)
  window.addEventListener('pointerdown', handleDocumentPointerDown, true)
})
</script>

<style lang="scss" scoped>
.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

/* ===== 移动端卡片列表 ===== */
.order-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 120px;
}

// 左滑容器与卡片共用圆角，滑出时操作区按圆角裁剪
.order-swipe-cell {
  border-radius: 12px;
}

.order-card {
  padding: 12px 14px;
  background-color: #ffffff;
  border: 1px solid #ebeef5;
  border-radius: 12px;

  .card-main {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .card-left {
    flex: 1;
    min-width: 0;
  }

  .card-title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: 0 0 6px;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
    color: #303133;
  }

  .card-title-text {
    min-width: 0;
    max-width: 100%;
    word-break: break-all;
  }

  .card-user {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    margin-bottom: 4px;
    font-size: 12px;
    line-height: 1.4;
    color: #909399;
  }

  .card-time {
    display: block;
    font-size: 12px;
    line-height: 1.4;
    color: #a8abb2;
  }

  .card-reject {
    display: block;
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.4;
    color: #f56c6c;
    word-break: break-all;
  }

  .card-settled {
    display: block;
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.4;
    color: #909399;
  }

  .card-right {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    max-width: 45%;
  }

  .card-price {
    font-size: 16px;
    font-weight: 600;
    line-height: 1.2;
    color: #303133;
    font-variant-numeric: tabular-nums;
    text-align: right;
    word-break: break-all;
  }
}

.card-empty {
  padding: 40px 0;
  font-size: 14px;
  color: #909399;
  text-align: center;
}

// 首屏加载失败反馈（移动端）
.load-feedback {
  padding: 32px 16px;
  text-align: center;
  background: #ffffff;
  border-radius: 12px;

  .load-feedback-text {
    margin-bottom: 12px;
    font-size: 14px;
    line-height: 20px;
    color: #909399;
  }

  &.is-inline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    background: #fef0f0;

    .load-feedback-text {
      margin-bottom: 0;
      font-size: 13px;
      color: #f56c6c;
      text-align: left;
    }
  }
}

// 移动端分页：居中、单行不换行，320px 下也不溢出
.pagination-container--mobile {
  justify-content: center;
  margin-top: 12px;
  padding-bottom: 4px;
  overflow: hidden;

  :deep(.el-pagination) {
    flex-wrap: nowrap;
    white-space: nowrap;
    column-gap: 2px;
  }

  :deep(.el-pagination__total) {
    margin-right: 2px;
    font-size: 12px;
  }

  // 收窄翻页按钮与页码间距，保证 320px 下「总条数 + 5 个页码位」单行放下
  :deep(.btn-prev),
  :deep(.btn-next) {
    margin-left: 0;
    margin-right: 0;
  }

  :deep(.el-pager li) {
    margin: 0 2px;
  }
}
</style>
