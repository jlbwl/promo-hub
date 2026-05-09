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
      <el-select v-model="filterManager" placeholder="筛选经理" clearable style="width: 160px; margin-left: 12px;" @change="fetchData">
        <el-option label="全部经理" value="" />
        <el-option v-for="m in managers" :key="m.id" :label="m.name" :value="m.id" />
      </el-select>
      <el-select v-model="filterUser" placeholder="筛选用户" clearable style="width: 160px; margin-left: 12px;" @change="fetchData">
        <el-option label="全部用户" value="" />
        <el-option v-for="u in users" :key="u.id" :label="u.phone" :value="u.id" />
      </el-select>
      <el-button icon="Refresh" style="margin-left: 12px;" @click="handleReset">重置</el-button>
    </div>

    <!-- 数据表格 -->
    <el-table v-loading="loading" :data="tableData" border stripe style="width: 100%;">
      <el-table-column prop="productName" label="产品名称" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <span>{{ row.productName }}</span>
          <el-tag v-if="row.optionLabel" size="small" type="info" style="margin-left: 6px;">{{ row.optionLabel }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="userName" label="用户姓名" width="120" show-overflow-tooltip>
        <template #default="{ row }">
          <span>{{ maskName(row.userName) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="userPhone" label="手机号" width="130" show-overflow-tooltip>
        <template #default="{ row }">
          <span>{{ maskPhone(row.userPhone) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="productPrice" label="产品售价" width="100" align="right">
        <template #default="{ row }">
          <span style="font-weight: 500;">¥{{ row.productPrice }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="做单时间" width="170" align="center">
        <template #default="{ row }">
          {{ formatTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column prop="rejectReason" label="驳回原因" width="120" show-overflow-tooltip>
        <template #default="{ row }">
          <span style="color: #f56c6c;">{{ row.rejectReason || '--' }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="settledAt" label="结算日期" width="170" align="center">
        <template #default="{ row }">
          <span>{{ row.settledAt ? formatTime(row.settledAt) : '--' }}</span>
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
          <el-table-column prop="productName" label="产品名称" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">
              <span>{{ row.productName }}</span>
              <el-tag v-if="row.optionLabel" size="small" type="info" style="margin-left: 4px;">{{ row.optionLabel }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="userName" label="用户姓名" width="100" show-overflow-tooltip>
            <template #default="{ row }"><span>{{ maskName(row.userName) }}</span></template>
          </el-table-column>
          <el-table-column prop="userPhone" label="手机号" width="110" show-overflow-tooltip>
            <template #default="{ row }"><span>{{ maskPhone(row.userPhone) }}</span></template>
          </el-table-column>
          <el-table-column prop="productPrice" label="金额" width="80" align="right">
            <template #default="{ row }"><span style="font-weight: 600;">¥{{ row.productPrice }}</span></template>
          </el-table-column>
          <el-table-column label="做单时间" width="140" align="center">
            <template #default="{ row }">
              {{ formatTime(row.createdAt) }}
            </template>
          </el-table-column>
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
import { ElMessage } from 'element-plus'
import { Document, Clock, CircleCheck, CircleClose, Wallet, SuccessFilled } from '@element-plus/icons-vue'
import { get } from '@promo/shared/utils/request'

const loading = ref(false)
const filterStatus = ref('')
const filterManager = ref('')
const filterUser = ref('')
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })
const tableData = ref<any[]>([])

// 经理列表和用户列表
const managers = ref<any[]>([])
const users = ref<any[]>([])

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
  // 获取北京时区时间（UTC+8）
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth() + 1
  let day = d.getUTCDate()
  let hours = d.getUTCHours() + 8
  // 处理跨天情况
  if (hours >= 24) {
    hours -= 24
    day += 1
  }
  return `${year}-${p(month)}-${p(day)} ${p(hours)}:${p(d.getUTCMinutes())}`
}

const maskPhone = (phone: string) => {
  if (!phone || phone.length < 7) return phone || '--'
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

const maskName = (name: string) => {
  if (!name) return '--'
  if (name.length <= 1) return name
  if (name.length === 2) return name[0] + '*'
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
}

const fetchStats = async () => {
  try {
    const res = await get<any>('/orders/stats')
    if (res.data) Object.assign(stats, { total: res.data.total || 0, pending: res.data.pending || 0, approved: res.data.approved || 0, pendingPayment: res.data.pendingPayment || 0, settled: res.data.settled || 0, rejected: res.data.rejected || 0 })
  } catch (e) { console.error(e) }
}

// 获取经理列表
const fetchManagers = async () => {
  try {
    const res = await get<any>('/managers')
    if (res.data) managers.value = res.data || []
  } catch (e) { console.error(e) }
}

// 获取用户列表（主账号用户，不包含员工子账号）
const fetchUsers = async () => {
  try {
    const res = await get<any>('/users', { role: 'user' })
    if (res.data) users.value = res.data.list || []
  } catch (e) { console.error(e) }
}

const fetchData = async () => {
  loading.value = true
  try {
    const params: any = { page: pagination.page, pageSize: pagination.pageSize }
    if (filterStatus.value) params.status = filterStatus.value
    if (filterManager.value) params.managerId = filterManager.value
    if (filterUser.value) params.userId = filterUser.value
    const res = await get<any>('/orders', params)
    if (res.data) { tableData.value = res.data.list || []; pagination.total = res.data.total || 0 }
  } catch (e: any) { ElMessage.error(e.message || '获取失败') }
  finally { loading.value = false }
}

const handleReset = () => { filterStatus.value = ''; filterManager.value = ''; filterUser.value = ''; pagination.page = 1; fetchData() }

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

onMounted(() => { fetchStats(); fetchData(); fetchManagers(); fetchUsers() })
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
