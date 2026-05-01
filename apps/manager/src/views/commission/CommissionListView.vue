<template>
  <div class="commission-list-page">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stat-cards">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">总订单</span>
              <el-statistic :value="stats.total" />
            </div>
            <el-icon class="stat-icon" style="color: #409eff; background: #ecf5ff;">
              <Document />
            </el-icon>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">待审核</span>
              <el-statistic :value="stats.pending" />
            </div>
            <el-icon class="stat-icon" style="color: #e6a23c; background: #fdf6ec;">
              <Clock />
            </el-icon>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">已通过</span>
              <el-statistic :value="stats.approved" />
            </div>
            <el-icon class="stat-icon" style="color: #67c23a; background: #f0f9eb;">
              <CircleCheck />
            </el-icon>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">已驳回</span>
              <el-statistic :value="stats.rejected" />
            </div>
            <el-icon class="stat-icon" style="color: #f56c6c; background: #fef0f0;">
              <CircleClose />
            </el-icon>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 筛选栏 -->
    <div class="search-bar">
      <el-select
        v-model="filterStatus"
        placeholder="订单状态"
        clearable
        style="width: 140px;"
        @change="fetchData"
      >
        <el-option label="全部" value="" />
        <el-option label="待审核" value="pending" />
        <el-option label="已通过" value="approved" />
        <el-option label="已驳回" value="rejected" />
      </el-select>
      <el-button icon="Refresh" @click="handleReset">重置</el-button>
    </div>

    <!-- 数据表格 -->
    <el-table
      v-loading="loading"
      :data="tableData"
      border
      stripe
      style="width: 100%;"
    >
      <el-table-column prop="productName" label="产品名称" min-width="180" show-overflow-tooltip />
      <el-table-column prop="userId" label="用户ID" width="180" show-overflow-tooltip />
      <el-table-column prop="productPrice" label="产品售价" width="100" align="right">
        <template #default="{ row }">
          <span style="font-weight: 500;">¥{{ row.productPrice }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)">
            {{ statusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="做单时间" width="170" align="center" />
      <el-table-column prop="rejectReason" label="驳回原因" width="140" show-overflow-tooltip>
        <template #default="{ row }">
          <span style="color: #f56c6c;">{{ row.rejectReason || '--' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" align="center" fixed="right">
        <template #default="{ row }">
          <div class="table-actions">
            <template v-if="row.status === 'pending'">
              <el-button type="success" text size="small" @click="handleApprove(row)">
                审核通过
              </el-button>
              <el-button type="danger" text size="small" @click="handleReject(row)">
                驳回
              </el-button>
            </template>
            <template v-else>
              <span style="color: #909399; font-size: 13px;">--</span>
            </template>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination-container">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @size-change="fetchData"
        @current-change="fetchData"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Clock, CircleCheck, CircleClose } from '@element-plus/icons-vue'
import { get, put } from '@promo/shared/utils/request'

// 加载状态
const loading = ref(false)

// 筛选状态
const filterStatus = ref('')

// 分页数据
const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

// 统计数据
const stats = reactive({
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0
})

// 表格数据
const tableData = ref<any[]>([])

// 获取当前经理 ID
const getManagerId = () => {
  try {
    const info = JSON.parse(localStorage.getItem('manager_info') || '{}')
    return info.id || ''
  } catch { return '' }
}

// 状态映射
const statusTagType = (status: string) => {
  const map: Record<string, string> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
  }
  return map[status] || 'info'
}

const statusText = (status: string) => {
  const map: Record<string, string> = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已驳回',
  }
  return map[status] || status
}

// 获取统计数据
const fetchStats = async () => {
  try {
    const res = await get<any>('/orders/stats', {
      managerId: getManagerId() || undefined,
    })
    if (res.data) {
      stats.total = res.data.total || 0
      stats.pending = res.data.pending || 0
      stats.approved = res.data.approved || 0
      stats.rejected = res.data.rejected || 0
    }
  } catch (error) {
    console.error('获取统计数据失败:', error)
  }
}

// 获取订单列表
const fetchData = async () => {
  loading.value = true
  try {
    const res = await get<any>('/orders', {
      page: pagination.page,
      pageSize: pagination.pageSize,
      managerId: getManagerId() || undefined,
      status: filterStatus.value || undefined,
    })
    if (res.data) {
      const { list, total } = res.data
      tableData.value = list || []
      pagination.total = total || 0
    }
  } catch (error: any) {
    ElMessage.error(error.message || '获取订单列表失败')
  } finally {
    loading.value = false
  }
}

// 重置筛选
const handleReset = () => {
  filterStatus.value = ''
  pagination.page = 1
  fetchData()
}

// 审核通过
const handleApprove = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要通过「${row.productName}」的做单申请吗？`,
      '审核确认',
      {
        confirmButtonText: '通过',
        cancelButtonText: '取消',
        type: 'success'
      }
    )
    await put(`/orders/${row.id}/review`, { action: 'approve' })
    ElMessage.success('审核通过')
    fetchStats()
    fetchData()
  } catch (error: any) {
    if (error !== 'cancel' && error?.message) {
      ElMessage.error(error.message || '操作失败')
    }
  }
}

// 驳回申请
const handleReject = async (row: any) => {
  try {
    const { value: reason } = await ElMessageBox.prompt(
      '请输入驳回原因',
      '驳回确认',
      {
        confirmButtonText: '确定驳回',
        cancelButtonText: '取消',
        type: 'warning',
        inputPlaceholder: '请输入驳回原因',
        inputValidator: (val) => {
          if (!val || !val.trim()) return '请输入驳回原因'
          return true
        }
      }
    )

    await put(`/orders/${row.id}/review`, { action: 'reject', reason })
    ElMessage.success('已驳回该申请')
    fetchStats()
    fetchData()
  } catch (error: any) {
    if (error !== 'cancel' && error?.message) {
      ElMessage.error(error.message || '操作失败')
    }
  }
}

onMounted(() => {
  fetchStats()
  fetchData()
})
</script>

<style lang="scss" scoped>
.commission-list-page {
  .stat-cards {
    margin-bottom: 20px;
  }

  .stat-card {
    margin-bottom: 16px;

    .stat-content {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .stat-info {
        .stat-label {
          display: block;
          font-size: 14px;
          color: #909399;
          margin-bottom: 8px;
        }
      }

      .stat-icon {
        width: 56px;
        height: 56px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
      }
    }
  }

  .pagination-container {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }
}
</style>
