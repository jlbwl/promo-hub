<template>
  <div class="operation-log">
    <el-card class="search-card">
      <div class="search-form">
        <el-form
          :inline="true"
          :model="searchForm"
          class="search-form-inline"
        >
          <el-form-item label="时间范围">
            <el-date-picker
              v-model="searchForm.dateRange"
              type="daterange"
              value-format="YYYY-MM-DD"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              unlink-panels
              clearable
            />
          </el-form-item>
          <el-form-item label="操作类型">
            <el-select
              v-model="searchForm.operationType"
              placeholder="全部"
            >
              <el-option
                label="全部"
                value=""
              />
              <el-option
                label="创建"
                value="create"
              />
              <el-option
                label="更新"
                value="update"
              />
              <el-option
                label="删除"
                value="delete"
              />
              <el-option
                label="下架"
                value="offline"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="目标类型">
            <el-select
              v-model="searchForm.targetType"
              placeholder="全部"
            >
              <el-option
                label="全部"
                value=""
              />
              <el-option
                label="订单"
                value="order"
              />
              <el-option
                label="产品"
                value="product"
              />
              <el-option
                label="用户"
                value="user"
              />
              <el-option
                label="渠道经理"
                value="manager"
              />
              <el-option
                label="分类"
                value="category"
              />
              <el-option
                label="二维码"
                value="qrcode"
              />
              <el-option
                label="管理员"
                value="admin"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="操作人">
            <el-select
              v-model="searchForm.adminId"
              placeholder="全部"
              clearable
            >
              <el-option
                v-for="item in adminOptions"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="关键字">
            <el-input
              v-model="searchForm.keyword"
              placeholder="目标名称 / 目标ID"
              clearable
              @keyup.enter="handleSearch"
            />
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              @click="handleSearch"
            >
              查询
            </el-button>
            <el-button @click="resetForm">
              重置
            </el-button>
            <el-button
              :loading="exporting"
              @click="handleExport"
            >
              导出 CSV
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </el-card>

    <el-card>
      <div class="table-scroll">
        <el-table
          v-loading="loading"
          :data="tableData"
          border
          size="small"
          max-height="500"
        >
          <el-table-column
            prop="createdAt"
            label="操作时间"
            width="170"
          >
            <template #default="{ row }">
              {{ formatTime(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column
            prop="operationType"
            label="操作类型"
            width="100"
          >
            <template #default="{ row }">
              <el-tag
                v-if="row.operationType === 'delete'"
                type="danger"
              >
                删除
              </el-tag>
              <el-tag
                v-else-if="row.operationType === 'offline'"
                type="warning"
              >
                下架
              </el-tag>
              <span v-else>{{ operationTypeLabels[row.operationType] || row.operationType }}</span>
            </template>
          </el-table-column>
          <el-table-column
            label="操作对象"
            min-width="280"
          >
            <template #default="{ row }">
              <div class="target-cell">
                <div class="target-main">
                  <span class="target-type">{{ targetTypeLabels[row.targetType] || row.targetType }}</span>
                  <button
                    v-if="canJump(row)"
                    type="button"
                    class="target-link"
                    :title="`前往${targetModuleLabel(row.targetType)}`"
                    @click="jumpToTarget(row)"
                  >
                    {{ row.targetName || row.targetId }}
                  </button>
                  <span
                    v-else
                    class="target-name"
                  >{{ row.targetName || '-' }}</span>
                </div>
                <div
                  v-if="row.targetId"
                  class="target-id"
                  :title="row.targetId"
                >
                  {{ shortenId(row.targetId) }}
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column
            prop="adminName"
            label="操作人"
            width="120"
          />
          <el-table-column
            prop="reason"
            label="操作原因"
            min-width="160"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.reason || '-' }}
            </template>
          </el-table-column>
          <el-table-column
            label="详情"
            width="90"
          >
            <template #default="{ row }">
              <el-button
                link
                type="primary"
                @click="showDetail(row)"
              >
                查看详情
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next"
          background
          @size-change="handleSearch"
          @current-change="fetchLogs"
        />
      </div>
    </el-card>

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      title="操作详情"
      width="640px"
    >
      <div
        v-if="currentLog"
        class="detail-content"
      >
        <div class="detail-row">
          <span class="detail-label">操作时间：</span>
          <span class="detail-value">{{ formatTime(currentLog.createdAt) }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">操作人：</span>
          <span class="detail-value">
            {{ currentLog.adminName || '-' }}
            <template v-if="currentLog.adminPhone">（{{ currentLog.adminPhone }}）</template>
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">操作类型：</span>
          <span class="detail-value">{{ operationTypeLabels[currentLog.operationType] || currentLog.operationType }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">目标类型：</span>
          <span class="detail-value">{{ targetTypeLabels[currentLog.targetType] || currentLog.targetType }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">目标ID：</span>
          <span class="detail-value detail-id">
            <span class="detail-id-text">{{ currentLog.targetId || '-' }}</span>
            <el-button
              v-if="currentLog.targetId"
              link
              type="primary"
              size="small"
              @click="copyText(currentLog.targetId)"
            >
              复制
            </el-button>
            <el-button
              v-if="canJump(currentLog)"
              link
              type="primary"
              size="small"
              @click="jumpToTarget(currentLog)"
            >
              前往{{ targetModuleLabel(currentLog.targetType) }}
            </el-button>
          </span>
        </div>
        <div
          v-if="currentLog.targetId && !canJump(currentLog)"
          class="detail-row"
        >
          <span class="detail-label" />
          <span class="detail-hint">目标已删除或无对应管理页面，暂不支持跳转，仅可复制 ID</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">目标名称：</span>
          <span class="detail-value">{{ currentLog.targetName || '-' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">操作原因：</span>
          <span class="detail-value">{{ currentLog.reason || '-' }}</span>
        </div>

        <div class="detail-section-title">
          详情内容
        </div>
        <div class="detail-block">
          <p class="detail-summary">
            {{ displaySummary }}
          </p>
          <el-table
            v-if="detailView.changes.length"
            :data="detailView.changes"
            border
            size="small"
            class="change-table"
          >
            <el-table-column
              prop="label"
              label="字段"
              width="140"
            />
            <el-table-column
              prop="from"
              label="原值"
            />
            <el-table-column
              prop="to"
              label="新值"
            />
          </el-table>
          <div
            v-if="detailView.meta.length"
            class="meta-list"
          >
            <div
              v-for="item in detailView.meta"
              :key="item.key"
              class="meta-row"
            >
              <span class="meta-label">{{ item.label }}</span>
              <span class="meta-value">{{ item.value }}</span>
            </div>
          </div>
        </div>

        <el-collapse
          v-if="detailView.isJson"
          class="raw-json"
        >
          <el-collapse-item
            title="原始 JSON"
            name="raw"
          >
            <pre class="detail-json">{{ detailView.raw }}</pre>
          </el-collapse-item>
        </el-collapse>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { get, getBlob } from '@promo/shared/utils/request'
import { formatDate } from '@promo/shared/utils/helpers'
import { getErrorMessage } from '@promo/shared/utils/errors'

const router = useRouter()
const loading = ref(false)
const exporting = ref(false)
const tableData = ref<OperationLogRow[]>([])
const adminOptions = ref<AdminOption[]>([])
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })
const searchForm = reactive({
  dateRange: defaultDateRange() as [string, string] | null,
  operationType: '',
  targetType: '',
  adminId: '',
  keyword: '',
})
const detailVisible = ref(false)
const currentLog = ref<OperationLogRow | null>(null)

// /admin/operation-logs 列表项结构
interface OperationLogRow {
  id?: string
  createdAt: string
  adminName: string
  adminPhone: string
  operationType: string
  targetType: string
  targetId?: string
  targetName: string
  reason?: string
  detail?: string
}

interface AdminOption {
  id: string
  name: string
  phone: string
}

// 操作类型与目标类型展示文案
const operationTypeLabels: Record<string, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
  offline: '下架',
}
const targetTypeLabels: Record<string, string> = {
  order: '订单',
  product: '产品',
  user: '用户',
  manager: '渠道经理',
  category: '分类',
  qrcode: '二维码',
  admin: '管理员',
}

// 仅映射到管理端真实存在的模块路由；产品/管理员没有管理页面，不提供跳转
const targetModuleRoutes: Record<string, { path: string; label: string }> = {
  order: { path: '/commissions', label: '佣金管理' },
  user: { path: '/users', label: '团队管理' },
  manager: { path: '/managers', label: '渠道管理' },
  category: { path: '/categories', label: '分类管理' },
  // 二维码的生成与保存入口在分类管理页
  qrcode: { path: '/categories', label: '分类管理' },
}

// 目标已删除（删除日志）或类型没有对应页面时不可跳转，避免死链
const canJump = (row: OperationLogRow | null): boolean =>
  !!row && !!row.targetId && row.operationType !== 'delete' && !!targetModuleRoutes[row.targetType]

const targetModuleLabel = (targetType: string): string => targetModuleRoutes[targetType]?.label || ''

const jumpToTarget = (row: OperationLogRow | null) => {
  if (!canJump(row) || !row) return
  router.push(targetModuleRoutes[row.targetType].path)
}

// 默认展示最近 30 天（含今天）
function toYmd(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function defaultDateRange(): [string, string] {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 29)
  return [toYmd(start), toYmd(end)]
}

// 当前筛选条件（列表与导出共用，保证导出结果与页面一致）
const buildFilterParams = () => {
  const params: {
    operationType?: string
    targetType?: string
    adminId?: string
    startTime?: string
    endTime?: string
    keyword?: string
  } = {}
  if (searchForm.dateRange?.[0]) params.startTime = searchForm.dateRange[0]
  if (searchForm.dateRange?.[1]) params.endTime = searchForm.dateRange[1]
  if (searchForm.operationType) params.operationType = searchForm.operationType
  if (searchForm.targetType) params.targetType = searchForm.targetType
  if (searchForm.adminId) params.adminId = searchForm.adminId
  if (searchForm.keyword.trim()) params.keyword = searchForm.keyword.trim()
  return params
}

const fetchLogs = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      ...buildFilterParams(),
    }

    const res = await get<{ list: OperationLogRow[]; total: number }>('/admin/operation-logs', params)
    if (res.code === 0) {
      tableData.value = res.data?.list || []
      pagination.total = res.data?.total || 0
    }
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '获取日志失败'))
  } finally {
    loading.value = false
  }
}

// 导出 CSV：后端分页拉取并流式写出，前端只负责触发下载
const handleExport = async () => {
  if (exporting.value) return
  exporting.value = true
  try {
    const blob = await getBlob('/admin/operation-logs/export', buildFilterParams())
    if (!blob || blob.size === 0) {
      ElMessage.warning('没有可导出的数据')
      return
    }
    const now = new Date()
    const stamp = `${toYmd(now).replace(/-/g, '')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `操作日志_${stamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 0)
    ElMessage.success('导出已开始')
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '导出失败'))
  } finally {
    exporting.value = false
  }
}

// 操作人筛选项：只包含日志中出现过的管理员，加载失败不阻塞列表
const loadAdminOptions = async () => {
  try {
    const res = await get<AdminOption[]>('/admin/operation-logs/admins')
    if (res.code === 0) {
      adminOptions.value = res.data || []
    }
  } catch {
    adminOptions.value = []
  }
}

const handleSearch = () => {
  pagination.page = 1
  fetchLogs()
}

const resetForm = () => {
  searchForm.dateRange = defaultDateRange()
  searchForm.operationType = ''
  searchForm.targetType = ''
  searchForm.adminId = ''
  searchForm.keyword = ''
  pagination.page = 1
  fetchLogs()
}

const showDetail = (row: OperationLogRow) => {
  currentLog.value = row
  detailVisible.value = true
}

// 格式化时间（shared 统一北京时区实现，秒级）
const formatTime = (time?: string) => (time ? formatDate(time) : '-')

// 长 ID 在表格中做省略，完整值在详情与悬浮提示中展示
const shortenId = (id?: string) => {
  if (!id) return ''
  return id.length > 16 ? `${id.slice(0, 10)}…${id.slice(-4)}` : id
}

const copyText = async (text?: string) => {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败，请手动选择复制')
  }
}

interface DetailChangeRow {
  key: string
  label: string
  from: string
  to: string
}

interface DetailMetaRow {
  key: string
  label: string
  value: string
}

interface DetailView {
  summary: string
  changes: DetailChangeRow[]
  meta: DetailMetaRow[]
  isJson: boolean
  raw: string
}

// 历史日志可能存有完整手机号，展示层统一兜底脱敏（11 位号码保留前 3 后 4）
const maskPhones = (text: string): string =>
  text.replace(/\b1[3-9]\d{9}\b/g, (phone) => `${phone.slice(0, 3)}****${phone.slice(-4)}`)

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'object') return maskPhones(JSON.stringify(value))
  return maskPhones(String(value))
}

// detail 约定为 { summary?, changes?, meta? } 的 JSON；解析失败时按历史自由文本展示
const detailView = computed<DetailView>(() => {
  const empty: DetailView = { summary: '', changes: [], meta: [], isJson: false, raw: '' }
  const raw = currentLog.value?.detail || ''
  if (!raw) return empty

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ...empty, summary: maskPhones(raw) }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ...empty, summary: maskPhones(raw) }
  }

  const obj = parsed as { summary?: unknown; changes?: unknown; meta?: unknown }
  const changes = Array.isArray(obj.changes)
    ? obj.changes.map((item, index) => {
        const entry = (item || {}) as { field?: unknown; label?: unknown; from?: unknown; to?: unknown }
        return {
          key: `change-${index}`,
          label: String(entry.label ?? entry.field ?? `字段${index + 1}`),
          from: formatValue(entry.from),
          to: formatValue(entry.to),
        }
      })
    : []
  const meta = obj.meta && typeof obj.meta === 'object' && !Array.isArray(obj.meta)
    ? Object.entries(obj.meta as Record<string, unknown>).map(([key, value]) => ({
        key,
        label: key,
        value: formatValue(value),
      }))
    : []

  return {
    summary: typeof obj.summary === 'string' ? maskPhones(obj.summary) : '',
    changes,
    meta,
    isJson: true,
    raw: maskPhones(JSON.stringify(parsed, null, 2)),
  }
})

// 无 detail 或结构中没有 summary 时，用已有字段拼出可读摘要，避免展示「-」
const fallbackSummary = computed(() => {
  if (!currentLog.value) return '-'
  const operation = operationTypeLabels[currentLog.value.operationType] || currentLog.value.operationType
  const targetType = targetTypeLabels[currentLog.value.targetType] || currentLog.value.targetType
  const target = currentLog.value.targetName || currentLog.value.targetId || '-'
  const reason = currentLog.value.reason ? `，原因：${currentLog.value.reason}` : ''
  return `${formatTime(currentLog.value.createdAt)}，${currentLog.value.adminName || '未知管理员'} 对${targetType}「${target}」执行了${operation}操作${reason}。`
})

const displaySummary = computed(() => detailView.value.summary || fallbackSummary.value)

fetchLogs()
loadAdminOptions()
</script>

<style lang="scss" scoped>
.operation-log {
  .search-card { margin-bottom: 16px; }
  .search-form {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 16px;
  }
  .pagination-container { display: flex; justify-content: flex-end; margin-top: 16px; }

  .target-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    .target-main {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      .target-type {
        flex-shrink: 0;
        color: #909399;
        font-size: 12px;
      }
      .target-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .target-link {
        flex: 1;
        min-width: 0;
        padding: 0;
        border: none;
        background: none;
        color: #409eff;
        font: inherit;
        text-align: left;
        cursor: pointer;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        &:hover { text-decoration: underline; }
      }
    }
    .target-id {
      color: #a8abb2;
      font-size: 12px;
      font-family: monospace;
    }
  }

  .detail-content {
    padding: 4px 12px 12px;
    .detail-row {
      display: flex;
      padding: 8px 0;
      border-bottom: 1px solid #ebeef5;
      &:last-of-type { border-bottom: none; }
      .detail-label {
        width: 110px;
        font-weight: 500;
        color: #606266;
        flex-shrink: 0;
      }
      .detail-value { flex: 1; color: #303133; word-break: break-all; }
      .detail-hint { flex: 1; color: #909399; font-size: 12px; }
      .detail-id {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;
        .detail-id-text { font-family: monospace; }
      }
    }

    .detail-section-title {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #ebeef5;
      font-weight: 500;
      color: #606266;
    }

    .detail-block {
      margin-top: 8px;
      .detail-summary {
        margin: 0 0 8px;
        padding: 10px 12px;
        background: #f5f7fa;
        border-radius: 6px;
        color: #303133;
        line-height: 1.6;
      }
      .meta-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        .meta-row {
          display: flex;
          gap: 12px;
          padding: 4px 0;
          border-bottom: 1px dashed #ebeef5;
          &:last-child { border-bottom: none; }
          .meta-label {
            width: 110px;
            flex-shrink: 0;
            color: #909399;
          }
          .meta-value { flex: 1; word-break: break-all; }
        }
      }
    }

    .raw-json {
      margin-top: 12px;
      :deep(.el-collapse-item__header) {
        font-size: 13px;
        color: #909399;
      }
    }

    .detail-json {
      margin: 0;
      background: #f5f7fa;
      padding: 12px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      color: #606266;
      max-height: 300px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }
  }

  :deep(.el-table) {
    min-width: 768px;
  }
}

@media (max-width: 768px) {
  .operation-log {
    .search-card {
      :deep(.el-card__body) {
        padding: 12px;
      }
    }

    .search-form {
      flex-direction: column;
      gap: 12px;

      :deep(.el-form-item) {
        margin-bottom: 0;
      }

      :deep(.el-select),
      :deep(.el-date-editor),
      :deep(.el-input) {
        width: 100%;
      }
    }

    :deep(.el-table) {
      font-size: 12px;
    }

    :deep(.el-table th) {
      font-size: 12px;
      padding: 8px 4px;
    }

    :deep(.el-table td) {
      padding: 8px 4px;
    }

    :deep(.el-dialog) {
      width: 95% !important;
    }

    .pagination-container {
      justify-content: center;
    }

    .detail-content {
      .detail-row {
        flex-direction: column;
        gap: 4px;

        .detail-label {
          width: 100%;
          font-size: 13px;
        }

        .detail-value {
          font-size: 13px;
        }
      }

      .detail-block {
        .meta-list .meta-row {
          flex-direction: column;
          gap: 2px;
          .meta-label { width: 100%; }
        }
      }

      .detail-json {
        font-size: 11px;
        padding: 10px;
      }
    }
  }
}
</style>
