<template>
  <!-- ===== 移动端：卡片列表 + 触底加载，替代横向滚动的多列表格 ===== -->
  <div
    v-if="isMobile"
    class="order-cards"
  >
    <!-- 首屏骨架：弱网下先给出结构，避免空白等待 -->
    <div
      v-if="firstLoading"
      class="order-skeletons"
    >
      <div
        v-for="i in 3"
        :key="`skeleton-${i}`"
        class="order-card is-skeleton"
      >
        <div
          class="skeleton-block"
          style="width: 45%; height: 16px;"
        />
        <div
          class="skeleton-block"
          style="width: 70%; height: 12px; margin-top: 12px;"
        />
        <div
          class="skeleton-block"
          style="width: 60%; height: 12px; margin-top: 8px;"
        />
        <div
          class="skeleton-block"
          style="width: 80%; height: 12px; margin-top: 8px;"
        />
      </div>
    </div>

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

    <article
      v-for="row in data"
      :key="row.id"
      class="order-card"
    >
      <div class="card-head">
        <span class="card-title">{{ row.productName }}</span>
        <el-tag
          :type="statusTagType(row.status)"
          size="small"
        >
          {{ statusText(row.status) }}
        </el-tag>
      </div>

      <div
        v-if="row.optionLabel || row.fundAccount || row.duplicate"
        class="card-tags"
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
        <el-tag
          v-if="row.duplicate"
          size="small"
          type="warning"
        >
          重单
        </el-tag>
      </div>

      <dl class="card-rows">
        <div class="card-row">
          <dt>用户</dt>
          <dd>{{ row.userName || '--' }}</dd>
        </div>
        <div class="card-row">
          <dt>手机号</dt>
          <dd>{{ maskPhone(row.userPhone) }}</dd>
        </div>
        <div class="card-row">
          <dt>推广费</dt>
          <dd class="card-price">
            {{ displayProductPrice(row) }}
          </dd>
        </div>
        <div class="card-row">
          <dt>做单时间</dt>
          <dd>{{ formatTime(row.createdAt) }}</dd>
        </div>
        <div class="card-row">
          <dt>审核结果</dt>
          <dd :class="{ 'is-danger': row.status === 'rejected' }">
            {{ auditResultText(row) }}
          </dd>
        </div>
        <div class="card-row">
          <dt>发放日期</dt>
          <dd>{{ row.settledAt ? formatTime(row.settledAt) : '--' }}</dd>
        </div>
      </dl>

      <div
        v-if="row.status === 'pending'"
        class="card-actions"
      >
        <el-button
          class="card-btn"
          @click="emit('reject', row)"
        >
          驳回
        </el-button>
        <el-button
          class="card-btn"
          type="success"
          @click="emit('approve', row)"
        >
          审核通过
        </el-button>
      </div>
      <div
        v-else-if="row.status === 'approved'"
        class="card-actions"
      >
        <el-button
          class="card-btn"
          type="primary"
          @click="emit('add-to-payment', row)"
        >
          添加到待发放
        </el-button>
      </div>
    </article>

    <p
      v-if="!loading && !loadError && data.length === 0"
      class="card-empty"
    >
      {{ onlyDuplicate ? '当前筛选条件下没有重单' : '暂无数据' }}
    </p>

    <div
      v-if="data.length > 0"
      ref="loadMoreSentinel"
      class="load-more"
    >
      <el-button
        v-if="hasMore"
        class="load-more-btn"
        :loading="loading"
        @click="emit('load-more')"
      >
        加载更多
      </el-button>
      <span
        v-else
        class="load-more-end"
      >没有更多了</span>
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
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { maskPhone, formatTime, statusTagType, statusText, displayProductPrice, auditResultText } from '../utils'
import { useIsMobile } from '@/composables/useIsMobile'
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
  'load-more': []
  retry: []
  approve: [row: Order]
  reject: [row: Order]
  'add-to-payment': [row: Order]
}>()

const { isMobile } = useIsMobile()

// 首屏加载中（移动端展示骨架卡片）
const firstLoading = computed(() => props.loading && props.data.length === 0)

// 加载更多哨兵：进入视口即自动加载下一页，按钮同时保留用于手动触发
const loadMoreSentinel = ref<HTMLElement | null>(null)
// 防止同一时刻重复触发
const pendingLoad = ref(false)
// 自动加载拿不到新数据时停用（弱网/失败），按钮仍可手动重试，避免无限请求
const autoLoadStopped = ref(false)
let lengthBeforeLoad = 0
let observer: IntersectionObserver | null = null

// 移动端累加加载：已加载条数小于总数时仍有下一页
const hasMore = computed(() => props.data.length < props.total)

const maybeLoadMore = () => {
  const sentinel = loadMoreSentinel.value
  if (!sentinel || !isMobile.value || props.loading || pendingLoad.value || autoLoadStopped.value) return
  if (!hasMore.value) return
  const rect = sentinel.getBoundingClientRect()
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight
  if (rect.top <= viewportHeight + 120) {
    pendingLoad.value = true
    emit('load-more')
  }
}

watch(loadMoreSentinel, (element) => {
  observer?.disconnect()
  observer = null
  if (!element) return
  if (typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) maybeLoadMore()
    },
    { rootMargin: '120px 0px' }
  )
  observer.observe(element)
})

// 一次加载结束后重置标记；若内容仍不足一屏则继续补齐
watch(
  () => props.loading,
  (loading) => {
    if (loading) {
      lengthBeforeLoad = props.data.length
      return
    }
    if (pendingLoad.value && props.data.length <= lengthBeforeLoad) {
      autoLoadStopped.value = true
    }
    pendingLoad.value = false
    nextTick(maybeLoadMore)
  }
)

// 列表被重置（筛选/刷新）后恢复自动加载
watch(
  () => props.data.length,
  (length, previous) => {
    if (previous !== undefined && length < previous) autoLoadStopped.value = false
  }
)

onUnmounted(() => observer?.disconnect())
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
  gap: 12px;
  min-height: 120px;
}

.order-card {
  padding: 12px 14px;
  background-color: #ffffff;
  border: 1px solid #ebeef5;
  border-radius: 12px;

  .card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .card-title {
    flex: 1;
    min-width: 0;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
    color: #303133;
    word-break: break-all;
  }

  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
}

.card-rows {
  margin-top: 10px;

  .card-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 3px 0;
    font-size: 13px;

    dt {
      flex: none;
      color: #909399;
    }

    dd {
      flex: 1;
      min-width: 0;
      color: #303133;
      text-align: right;
      word-break: break-all;

      &.is-danger {
        color: #f56c6c;
      }
    }
  }

  .card-price {
    font-size: 15px;
    font-weight: 600;
    color: #409eff;
  }
}

.card-actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f2f5;

  .card-btn {
    flex: 1;
    min-height: 44px;
    margin-left: 0;
  }
}

.card-empty {
  padding: 40px 0;
  font-size: 14px;
  color: #909399;
  text-align: center;
}

// 首屏骨架与加载失败反馈（移动端）
.order-skeletons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skeleton-block {
  border-radius: 6px;
  background: linear-gradient(90deg, #f2f3f5 25%, #e6e8eb 37%, #f2f3f5 63%);
  background-size: 400% 100%;
  animation: order-skeleton-loading 1.4s ease infinite;
}

.order-card.is-skeleton {
  min-height: 132px;
}

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

@keyframes order-skeleton-loading {
  0% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0 50%;
  }
}

.load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0 4px;

  .load-more-btn {
    min-width: 160px;
    min-height: 44px;
  }

  .load-more-end {
    font-size: 12px;
    color: #c0c4cc;
  }
}
</style>
