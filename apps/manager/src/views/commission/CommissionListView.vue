<template>
  <div class="commission-list-page">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stat-cards">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">总佣金</span>
              <el-statistic :value="stats.total" prefix="¥" />
            </div>
            <el-icon class="stat-icon" style="color: #409eff; background: #ecf5ff;">
              <Money />
            </el-icon>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">待审核</span>
              <el-statistic :value="stats.pending" prefix="¥" />
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
              <el-statistic :value="stats.approved" prefix="¥" />
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
              <span class="stat-label">已发放</span>
              <el-statistic :value="stats.paid" prefix="¥" />
            </div>
            <el-icon class="stat-icon" style="color: #f56c6c; background: #fef0f0;">
              <Wallet />
            </el-icon>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 筛选栏 -->
    <div class="search-bar">
      <el-select
        v-model="filterStatus"
        placeholder="佣金状态"
        clearable
        style="width: 140px;"
        @change="fetchData"
      >
        <el-option label="全部" value="" />
        <el-option label="待审核" value="pending" />
        <el-option label="已通过" value="approved" />
        <el-option label="已驳回" value="rejected" />
        <el-option label="已发放" value="paid" />
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
      <el-table-column prop="userName" label="用户姓名" width="120" />
      <el-table-column prop="productName" label="产品名称" min-width="200" show-overflow-tooltip />
      <el-table-column prop="amount" label="佣金金额" width="120" align="right">
        <template #default="{ row }">
          <span style="color: #67c23a; font-weight: 500;">¥{{ row.amount.toFixed(2) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)">
            {{ statusText(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="appliedAt" label="申请时间" width="170" align="center" />
      <el-table-column label="操作" width="180" align="center" fixed="right">
        <template #default="{ row }">
          <div class="table-actions">
            <!-- 仅待审核状态显示审核操作 -->
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
import { Money, Clock, CircleCheck, Wallet } from '@element-plus/icons-vue'

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

// 佣金状态类型
type CommissionStatus = 'pending' | 'approved' | 'rejected' | 'paid'

// 佣金数据接口
interface Commission {
  id: number
  userName: string
  productName: string
  amount: number
  status: CommissionStatus
  appliedAt: string
}

// 统计数据
const stats = reactive({
  total: 0,
  pending: 0,
  approved: 0,
  paid: 0
})

// 表格数据
const tableData = ref<Commission[]>([])

// 获取状态标签类型
const statusTagType = (status: CommissionStatus) => {
  const map: Record<CommissionStatus, string> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
    paid: 'info'
  }
  return map[status]
}

// 获取状态文本
const statusText = (status: CommissionStatus) => {
  const map: Record<CommissionStatus, string> = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已驳回',
    paid: '已发放'
  }
  return map[status]
}

// 获取统计数据
const fetchStats = async () => {
  try {
    await new Promise(resolve => setTimeout(resolve, 300))
    // 模拟数据
    stats.total = 28650.00
    stats.pending = 3580.50
    stats.approved = 8200.00
    stats.paid = 16869.50
  } catch (error) {
    console.error('获取统计数据失败:', error)
  }
}

// 获取佣金列表数据
const fetchData = async () => {
  loading.value = true
  try {
    // 模拟接口请求
    await new Promise(resolve => setTimeout(resolve, 500))

    // 模拟数据
    const mockData: Commission[] = [
      {
        id: 1,
        userName: '李明',
        productName: '高端护肤品套装 - 补水保湿系列',
        amount: 45.00,
        status: 'pending',
        appliedAt: '2026-04-29 14:30:00'
      },
      {
        id: 2,
        userName: '王芳',
        productName: '智能蓝牙耳机 降噪版',
        amount: 30.00,
        status: 'pending',
        appliedAt: '2026-04-29 10:15:00'
      },
      {
        id: 3,
        userName: '赵强',
        productName: '有机绿茶礼盒装',
        amount: 20.00,
        status: 'approved',
        appliedAt: '2026-04-28 16:20:00'
      },
      {
        id: 4,
        userName: '孙丽',
        productName: '运动健身器材套装',
        amount: 60.00,
        status: 'paid',
        appliedAt: '2026-04-27 09:45:00'
      },
      {
        id: 5,
        userName: '周伟',
        productName: '儿童益智玩具积木',
        amount: 12.00,
        status: 'rejected',
        appliedAt: '2026-04-26 11:30:00'
      },
      {
        id: 6,
        userName: '吴敏',
        productName: '高端护肤品套装 - 补水保湿系列',
        amount: 45.00,
        status: 'paid',
        appliedAt: '2026-04-25 15:00:00'
      }
    ]

    // 根据筛选条件过滤
    let filtered = [...mockData]
    if (filterStatus.value) {
      filtered = filtered.filter(item => item.status === filterStatus.value)
    }

    pagination.total = filtered.length
    tableData.value = filtered
  } catch (error) {
    console.error('获取佣金列表失败:', error)
    ElMessage.error('获取佣金列表失败')
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
const handleApprove = async (row: Commission) => {
  try {
    await ElMessageBox.confirm(
      `确定要通过「${row.userName}」的佣金申请（¥${row.amount.toFixed(2)}）吗？`,
      '审核确认',
      {
        confirmButtonText: '通过',
        cancelButtonText: '取消',
        type: 'success'
      }
    )
    // 模拟接口请求
    await new Promise(resolve => setTimeout(resolve, 300))
    row.status = 'approved'
    ElMessage.success('审核通过')
    fetchStats()
  } catch {
    // 用户取消操作
  }
}

// 驳回申请
const handleReject = async (row: Commission) => {
  try {
    const { value: _reason } = await ElMessageBox.prompt(
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

    // 模拟接口请求
    await new Promise(resolve => setTimeout(resolve, 300))
    row.status = 'rejected'
    ElMessage.success('已驳回该申请')
    fetchStats()
  } catch {
    // 用户取消操作
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
