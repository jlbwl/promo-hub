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
        <span>共 <strong>{{ filteredOrders.length }}</strong> 条记录</span>
        <div class="payment-summary-right">
          <span
            v-if="currentStatus !== 'rejected'"
            class="payment-total"
          >合计佣金：<strong>{{ total }}</strong></span>
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
                v-for="col in visibleColumnOptions"
                :key="col.key"
                v-model="visibleColumns[col.key]"
              >
                {{ col.label }}
              </el-checkbox>
            </div>
          </el-popover>
        </div>
      </div>
      <div class="detail-filters">
        <span class="filter-label">渠道名称</span>
        <el-select
          v-model="filters.managerId"
          size="small"
          clearable
          placeholder="全部渠道"
          style="width: 150px;"
        >
          <el-option
            v-for="opt in channelOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <span class="filter-label">团队名称</span>
        <el-select
          v-model="filters.teamName"
          size="small"
          clearable
          placeholder="全部团队"
          style="width: 150px;"
        >
          <el-option
            v-for="name in teamOptions"
            :key="name"
            :label="name"
            :value="name"
          />
        </el-select>
        <span
          v-if="currentStatus !== 'rejected'"
          class="filter-label"
        >{{ isMergedView ? '结算/审核时间' : '结算时间' }}</span>
        <el-date-picker
          v-if="currentStatus !== 'rejected'"
          v-model="filters.dateRange"
          type="daterange"
          size="small"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 240px;"
        />
        <el-button
          size="small"
          text
          @click="resetFilters"
        >
          重置
        </el-button>
      </div>
      <el-table
        :data="filteredOrders"
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
          v-if="visibleColumns.productPrice && currentStatus !== 'rejected'"
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
          v-if="visibleColumns.settledAt && currentStatus !== 'rejected'"
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
          v-if="visibleColumns.reviewedAt && (currentStatus === 'rejected' || isMergedView)"
          prop="reviewedAt"
          label="审核时间"
          width="130"
          align="center"
        >
          <template #default="{ row }">
            <span>{{ row.reviewedAt ? formatTime(row.reviewedAt) : '--' }}</span>
          </template>
        </el-table-column>
        <el-table-column
          v-if="visibleColumns.auditResult"
          label="审核结果"
          min-width="120"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span :style="row.status === 'rejected' ? 'color: #f56c6c;' : ''">{{ auditResultText(row) }}</span>
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
import { maskPhone, formatTime, getManagerTeamName, displayProductPrice, sumDisplayProductPrice, auditResultText } from '../utils'
import type { Manager, Order, PaginatedResponse } from '@promo/shared/types'

const props = defineProps<{
  managers: Manager[]
}>()

const visible = ref(false)
const title = ref('')
const orders = ref<Order[]>([])
// 当前弹窗对应的订单状态（用于区分审核结果/驳回理由列）
const currentStatus = ref('')
// 多状态合并视图（如已发放并入已驳回）
const isMergedView = computed(() => currentStatus.value.includes(','))

// 明细筛选条件：渠道（按 managerId）、团队名称、结算日期区间
const filters = reactive<{ managerId: string; teamName: string; dateRange: string[] | null }>({
  managerId: '',
  teamName: '',
  dateRange: null,
})

// 渠道下拉选项（渠道名称由经理信息推导，按 managerId 去重）
const channelOptions = computed(() => {
  const map = new Map<string, string>()
  orders.value.forEach(o => {
    if (o.managerId && !map.has(o.managerId)) map.set(o.managerId, getManagerTeamName(props.managers, o.managerId))
  })
  return [...map.entries()].map(([value, label]) => ({ value, label }))
})

// 团队名称下拉选项（订单内出现的团队去重）
const teamOptions = computed(() => [...new Set(orders.value.map(o => o.teamName).filter((n): n is string => !!n))])

const filteredOrders = computed(() => orders.value.filter(o => {
  if (filters.managerId && o.managerId !== filters.managerId) return false
  if (filters.teamName && o.teamName !== filters.teamName) return false
  if (filters.dateRange?.length === 2) {
    // 合并视图下驳回单没有结算时间，回退到审核时间，避免误筛掉驳回单
    const time = isMergedView.value ? (o.settledAt || o.reviewedAt) : o.settledAt
    if (!time) return false
    // 时间为 YYYY-MM-DD HH:mm:ss，取日期部分做闭区间比较
    const day = String(time).slice(0, 10)
    if (day < filters.dateRange[0] || day > filters.dateRange[1]) return false
  }
  return true
}))

// 合计口径：驳回单推广费按 0 计，避免并入已发放后金额变大
const total = computed(() => sumDisplayProductPrice(filteredOrders.value).toFixed(2))

// 清空筛选条件
const resetFilters = () => {
  filters.managerId = ''
  filters.teamName = ''
  filters.dateRange = null
}

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
  { key: 'reviewedAt', label: '审核时间' },
  { key: 'auditResult', label: '审核结果' },
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
  reviewedAt: true,
  auditResult: true,
})

// 列设置项随弹窗类型变化：
// 驳回明细不含推广费/结算时间，改为审核时间 + 审核结果（驳回单直接显示原因）；
// 已发放合并视图同时展示结算时间、审核时间与审核结果，便于识别驳回单
const visibleColumnOptions = computed(() => columnOptions.filter(col => {
  if (col.key === 'productPrice' || col.key === 'settledAt') {
    return currentStatus.value !== 'rejected'
  }
  if (col.key === 'reviewedAt') {
    return currentStatus.value === 'rejected' || isMergedView.value
  }
  return true
}))

// 根据经理 ID 获取渠道名称
const teamNameOf = (managerId: string) => getManagerTeamName(props.managers, managerId)

// 打开统计明细弹窗（status 为 'all' 时查询全部，支持逗号分隔的多状态合并）
const open = async (status: string, t: string) => {
  title.value = t + '明细'
  currentStatus.value = status
  resetFilters()
  visible.value = true
  const statuses = status && status !== 'all' ? status.split(',') : []
  try {
    // H16：后端 pageSize 上限为 100，改为循环分页拉全量，避免明细截断导致合计失真
    const PAGE_SIZE = 100
    const fetchByStatus = async (item: string) => {
      const params: { status?: string } = {}
      if (item) params.status = item
      const first = await get<PaginatedResponse<Order>>('/orders', { ...params, page: 1, pageSize: PAGE_SIZE })
      const collected: Order[] = [...(first.data?.list || [])]
      const total = first.data?.total ?? collected.length
      const totalPages = first.data?.totalPages || Math.ceil(total / PAGE_SIZE)
      for (let page = 2; page <= totalPages; page++) {
        const res = await get<PaginatedResponse<Order>>('/orders', { ...params, page, pageSize: PAGE_SIZE })
        collected.push(...(res.data?.list || []))
      }
      return collected
    }
    const results = await Promise.all((statuses.length > 0 ? statuses : ['']).map(fetchByStatus))
    let collected = results.flat()
    // 多状态合并展示时按审核时间倒序，便于按天回看审核结果
    if (statuses.length > 1) {
      collected = [...collected].sort((a, b) => (b.reviewedAt || '').localeCompare(a.reviewedAt || ''))
    }
    orders.value = collected
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
.detail-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 12px;
  .filter-label { font-size: 13px; color: #606266; }
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
