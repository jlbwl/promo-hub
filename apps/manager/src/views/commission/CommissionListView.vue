<template>
  <div class="commission-list-page">
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
      <!-- 待付款 - 可点击按钮 -->
      <el-col :xs="24" :sm="12" :md="4">
        <el-card shadow="hover" class="stat-card clickable" :class="{ 'has-items': stats.pendingPayment > 0 }" @click="openPaymentDialog">
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">待发放</span>
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
              <span class="stat-label">已发放</span>
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
        <el-option label="待发放" value="pending_payment" />
        <el-option label="已发放" value="settled" />
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
      <el-table-column prop="productName" label="产品名称" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <span>{{ row.productName }}</span>
          <el-tag v-if="row.optionLabel" size="small" type="info" style="margin-left: 6px;">{{ row.optionLabel }}</el-tag>
          <el-tag v-if="row.fundAccount" size="small" type="primary" plain style="margin-left: 6px;">{{ row.fundAccount }}</el-tag>
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
      <el-table-column prop="productPrice" label="积分值" width="100" align="right">
        <template #default="{ row }">
          <span style="font-weight: 500;">{{ row.productPrice }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)">
            {{ statusText(row.status) }}
          </el-tag>
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
      <el-table-column prop="settledAt" label="发放日期" width="170" align="center">
        <template #default="{ row }">
          <span>{{ row.settledAt ? formatTime(row.settledAt) : '--' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" align="center" fixed="right">
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
            <template v-else-if="row.status === 'approved'">
              <el-button type="primary" text size="small" @click="handleAddToPayment(row)">
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

    <!-- ====== 待发放发放模态框 ====== -->
    <el-dialog
      v-model="paymentDialogVisible"
      title="待发放发放"
      width="700px"
      destroy-on-close
    >
      <!-- 待付款列表 -->
      <div v-if="paymentStep === 'list'" class="payment-dialog-content">
        <div class="payment-summary">
          <span>共 <strong>{{ paymentOrders.length }}</strong> 笔待发放</span>
          <span class="payment-total">
            合计：<strong>{{ paymentTotal }}</strong>
          </span>
        </div>

        <el-table :data="paymentOrders" border size="small" max-height="400">
          <el-table-column type="index" label="#" width="40" />
          <el-table-column prop="productName" label="产品名称" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">
              <span>{{ row.productName }}</span>
              <el-tag v-if="row.optionLabel" size="small" type="info" style="margin-left: 4px;">{{ row.optionLabel }}</el-tag>
              <el-tag v-if="row.fundAccount" size="small" type="primary" plain style="margin-left: 4px;">{{ row.fundAccount }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="userName" label="姓名" width="100" show-overflow-tooltip>
            <template #default="{ row }">
              <span>{{ maskName(row.userName) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="userPhone" label="手机号" width="110" show-overflow-tooltip>
            <template #default="{ row }">
              <span>{{ maskPhone(row.userPhone) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="productPrice" label="积分值" width="90" align="right">
            <template #default="{ row }">
              <span style="font-weight: 600; color: #409eff;">{{ row.productPrice }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="做单时间" width="150" align="center" />
        </el-table>

        <div class="payment-actions">
          <el-button @click="paymentDialogVisible = false">关闭</el-button>
          <el-button
            type="primary"
            :disabled="paymentOrders.length === 0"
            @click="paymentStep = 'method'"
          >
            一键发放（{{ paymentOrders.length }}笔）
          </el-button>
        </div>
      </div>

      <!-- 选择发放方式 -->
      <div v-else-if="paymentStep === 'method'" class="payment-dialog-content">
        <div class="payment-summary">
          <span>共 <strong>{{ paymentOrders.length }}</strong> 笔</span>
          <span class="payment-total">
            合计：<strong>{{ paymentTotal }}</strong>
          </span>
        </div>

        <div class="payment-methods">
          <div
            v-for="method in paymentMethods"
            :key="method.value"
            class="method-card"
            :class="{ active: selectedPaymentMethod === method.value }"
            @click="selectedPaymentMethod = method.value"
          >
            <div class="method-icon" :style="{ background: method.color }">
              <span>{{ method.icon }}</span>
            </div>
            <div class="method-info">
              <span class="method-name">{{ method.label }}</span>
              <span class="method-desc">{{ method.desc }}</span>
            </div>
            <el-radio
              :model-value="selectedPaymentMethod"
              :value="method.value"
              style="margin-left: auto;"
            />
          </div>
        </div>

        <div class="payment-actions">
          <el-button @click="paymentStep = 'list'">返回</el-button>
          <el-button
            type="primary"
            :disabled="!selectedPaymentMethod"
            :loading="settleLoading"
            @click="handleBatchSettle"
          >
            确认发放 {{ paymentTotal }}
          </el-button>
        </div>
      </div>

      <!-- 发放成功 -->
      <div v-else-if="paymentStep === 'success'" class="payment-dialog-content">
        <div class="success-result">
          <el-icon class="success-icon" style="color: #67c23a; font-size: 64px;">
            <SuccessFilled />
          </el-icon>
          <h3>结算成功</h3>
          <p>已通过{{ methodLabel }}完成 {{ paymentOrders.length }} 笔订单结算</p>
          <p class="success-amount">¥{{ paymentTotal }}</p>
        </div>
        <div class="payment-actions" style="justify-content: center;">
          <el-button type="primary" @click="closePaymentDialog">完成</el-button>
        </div>
      </div>
    </el-dialog>

    <!-- ====== 通用数据查看模态框 ====== -->
    <el-dialog
      v-model="statDialogVisible"
      :title="statDialogTitle"
      width="750px"
      destroy-on-close
    >
      <div class="stat-dialog-content">
        <div class="payment-summary">
          <span>共 <strong>{{ statDialogOrders.length }}</strong> 条记录</span>
          <span class="payment-total">
            合计积分值：<strong>{{ statDialogTotal }}</strong>
          </span>
        </div>

        <el-table :data="statDialogOrders" border size="small" max-height="450">
          <el-table-column type="index" label="#" width="40" />
          <el-table-column prop="productName" label="产品名称" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">
              <span>{{ row.productName }}</span>
              <el-tag v-if="row.optionLabel" size="small" type="info" style="margin-left: 4px;">{{ row.optionLabel }}</el-tag>
              <el-tag v-if="row.fundAccount" size="small" type="primary" plain style="margin-left: 4px;">{{ row.fundAccount }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="userName" label="姓名" width="100" show-overflow-tooltip>
            <template #default="{ row }">
              <span>{{ maskName(row.userName) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="userPhone" label="手机号" width="110" show-overflow-tooltip>
            <template #default="{ row }">
              <span>{{ maskPhone(row.userPhone) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="productPrice" label="积分值" width="90" align="right">
            <template #default="{ row }">
              <span style="font-weight: 600;">{{ row.productPrice }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="做单时间" width="150" align="center">
            <template #default="{ row }">
              {{ formatTime(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column prop="rejectReason" label="驳回原因" width="120" show-overflow-tooltip>
            <template #default="{ row }">
              <span style="color: #f56c6c;">{{ row.rejectReason || '--' }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="settledAt" label="结算日期" width="150" align="center">
            <template #default="{ row }">
              <span>{{ row.settledAt ? formatTime(row.settledAt) : '--' }}</span>
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, Clock, CircleCheck, CircleClose, Wallet, SuccessFilled } from '@element-plus/icons-vue'
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
  pendingPayment: 0,
  settled: 0,
  rejected: 0
})

// 表格数据
const tableData = ref<any[]>([])

// ====== 通用数据查看模态框 ======
const statDialogVisible = ref(false)
const statDialogTitle = ref('')
const statDialogOrders = ref<any[]>([])

const statDialogTotal = computed(() => {
  return statDialogOrders.value.reduce((sum: number, o: any) => sum + (Number(o.productPrice) || 0), 0).toFixed(2)
})

// 打开通用数据查看弹窗
const openStatDialog = async (status: string, title: string) => {
  statDialogTitle.value = title + '明细'
  statDialogVisible.value = true

  try {
    const params: any = {
      managerId: getManagerId() || undefined,
      pageSize: 999,
    }
    if (status !== 'all') params.status = status

    const res = await get<any>('/orders', params)
    statDialogOrders.value = res.data?.list || []
  } catch (error) {
    ElMessage.error('获取数据失败')
    statDialogVisible.value = false
  }
}

// ====== 待付款结算相关 ======
const paymentDialogVisible = ref(false)
const paymentStep = ref<'list' | 'method' | 'success'>('list')
const paymentOrders = ref<any[]>([])
const selectedPaymentMethod = ref('')
const settleLoading = ref(false)

const paymentMethods = [
  { value: 'alipay', label: '支付宝', desc: '推荐使用支付宝转账', icon: '支', color: '#1677ff' },
  { value: 'wechat', label: '微信支付', desc: '使用微信转账付款', icon: '微', color: '#07c160' },
  { value: 'bank', label: '银行卡', desc: '使用银行卡转账', icon: '银', color: '#e6a23c' },
]

const paymentTotal = computed(() => {
  return paymentOrders.value.reduce((sum: number, o: any) => sum + (Number(o.productPrice) || 0), 0).toFixed(2)
})

const methodLabel = computed(() => {
  return paymentMethods.find(m => m.value === selectedPaymentMethod.value)?.label || ''
})

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
    pending_payment: '',
    settled: 'success',
    rejected: 'danger',
  }
  return map[status] || 'info'
}

const statusText = (status: string) => {
  const map: Record<string, string> = {
    pending: '待审核',
    approved: '已通过',
    pending_payment: '待发放',
    settled: '已发放',
    rejected: '已驳回',
  }
  return map[status] || status
}

// 格式化时间（北京时区 UTC+8）
const formatTime = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
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
  return `${year}-${pad(month)}-${pad(day)} ${pad(hours)}:${pad(d.getUTCMinutes())}`
}

const maskPhone = (phone: string) => {
  if (!phone || phone.length < 7) return phone || '--'
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

const maskName = (name: string) => {
  if (!name || name.length < 2) return name || '--'
  if (name.length === 2) return name[0] + '*'
  return name[0] + '*' + name.slice(-1)
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
      stats.pendingPayment = res.data.pendingPayment || 0
      stats.settled = res.data.settled || 0
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
      `确认「${row.productName}」推广有效，发放佣金 ¥${row.productPrice}？`,
      '审核确认',
      { confirmButtonText: '通过', cancelButtonText: '取消', type: 'success' }
    )
    await put(`/orders/${row.id}/review`, { action: 'approve' })
    ElMessage.success('已确认推广有效，佣金待发放')
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
    ElMessage.success('已驳回，库存已退回')
    fetchStats()
    fetchData()
  } catch (error: any) {
    if (error !== 'cancel' && error?.message) {
      ElMessage.error(error.message || '操作失败')
    }
  }
}

// 添加到待付款
const handleAddToPayment = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确认将「${row.productName}」添加到待付款列表？`,
      '添加到待付款',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'info' }
    )
    await put(`/orders/${row.id}/settle`, { action: 'pending_payment' })
    ElMessage.success('已添加到待付款')
    fetchStats()
    fetchData()
  } catch (error: any) {
    if (error !== 'cancel' && error?.message) {
      ElMessage.error(error.message || '操作失败')
    }
  }
}

// 打开待付款结算弹窗
const openPaymentDialog = async () => {
  if (stats.pendingPayment === 0) {
    ElMessage.info('暂无待付款订单')
    return
  }
  paymentStep.value = 'list'
  selectedPaymentMethod.value = ''
  paymentDialogVisible.value = true

  // 加载待付款订单
  try {
    const res = await get<any>('/orders', {
      managerId: getManagerId() || undefined,
      status: 'pending_payment',
      pageSize: 999,
    })
    paymentOrders.value = res.data?.list || []
  } catch (error) {
    ElMessage.error('获取待付款列表失败')
    paymentDialogVisible.value = false
  }
}

// 一键结算
const handleBatchSettle = async () => {
  if (!selectedPaymentMethod.value) {
    ElMessage.warning('请选择付款方式')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确认通过${methodLabel.value}支付 ¥${paymentTotal}，结算 ${paymentOrders.value.length} 笔订单？`,
      '确认结算',
      { confirmButtonText: '确认付款', cancelButtonText: '取消', type: 'warning' }
    )

    settleLoading.value = true
    // 逐笔结算
    let successCount = 0
    for (const order of paymentOrders.value) {
      try {
        await put(`/orders/${order.id}/settle`, { action: 'paid' })
        successCount++
      } catch (e) {
        console.error(`结算订单 ${order.id} 失败:`, e)
      }
    }

    if (successCount === paymentOrders.value.length) {
      paymentStep.value = 'success'
    } else {
      ElMessage.warning(`成功结算 ${successCount}/${paymentOrders.value.length} 笔`)
      paymentDialogVisible.value = false
    }

    fetchStats()
    fetchData()
  } catch (error: any) {
    if (error !== 'cancel' && error?.message) {
      ElMessage.error(error.message || '结算失败')
    }
  } finally {
    settleLoading.value = false
  }
}

// 关闭结算弹窗
const closePaymentDialog = () => {
  paymentDialogVisible.value = false
  paymentStep.value = 'list'
  paymentOrders.value = []
  selectedPaymentMethod.value = ''
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
    position: relative;
    cursor: default;

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

    // 可点击的待付款卡片
    &.clickable {
      cursor: pointer;
      transition: all 0.3s;
      border: 2px solid transparent;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(64, 158, 255, 0.3);
      }

      &.has-items {
        border-color: #409eff;
      }
    }

    .card-badge {
      position: absolute;
      top: 12px;
      right: 12px;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      color: #ffffff;
      background: linear-gradient(135deg, #409eff, #66b1ff);
    }
  }

  .pagination-container {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }
}

// 待付款弹窗内容
.payment-dialog-content {
  .payment-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #f5f7fa;
    border-radius: 8px;
    margin-bottom: 16px;
    font-size: 14px;
    color: #606266;

    .payment-total {
      color: #409eff;
      font-size: 16px;
    }
  }

  .payment-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid #ebeef5;
  }

  // 付款方式选择
  .payment-methods {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 8px;
  }

  .method-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
    border: 2px solid #e4e7ed;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: #409eff;
      background: #f5f9ff;
    }

    &.active {
      border-color: #409eff;
      background: #ecf5ff;
    }

    .method-icon {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 18px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .method-info {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .method-name {
        font-size: 15px;
        font-weight: 600;
        color: #303133;
      }

      .method-desc {
        font-size: 12px;
        color: #909399;
      }
    }
  }

  // 结算成功
  .success-result {
    text-align: center;
    padding: 30px 0;

    .success-icon {
      margin-bottom: 16px;
    }

    h3 {
      font-size: 20px;
      color: #303133;
      margin-bottom: 8px;
    }

    p {
      color: #909399;
      font-size: 14px;
    }

    .success-amount {
      font-size: 32px;
      font-weight: 700;
      color: #67c23a;
      margin-top: 12px;
    }
  }
}
</style>
