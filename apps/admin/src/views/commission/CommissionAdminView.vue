<template>
  <div class="commission-admin">
    <!-- 统计卡片 -->
    <el-row
      :gutter="20"
      class="stat-cards"
    >
      <el-col
        :xs="24"
        :sm="12"
        :md="4"
      >
        <el-card
          shadow="hover"
          class="stat-card clickable"
          @click="openStatDialog('all', '总订单')"
        >
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">总订单</span>
              <el-statistic :value="stats.total" />
            </div>
            <el-icon
              class="stat-icon"
              style="color: #409eff; background: #ecf5ff;"
            >
              <Document />
            </el-icon>
          </div>
          <div
            v-if="stats.total > 0"
            class="card-badge"
          >
            查看
          </div>
        </el-card>
      </el-col>
      <el-col
        :xs="24"
        :sm="12"
        :md="4"
      >
        <el-card
          shadow="hover"
          class="stat-card clickable"
          @click="openStatDialog('pending', '待审核')"
        >
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">待审核</span>
              <el-statistic :value="stats.pending" />
            </div>
            <el-icon
              class="stat-icon"
              style="color: #e6a23c; background: #fdf6ec;"
            >
              <Clock />
            </el-icon>
          </div>
          <div
            v-if="stats.pending > 0"
            class="card-badge"
            style="background: linear-gradient(135deg, #e6a23c, #f5c77e);"
          >
            查看
          </div>
        </el-card>
      </el-col>
      <el-col
        :xs="24"
        :sm="12"
        :md="4"
      >
        <el-card
          shadow="hover"
          class="stat-card clickable"
          @click="openStatDialog('approved', '已通过')"
        >
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">已通过</span>
              <el-statistic :value="stats.approved" />
            </div>
            <el-icon
              class="stat-icon"
              style="color: #67c23a; background: #f0f9eb;"
            >
              <CircleCheck />
            </el-icon>
          </div>
          <div
            v-if="stats.approved > 0"
            class="card-badge"
            style="background: linear-gradient(135deg, #67c23a, #95d475);"
          >
            查看
          </div>
        </el-card>
      </el-col>
      <el-col
        :xs="24"
        :sm="12"
        :md="4"
      >
        <el-card
          shadow="hover"
          class="stat-card clickable"
          @click="openStatDialog('pending_payment', '待付款')"
        >
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">待发放</span>
              <el-statistic :value="stats.pendingPayment" />
            </div>
            <el-icon
              class="stat-icon"
              style="color: #409eff; background: #ecf5ff;"
            >
              <Wallet />
            </el-icon>
          </div>
          <div
            v-if="stats.pendingPayment > 0"
            class="card-badge"
          >
            去结算
          </div>
        </el-card>
      </el-col>
      <el-col
        :xs="24"
        :sm="12"
        :md="4"
      >
        <el-card
          shadow="hover"
          class="stat-card clickable"
          @click="openStatDialog('settled', '已结算')"
        >
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">已发放</span>
              <el-statistic :value="stats.settled" />
            </div>
            <el-icon
              class="stat-icon"
              style="color: #67c23a; background: #f0f9eb;"
            >
              <SuccessFilled />
            </el-icon>
          </div>
          <div
            v-if="stats.settled > 0"
            class="card-badge"
            style="background: linear-gradient(135deg, #67c23a, #95d475);"
          >
            查看
          </div>
        </el-card>
      </el-col>
      <el-col
        :xs="24"
        :sm="12"
        :md="4"
      >
        <el-card
          shadow="hover"
          class="stat-card clickable"
          @click="openStatDialog('rejected', '已驳回')"
        >
          <div class="stat-content">
            <div class="stat-info">
              <span class="stat-label">已驳回</span>
              <el-statistic :value="stats.rejected" />
            </div>
            <el-icon
              class="stat-icon"
              style="color: #f56c6c; background: #fef0f0;"
            >
              <CircleClose />
            </el-icon>
          </div>
          <div
            v-if="stats.rejected > 0"
            class="card-badge"
            style="background: linear-gradient(135deg, #f56c6c, #fab6b6);"
          >
            查看
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 筛选栏 -->
    <div class="search-bar">
      <el-input
        v-model="filterKeyword"
        placeholder="搜索产品名称、用户姓名、手机号"
        prefix-icon="Search"
        clearable
        style="width: 300px;"
        @clear="fetchData"
        @keyup.enter="fetchData"
      />
      <el-select
        v-model="filterStatus"
        placeholder="订单状态"
        clearable
        style="width: 140px; margin-left: 12px;"
        @change="fetchData"
      >
        <el-option
          label="全部"
          value=""
        />
        <el-option
          label="待审核"
          value="pending"
        />
        <el-option
          label="已通过"
          value="approved"
        />
        <el-option
          label="待发放"
          value="pending_payment"
        />
        <el-option
          label="已发放"
          value="settled"
        />
        <el-option
          label="已驳回"
          value="rejected"
        />
      </el-select>
      <el-select
        v-model="filterManager"
        placeholder="筛选经理"
        clearable
        style="width: 160px; margin-left: 12px;"
        @change="fetchData"
      >
        <el-option
          label="全部经理"
          value=""
        />
        <el-option
          v-for="m in managers"
          :key="m.id"
          :label="m.name"
          :value="m.id"
        />
      </el-select>
      <el-select
        v-model="filterUser"
        placeholder="筛选用户"
        clearable
        style="width: 160px; margin-left: 12px;"
        @change="fetchData"
      >
        <el-option
          label="全部用户"
          value=""
        />
        <el-option
          v-for="u in users"
          :key="u.id"
          :label="u.phone"
          :value="u.id"
        />
      </el-select>
      <el-button
        icon="Refresh"
        style="margin-left: 12px;"
        @click="handleReset"
      >
        重置
      </el-button>
    </div>

    <!-- 数据表格 -->
    <el-table
      v-loading="loading"
      :data="tableData"
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
        </template>
      </el-table-column>
      <el-table-column
        prop="userName"
        label="用户姓名"
        width="120"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <span>{{ maskName(row.userName) }}</span>
        </template>
      </el-table-column>
      <el-table-column
        label="渠道名称"
        width="140"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <span>{{ getManagerTeamName(row.managerId) }}</span>
        </template>
      </el-table-column>
      <el-table-column
        label="团队名称"
        width="140"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <div class="editable-cell" v-if="row.teamName">
            {{ row.teamName }}
            <el-icon
              class="edit-icon"
              @click="editTeamName(row)"
            >
              <Edit />
            </el-icon>
          </div>
          <div v-else class="editable-cell empty" @click="editTeamName(row)">
            <span class="empty-text">点击编辑</span>
            <el-icon class="edit-icon">
              <Edit />
            </el-icon>
          </div>
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
          <span style="font-weight: 500;">{{ row.productPrice }}</span>
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
        prop="rejectReason"
        label="驳回原因"
        width="120"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <span style="color: #f56c6c;">{{ row.rejectReason || '--' }}</span>
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
        width="120"
        align="center"
      >
        <template #default="{ row }">
          <el-button
            type="danger"
            text
            size="small"
            @click="handleDelete(row)"
          >
            删除
          </el-button>
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

    <!-- 删除确认弹窗 -->
    <el-dialog
      v-model="deleteDialogVisible"
      title="删除确认"
      width="480px"
      :close-on-click-modal="false"
      @close="closeDeleteDialog"
    >
      <div class="delete-dialog-content">
        <div class="warning-icon">
          <el-icon
            size="48"
            color="#f56c6c"
          >
            <Warning />
          </el-icon>
        </div>
        <div class="warning-text">
          <p>确定要删除订单「<strong>{{ deleteRow?.productName }}</strong>」吗？</p>
          <p class="hint">
            删除后将同时从经理端和用户端移除该条数据，请谨慎操作。
          </p>
        </div>
        <div class="reason-section">
          <el-form-item
            label="删除原因"
            required
          >
            <el-textarea
              v-model="deleteReason"
              placeholder="请输入删除原因（选填）"
              :rows="3"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </div>
      </div>
      <template #footer>
        <el-button @click="closeDeleteDialog">
          取消
        </el-button>
        <el-button
          type="danger"
          @click="confirmDelete"
        >
          确定删除
        </el-button>
      </template>
    </el-dialog>

    <!-- ====== 编辑团队名称模态框 ====== -->
    <el-dialog
      v-model="editTeamNameDialogVisible"
      title="编辑团队名称"
      width="420px"
      :close-on-click-modal="false"
    >
      <div class="edit-team-name-content">
        <el-form :model="editTeamNameForm" :rules="editTeamNameRules" ref="editTeamNameFormRef" label-width="80px">
          <el-form-item label="产品名称">
            <el-input :value="editTeamNameRow?.productName" disabled />
          </el-form-item>
          <el-form-item label="用户姓名">
            <el-input :value="maskName(editTeamNameRow?.userName)" disabled />
          </el-form-item>
          <el-form-item label="团队名称" prop="teamName">
            <el-input
              v-model="editTeamNameForm.teamName"
              placeholder="请输入团队名称"
              maxlength="50"
              show-word-limit
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="editTeamNameDialogVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="editTeamNameLoading"
          @click="confirmEditTeamName"
        >
          保存
        </el-button>
      </template>
    </el-dialog>

    <!-- ====== 通用数据查看模态框 ====== -->
    <el-dialog
      v-model="statDialogVisible"
      :title="statDialogTitle"
      width="950px"
      destroy-on-close
    >
      <div
        class="stat-dialog-content"
        style="overflow: hidden;"
      >
        <div class="payment-summary">
          <span>共 <strong>{{ statDialogOrders.length }}</strong> 条记录</span>
          <span class="payment-total">合计佣金：<strong>{{ statDialogTotal }}</strong></span>
        </div>
        <el-table
          :data="statDialogOrders"
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
            prop="userName"
            label="用户姓名"
            width="90"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <span>{{ maskName(row.userName) }}</span>
            </template>
          </el-table-column>
          <el-table-column
            label="渠道名称"
            width="110"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <span>{{ getManagerTeamName(row.managerId) }}</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="teamName"
            label="团队名称"
            width="110"
            show-overflow-tooltip
          />
          <el-table-column
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
            prop="productPrice"
            label="推广费"
            width="70"
            align="right"
          >
            <template #default="{ row }">
              <span style="font-weight: 600;">{{ row.productPrice }}</span>
            </template>
          </el-table-column>
          <el-table-column
            label="做单时间"
            width="130"
            align="center"
          >
            <template #default="{ row }">
              {{ formatTime(row.createdAt) }}
            </template>
          </el-table-column>
        </el-table>
        <div class="payment-actions">
          <el-button @click="statDialogVisible = false">
            关闭
          </el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Document, Clock, CircleCheck, CircleClose, Wallet, SuccessFilled, Warning } from '@element-plus/icons-vue'
import { get, del } from '@promo/shared/utils/request'

const loading = ref(false)
const filterStatus = ref('')
const filterManager = ref('')
const filterUser = ref('')
const filterKeyword = ref('')
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
const statusText = (s: string) => ({ pending: '待审核', approved: '已通过', pending_payment: '待发放', settled: '已发放', rejected: '已驳回' }[s] || s)

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

// 根据经理 ID 获取经理团队名称
const getManagerTeamName = (managerId: string) => {
  if (!managerId) return '--'
  const manager = managers.value.find(m => m.id === managerId)
  if (manager) {
    return manager.teamName || manager.name || manager.username || '--'
  }
  return '--'
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
    if (filterKeyword.value) params.keyword = filterKeyword.value
    const res = await get<any>('/orders', params)
    if (res.data) { tableData.value = res.data.list || []; pagination.total = res.data.total || 0 }
  } catch (e: any) { ElMessage.error(e.message || '获取失败') }
  finally { loading.value = false }
}

const handleReset = () => { filterStatus.value = ''; filterManager.value = ''; filterUser.value = ''; filterKeyword.value = ''; pagination.page = 1; fetchData() }

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

// 删除相关状态
const deleteDialogVisible = ref(false)
const deleteRow = ref<any>(null)
const deleteReason = ref('')

// 打开删除确认弹窗
const handleDelete = (row: any) => {
  deleteRow.value = row
  deleteReason.value = ''
  deleteDialogVisible.value = true
}

// 确认删除
const confirmDelete = async () => {
  if (!deleteRow.value) return
  
  // 获取管理员信息
  const adminInfo = JSON.parse(localStorage.getItem('admin_info') || '{}')
  
  try {
    const res = await del(`/orders/${deleteRow.value.id}`, {
      reason: deleteReason.value.trim(),
      adminId: adminInfo.id || '',
      adminPhone: adminInfo.phone || '',
      adminName: adminInfo.name || ''
    })
    
    if (res.code === 0) {
      ElMessage.success('删除成功')
      deleteDialogVisible.value = false
      deleteRow.value = null
      deleteReason.value = ''
      fetchData()
      fetchStats()
    } else {
      ElMessage.error(res.message || '删除失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '删除失败')
  }
}

// 关闭删除弹窗
const closeDeleteDialog = () => {
  deleteDialogVisible.value = false
  deleteRow.value = null
  deleteReason.value = ''
}

// 编辑团队名称相关状态
import { put } from '@promo/shared/utils/request'
import { Edit } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'

const editTeamNameDialogVisible = ref(false)
const editTeamNameRow = ref<any>(null)
const editTeamNameLoading = ref(false)
const editTeamNameFormRef = ref<FormInstance>()
const editTeamNameForm = reactive({ teamName: '' })
const editTeamNameRules: FormRules = {
  teamName: [{ required: true, message: '请输入团队名称', trigger: 'blur' }]
}

// 打开编辑团队名称弹窗
const editTeamName = (row: any) => {
  editTeamNameRow.value = row
  editTeamNameForm.teamName = row.teamName || ''
  editTeamNameDialogVisible.value = true
}

// 确认编辑团队名称
const confirmEditTeamName = async () => {
  await editTeamNameFormRef.value?.validate()
  if (!editTeamNameRow.value) return

  editTeamNameLoading.value = true
  try {
    const res = await put(`/orders/${editTeamNameRow.value.id}/team-name`, {
      teamName: editTeamNameForm.teamName.trim()
    })

    if (res.code === 0) {
      ElMessage.success('团队名称更新成功')
      editTeamNameDialogVisible.value = false
      editTeamNameRow.value = null
      editTeamNameForm.teamName = ''
      fetchData()
      fetchStats()
    } else {
      ElMessage.error(res.message || '更新失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '更新失败')
  } finally {
    editTeamNameLoading.value = false
  }
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
  
  .delete-dialog-content {
    text-align: center;
    padding: 20px 0;
    .warning-icon { margin-bottom: 16px; }
    .warning-text {
      margin-bottom: 20px;
      p { margin: 8px 0; font-size: 14px; color: #606266;
        &.hint { font-size: 13px; color: #909399; }
      }
    }
    .reason-section {
      text-align: left;
      .el-textarea { width: 100%; }
    }
  }

  :deep(.el-table) {
    min-width: 900px;
  }

  .editable-cell {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    transition: all 0.2s;

    &:hover {
      background: #ecf5ff;
    }

    &.empty {
      color: #909399;

      .empty-text {
        font-size: 13px;
      }
    }

    .edit-icon {
      font-size: 14px;
      color: #409eff;
      opacity: 0;
      transition: opacity 0.2s;
    }

    &:hover .edit-icon,
    &.empty .edit-icon {
      opacity: 1;
    }
  }
}

@media (max-width: 768px) {
  .commission-admin {
    .stat-cards {
      :deep(.el-col) {
        margin-bottom: 12px;
      }
    }

    .stat-card {
      .stat-content {
        .stat-info {
          .stat-label {
            font-size: 12px;
          }
        }
        .stat-icon {
          width: 48px;
          height: 48px;
          font-size: 24px;
        }
      }
      .card-badge {
        font-size: 10px;
        padding: 2px 6px;
      }
    }

    .search-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-start;

      :deep(.el-input) {
        width: 100%;
        max-width: none;
      }

      :deep(.el-select) {
        width: 100%;
        max-width: none;
        margin-left: 0 !important;
      }

      :deep(.el-button) {
        margin-left: 0 !important;
      }
    }

    :deep(.el-table) {
      font-size: 11px;
    }

    :deep(.el-table th) {
      font-size: 11px;
      padding: 6px 4px;
    }

    :deep(.el-table td) {
      padding: 6px 4px;
    }

    :deep(.el-dialog) {
      width: 95% !important;
    }

    .pagination-container {
      justify-content: center;
    }

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

    .delete-dialog-content {
      padding: 16px 0;

      .warning-text {
        p {
          font-size: 13px;
        }
      }
    }
  }
}
</style>
