<template>
  <div class="commission-admin">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stat-cards">
      <el-col :xs="24" :sm="12" :md="4">
        <el-card shadow="hover" class="stat-card clickable" @click="openStatDialog('all', '总订单')">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">总订单</span>
              <el-statistic :value="stats.total" />
            </div>
            <el-icon class="stat-icon" style="color: #409eff; background: #ecf5ff;"><Document /></el-icon>
          </div>
          <div v-if="stats.total > 0" class="card-badge">查看</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="4">
        <el-card shadow="hover" class="stat-card clickable" @click="openStatDialog('pending', '待审核')">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">待审核</span>
              <el-statistic :value="stats.pending" />
            </div>
            <el-icon class="stat-icon" style="color: #e6a23c; background: #fdf6ec;"><Clock /></el-icon>
          </div>
          <div v-if="stats.pending > 0" class="card-badge" style="background: linear-gradient(135deg, #e6a23c, #f5c77e);">查看</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="4">
        <el-card shadow="hover" class="stat-card clickable" @click="openStatDialog('approved', '已通过')">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">已通过</span>
              <el-statistic :value="stats.approved" />
            </div>
            <el-icon class="stat-icon" style="color: #67c23a; background: #f0f9eb;"><CircleCheck /></el-icon>
          </div>
          <div v-if="stats.approved > 0" class="card-badge" style="background: linear-gradient(135deg, #67c23a, #95d475);">查看</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="4">
        <el-card shadow="hover" class="stat-card clickable" @click="openStatDialog('pending_payment', '待付款')">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">待付款</span>
              <el-statistic :value="stats.pendingPayment" />
            </div>
            <el-icon class="stat-icon" style="color: #409eff; background: #ecf5ff;"><Wallet /></el-icon>
          </div>
          <div v-if="stats.pendingPayment > 0" class="card-badge">去结算</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="4">
        <el-card shadow="hover" class="stat-card clickable" @click="openStatDialog('settled', '已结算')">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">已结算</span>
              <el-statistic :value="stats.settled" />
            </div>
            <el-icon class="stat-icon" style="color: #67c23a; background: #f0f9eb;"><SuccessFilled /></el-icon>
          </div>
          <div v-if="stats.settled > 0" class="card-badge" style="background: linear-gradient(135deg, #67c23a, #95d475);">查看</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="4">
        <el-card shadow="hover" class="stat-card clickable" @click="openStatDialog('rejected', '已驳回')">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">已驳回</span>
              <el-statistic :value="stats.rejected" />
            </div>
            <el-icon class="stat-icon" style="color: #f56c6c; background: #fef0f0;"><CircleClose /></el-icon>
          </div>
          <div v-if="stats.rejected > 0" class="card-badge" style="background: linear-gradient(135deg, #f56c6c, #fab6b6);">查看</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 筛选栏 -->
    <div class="search-bar">
      <el-select v-model="filterStatus" placeholder="订单状态" clearable style="width: 140px;" @change="fetchData">
        <el-option label="全部" value="" />
        <el-option label="待审核" value="pending" />
        <el-option label="已通过" value="approved" />
        <el-option label="待付款" value="pending_payment" />
        <el-option label="已结算" value="settled" />
        <el-option label="已驳回" value="rejected" />
      </el-select>
      <el-select v-model="filterSource" placeholder="数据来源" clearable style="width: 140px; margin-left: 12px;" @change="fetchData">
        <el-option label="全部" value="" />
        <el-option label="经理管理" value="manager" />
        <el-option label="已转移（经理删除）" value="admin" />
      </el-select>
      <el-button icon="Refresh" style="margin-left: 12px;" @click="handleReset">重置</el-button>
    </div>

    <!-- 数据表格 -->
    <el-table v-loading="loading" :data="tableData" border stripe style="width: 100%;">
      <el-table-column prop="productName" label="产品名称" min-width="150" show-overflow-tooltip />
      <el-table-column prop="userId" label="用户ID" width="160" show-overflow-tooltip />
      <el-table-column prop="productPrice" label="金额" width="90" align="right">
        <template #default="{ row }">
          <span style="font-weight: 500;">¥{{ row.productPrice }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="来源" width="120" align="center">
        <template #default="{ row }">
          <el-tag :type="row.managedBy === 'admin' ? 'warning' : 'info'" size="small">
            {{ row.managedBy === 'admin' ? '已转移' : '经理管理' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="transferredFromManager" label="原经理" width="100" show-overflow-tooltip>
        <template #default="{ row }">
          <span>{{ row.transferredFromManager || '--' }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="做单时间" width="160" align="center" />
      <el-table-column prop="settledAt" label="结算日期" width="160" align="center">
        <template #default="{ row }">
          <span>{{ row.settledAt ? formatTime(row.settledAt) : '--' }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="rejectReason" label="驳回原因" width="120" show-overflow-tooltip>
        <template #default="{ row }">
          <span style="color: #f56c6c;">{{ row.rejectReason || '--' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" align="center" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 'pending'">
            <el-button type="success" text size="small" @click="handleApprove(row)">审核通过</el-button>
            <el-button type="danger" text size="small" @click="handleReject(row)">驳回</el-button>
          </template>
          <template v-else-if="row.status === 'approved'">
            <el-button type="primary" text size="small" @click="handleAddToPayment(row)">添加到待付款</el-button>
          </template>
          <template v-else>
            <span style="color: #909399; font-size: 13px;">--</span>
          </template>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination-container">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next"
        background
        @size-change="fetchData"
        @current-change="fetchData"
      />
    </div>

    <!-- ====== 通用数据查看模态框 ====== -->
    <el-dialog v-model="statDialogVisible" :title="statDialogTitle" width="750px" destroy-on-close>
      <div class="stat-dialog-content">
        <div class="payment-summary">
          <span>共 <strong>{{ statDialogOrders.length }}</strong> 条记录</span>
          <span class="payment-total">合计金额：<strong>¥{{ statDialogTotal }}</strong></span>
        </div>
        <el-table :data="statDialogOrders" border size="small" max-height="450">
          <el-table-column type="index" label="#" width="40" />
          <el-table-column prop="productName" label="产品名称" min-width="130" show-overflow-tooltip />
          <el-table-column prop="userId" label="用户ID" width="150" show-overflow-tooltip />
          <el-table-column prop="productPrice" label="金额" width="80" align="right">
            <template #default="{ row }"><span style="font-weight: 600;">¥{{ row.productPrice }}</span></template>
          </el-table-column>
          <el-table-column label="来源" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="row.managedBy === 'admin' ? 'warning' : 'info'" size="small">
                {{ row.managedBy === 'admin' ? '已转移' : '经理' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="transferredFromManager" label="原经理" width="90" show-overflow-tooltip>
            <template #default="{ row }"><span>{{ row.transferredFromManager || '--' }}</span></template>
          </el-table-column>
          <el-table-column prop="createdAt" label="做单时间" width="140" align="center" />
        </el-table>
        <div class="payment-actions">
          <el-button @click="statDialogVisible = false">关闭</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Clock, CircleCheck, CircleClose, Wallet, SuccessFilled } from '@element-plus/icons-vue'
import { get, put } from '@promo/shared/utils/request'

const loading = ref(false)
const filterStatus = ref('')
const filterSource = ref('')
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })
const tableData = ref<any[]>([])

const stats = reactive({ total: 0, pending: 0, approved: 0, pendingPayment: 0, settled: 0, rejected: 0 })

// 通用查看弹窗
const statDialogVisible = ref(false)
const statDialogTitle = ref('')
const statDialogOrders = ref<any[]>([])
const statDialogTotal = computed(() => statDialogOrders.value.reduce((s: number, o: any) => s + (Number(o.productPrice) || 0), 0).toFixed(2))

const statusTagType = (s: string) => ({ pending: 'warning', approved: 'success', pending_payment: '', settled: 'success', rejected: 'danger' }[s] || 'info')
const statusText = (s: string) => ({ pending: '待审核', approved: '已通过', pending_payment: '待付款', settled: '已结算', rejected: '已驳回' }[s] || s)

const formatTime = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const fetchStats = async () => {
  try {
    const res = await get<any>('/orders/stats')
    if (res.data) Object.assign(stats, { total: res.data.total || 0, pending: res.data.pending || 0, approved: res.data.approved || 0, pendingPayment: res.data.pendingPayment || 0, settled: res.data.settled || 0, rejected: res.data.rejected || 0 })
  } catch (e) { console.error(e) }
}

const fetchData = async () => {
  loading.value = true
  try {
    const params: any = { page: pagination.page, pageSize: pagination.pageSize }
    if (filterStatus.value) params.status = filterStatus.value
    if (filterSource.value) params.managedBy = filterSource.value
    const res = await get<any>('/orders', params)
    if (res.data) { tableData.value = res.data.list || []; pagination.total = res.data.total || 0 }
  } catch (e: any) { ElMessage.error(e.message || '获取失败') }
  finally { loading.value = false }
}

const handleReset = () => { filterStatus.value = ''; filterSource.value = ''; pagination.page = 1; fetchData() }

const openStatDialog = async (status: string, title: string) => {
  statDialogTitle.value = title + '明细'
  statDialogVisible.value = true
  try {
    const params: any = { pageSize: 999 }
    if (status !== 'all') params.status = status
    const res = await get<any>('/orders', params)
    statDialogOrders.value = res.data?.list || []
  } catch { ElMessage.error('获取数据失败'); statDialogVisible.value = false }
}

const handleApprove = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确认「${row.productName}」推广有效？`, '审核', { confirmButtonText: '通过', cancelButtonText: '取消', type: 'success' })
    await put(`/orders/${row.id}/review`, { action: 'approve' })
    ElMessage.success('审核通过'); fetchStats(); fetchData()
  } catch (e: any) { if (e !== 'cancel' && e?.message) ElMessage.error(e.message) }
}

const handleReject = async (row: any) => {
  try {
    const { value: reason } = await ElMessageBox.prompt('请输入驳回原因', '驳回', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning', inputValidator: (v: string) => v?.trim() ? true : '请输入原因' })
    await put(`/orders/${row.id}/review`, { action: 'reject', reason })
    ElMessage.success('已驳回'); fetchStats(); fetchData()
  } catch (e: any) { if (e !== 'cancel' && e?.message) ElMessage.error(e.message) }
}

const handleAddToPayment = async (row: any) => {
  try {
    await ElMessageBox.confirm(`将「${row.productName}」添加到待付款？`, '确认', { confirmButtonText: '确定', cancelButtonText: '取消' })
    await put(`/orders/${row.id}/settle`, { action: 'pending_payment' })
    ElMessage.success('已添加到待付款'); fetchStats(); fetchData()
  } catch (e: any) { if (e !== 'cancel' && e?.message) ElMessage.error(e.message) }
}

onMounted(() => { fetchStats(); fetchData() })
</script>

<style lang="scss" scoped>
.commission-admin {
  .stat-cards { margin-bottom: 20px; }
  .stat-card {
    margin-bottom: 16px; position: relative; cursor: default;
    .stat-content { display: flex; align-items: center; justify-content: space-between;
      .stat-info { .stat-label { display: block; font-size: 14px; color: #909399; margin-bottom: 8px; } }
      .stat-icon { width: 56px; height: 56px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 28px; }
    }
    &.clickable { cursor: pointer; transition: all 0.3s; border: 2px solid transparent;
      &:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(64,158,255,0.3); }
    }
    .card-badge { position: absolute; top: 12px; right: 12px; padding: 2px 8px; border-radius: 10px; font-size: 11px; color: #fff; background: linear-gradient(135deg, #409eff, #66b1ff); }
  }
  .search-bar { margin-bottom: 16px; }
  .pagination-container { display: flex; justify-content: flex-end; margin-top: 16px; }
  .payment-summary { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #f5f7fa; border-radius: 8px; margin-bottom: 16px; font-size: 14px; color: #606266;
    .payment-total { color: #409eff; font-size: 16px; }
  }
  .payment-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px; padding-top: 16px; border-top: 1px solid #ebeef5; }
}
</style>
