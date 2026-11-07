<template>
  <div class="operation-log">
    <el-card class="search-card">
      <div class="search-form">
        <el-form
          :inline="true"
          :model="searchForm"
          class="search-form-inline"
        >
          <el-form-item label="操作类型">
            <el-select
              v-model="searchForm.operationType"
              placeholder="请选择操作类型"
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
              placeholder="请选择目标类型"
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
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              @click="fetchLogs"
            >
              查询
            </el-button>
            <el-button @click="resetForm">
              重置
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
            width="180"
          >
            <template #default="{ row }">
              {{ formatTime(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column
            prop="adminName"
            label="操作人"
            width="120"
          />
          <el-table-column
            prop="adminPhone"
            label="操作人手机号"
            width="140"
          />
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
            prop="targetType"
            label="目标类型"
            width="100"
          >
            <template #default="{ row }">
              <span>{{ targetTypeLabels[row.targetType] || row.targetType }}</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="targetName"
            label="目标名称"
            width="200"
          />
          <el-table-column
            prop="reason"
            label="操作原因"
            width="200"
            show-overflow-tooltip
          />
          <el-table-column
            prop="detail"
            label="详细信息"
            width="200"
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
          @size-change="fetchLogs"
          @current-change="fetchLogs"
        />
      </div>
    </el-card>

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      title="操作详情"
      width="600px"
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
          <span class="detail-value">{{ currentLog.adminName }} ({{ currentLog.adminPhone }})</span>
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
          <span class="detail-value">{{ currentLog.targetId }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">目标名称：</span>
          <span class="detail-value">{{ currentLog.targetName }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">操作原因：</span>
          <span class="detail-value">{{ currentLog.reason || '-' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">详细信息：</span>
          <pre class="detail-json">{{ formatDetail(currentLog.detail) }}</pre>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { get } from '@promo/shared/utils/request'
import { formatDate } from '@promo/shared/utils/helpers'
import { getErrorMessage } from '@promo/shared/utils/errors'

const loading = ref(false)
const tableData = ref<OperationLogRow[]>([])
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })
const searchForm = reactive({ operationType: '', targetType: '', adminId: '' })
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
}

const fetchLogs = async () => {
  loading.value = true
  try {
    const params: {
      page: number
      pageSize: number
      operationType?: string
      targetType?: string
      adminId?: string
    } = {
      page: pagination.page,
      pageSize: pagination.pageSize,
    }
    if (searchForm.operationType) params.operationType = searchForm.operationType
    if (searchForm.targetType) params.targetType = searchForm.targetType
    if (searchForm.adminId) params.adminId = searchForm.adminId

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

const resetForm = () => {
  searchForm.operationType = ''
  searchForm.targetType = ''
  searchForm.adminId = ''
  pagination.page = 1
  fetchLogs()
}

const showDetail = (row: OperationLogRow) => {
  currentLog.value = row
  detailVisible.value = true
}

// 格式化时间（shared 统一北京时区实现，秒级）
const formatTime = (time?: string) => (time ? formatDate(time) : '-')

const formatDetail = (detail?: string) => {
  if (!detail) return '-'
  try {
    const obj = JSON.parse(detail)
    return JSON.stringify(obj, null, 2)
  } catch {
    return detail
  }
}

fetchLogs()
</script>

<style lang="scss" scoped>
.operation-log {
  .search-card { margin-bottom: 16px; }
  .search-form { display: flex; gap: 16px; }
  .pagination-container { display: flex; justify-content: flex-end; margin-top: 16px; }
  
  .detail-content {
    padding: 12px;
    .detail-row {
      display: flex;
      padding: 8px 0;
      border-bottom: 1px solid #ebeef5;
      &:last-child { border-bottom: none; }
      .detail-label {
        width: 120px;
        font-weight: 500;
        color: #606266;
        flex-shrink: 0;
      }
      .detail-value { flex: 1; color: #303133; word-break: break-all; }
      .detail-json {
        flex: 1;
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

      :deep(.el-select) {
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

        .detail-json {
          font-size: 11px;
          padding: 10px;
        }
      }
    }
  }
}
</style>