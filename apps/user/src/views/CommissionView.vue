<template>
  <div class="commission-page">
    <!-- 顶部导航栏 -->
    <van-nav-bar
      title="我的积分"
      fixed
      placeholder
      right-text="回收站"
      @click-right="openRecycleBin"
    />

    <!-- 积分概览卡片 -->
    <div class="commission-overview">
      <div class="overview-card">
        <div class="total-commission">
          <span class="label">做单记录</span>
          <span class="amount">{{ overview.total }}</span>
        </div>
        <div class="commission-details">
          <div class="detail-item">
            <span class="value">{{ overview.pending }}</span>
            <span class="label">待审核</span>
          </div>
          <div class="detail-item">
            <span class="value">{{ overview.approved }}</span>
            <span class="label">已通过</span>
          </div>
          <div class="detail-item">
            <span class="value">{{ overview.pendingPayment }}</span>
            <span class="label">待发放</span>
          </div>
          <div class="detail-item">
            <span class="value">{{ overview.settled }}</span>
            <span class="label">已发放</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 切换 -->
    <van-tabs
      v-model:active="activeTab"
      sticky
      @change="onTabChange"
    >
      <van-tab
        title="全部"
        name="all"
      />
      <van-tab
        title="待审核"
        name="pending"
      />
      <van-tab
        title="已通过"
        name="approved"
      />
      <van-tab
        title="待发放"
        name="pending_payment"
      />
      <van-tab
        title="已发放"
        name="settled"
      />
      <van-tab
        title="已驳回"
        name="rejected"
      />
    </van-tabs>

    <!-- 订单记录列表 -->
    <van-list
      v-model:loading="loading"
      :finished="finished"
      finished-text="没有更多了"
      @load="loadRecords"
    >
      <div class="record-list">
        <van-swipe-cell
          v-for="record in records"
          :key="record.id"
          :ref="el => { if (el) swipeCellRefs[record.id] = el }"
          :right-width="getSwipeWidth(record.id)"
          @close="handleSwipeClose(record.id)"
        >
          <div class="record-card">
            <div class="record-left">
              <h4 class="record-title">
                {{ record.productName }} <van-tag
                  v-if="record.optionLabel"
                  type="primary"
                  plain
                  size="medium"
                  style="vertical-align: middle; margin-left: 4px;"
                >
                  {{ record.optionLabel }}
                </van-tag><van-tag
                  v-if="record.fundAccount"
                  type="primary"
                  plain
                  size="medium"
                  style="vertical-align: middle; margin-left: 4px;"
                >
                  {{ record.fundAccount }}
                </van-tag>
              </h4>
              <div
                v-if="record.userName || record.userPhone"
                class="record-user-info"
              >
                <span v-if="record.userName">姓名：{{ maskName(record.userName) }}</span>
                <span
                  v-if="record.userPhone"
                  style="margin-left: 8px;"
                >手机：{{ maskPhone(record.userPhone) }}</span>
              </div>
              <span class="record-time">{{ formatTime(record.createdAt) }}</span>
              <span
                v-if="record.rejectReason"
                class="reject-reason"
              >驳回原因：{{ record.rejectReason }}</span>
            </div>
            <div class="record-right">
              <span class="record-price">{{ record.productPrice }}</span>
              <van-tag
                :type="(statusType(record.status) as any)"
                size="medium"
                round
              >
                {{ statusLabel(record.status) }}
              </van-tag>
            </div>
          </div>
          <template #right>
            <div class="swipe-actions">
              <!-- 确认删除状态：只显示删除确认按钮 -->
              <template v-if="confirmingIds.includes(record.id)">
                <van-button
                  type="warning"
                  square
                  text="移除记录同时存放回收站"
                  @click="handleDelete(record)"
                />
              </template>
              
              <!-- 输入资金号状态：只显示输入框和提交按钮 -->
              <template v-else-if="fundInputIds.includes(record.id)">
                <div class="fund-action">
                  <input
                    :ref="(el) => { if (el) fundInputRefs[record.id] = el as HTMLInputElement }"
                    v-model="fundAccountNumbers[record.id]"
                    type="text"
                    class="fund-input"
                    placeholder="请输入资金号"
                    @keyup.enter="submitFundAccount(record)"
                    @click.stop
                    @touchend.stop
                  >
                  <van-button
                    type="primary"
                    size="small"
                    text="提交"
                    @click.stop="submitFundAccount(record)"
                  />
                </div>
              </template>
              
              <!-- 正常状态：显示提交资金号和删除按钮 -->
              <template v-else>
                <van-button
                  type="primary"
                  square
                  text="提交资金号"
                  @click="handleShowFundInput(record)"
                />
                <van-button
                  type="danger"
                  square
                  text="删除"
                  @click="handleDelete(record)"
                />
              </template>
            </div>
          </template>
        </van-swipe-cell>
      </div>

      <!-- 空状态 -->
      <van-empty
        v-if="!loading && records.length === 0"
        description="暂无做单记录"
      />
    </van-list>

    <!-- 回收站弹窗 -->
    <van-action-sheet
      v-model:show="showRecycleBin"
      title="回收站"
      cancel-text="关闭"
    >
      <template #description>
        <div class="recycle-bin-content">
          <div
            v-if="deletedOrders.length === 0"
            class="empty-recycle"
          >
            <van-icon
              name="trash-o"
              size="48"
              color="#ccc"
            />
            <p>回收站是空的</p>
          </div>
          <div
            v-else
            class="deleted-list"
          >
            <van-swipe-cell
              v-for="order in deletedOrders"
              :key="order.id"
              right-width="140"
            >
              <div class="deleted-item">
                <div class="deleted-info">
                  <div class="deleted-title-row">
                    <span class="deleted-title">{{ order.productName }}</span>
                    <van-tag
                      v-if="order.optionLabel"
                      type="primary"
                      plain
                      size="medium"
                    >
                      {{ order.optionLabel }}
                    </van-tag>
                    <van-tag
                      v-if="order.fundAccount"
                      type="primary"
                      plain
                      size="medium"
                    >
                      {{ order.fundAccount }}
                    </van-tag>
                  </div>
                  <div
                    v-if="order.userName || order.userPhone"
                    class="deleted-user-info"
                  >
                    <span v-if="order.userName">姓名：{{ maskName(order.userName) }}</span>
                    <span
                      v-if="order.userPhone"
                      class="phone-span"
                    >手机：{{ maskPhone(order.userPhone) }}</span>
                  </div>
                  <div class="deleted-price-row">
                    <span class="deleted-price">{{ order.productPrice }}</span>
                    <span class="deleted-time">删除于 {{ formatTime(order.deletedAt) }}</span>
                  </div>
                </div>
              </div>
              <template #right>
                <div class="recycle-swipe-actions">
                  <van-button
                    type="primary"
                    square
                    text="恢复"
                    @click="handleRestore(order)"
                  />
                  <van-button
                    type="danger"
                    square
                    text="取消"
                  />
                </div>
              </template>
            </van-swipe-cell>
          </div>
        </div>
      </template>
    </van-action-sheet>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onActivated } from 'vue'
import { get, del, post } from '@promo/shared/utils/request'
import { showToast } from 'vant'

// 当前激活的 Tab
const activeTab = ref('all')

// 加载状态
const loading = ref(false)
const finished = ref(false)

// 分页
const page = ref(1)
const pageSize = 20

// 佣金概览数据
const overview = reactive({
  total: 0,
  pending: 0,
  approved: 0,
  pendingPayment: 0,
  settled: 0,
  rejected: 0
})

// 订单记录
const records = ref<any[]>([])

// 正在确认删除的记录ID列表（两步删除确认）
const confirmingIds = ref<string[]>([])

// swipe-cell 组件引用，用于控制菜单打开状态
const swipeCellRefs: Record<string, any> = {}

// 资金号输入框引用
const fundInputRefs: Record<string, HTMLInputElement> = {}

// 标记正在切换状态的记录（用于防止close事件清除确认状态）
const switchingIds = ref<string[]>([])

// 正在显示资金号输入框的记录ID列表
const fundInputIds = ref<string[]>([])

// 存储用户输入的资金号（响应式）
const fundAccountNumbers = reactive<Record<string, string>>({})

// 防止重复加载
let isLoading = false

// 回收站相关
const showRecycleBin = ref(false)
const deletedOrders = ref<any[]>([])

// 获取当前用户 ID
const getUserId = () => {
  try {
    const info = JSON.parse(localStorage.getItem('user_info') || '{}')
    return info.id || ''
  } catch { return '' }
}

// 获取员工ID
const getEmployeeId = () => {
  try {
    const info = JSON.parse(localStorage.getItem('employee_info') || '{}')
    return info.id || ''
  } catch { return '' }
}

// 是否为员工账户
const isEmployee = () => {
  return localStorage.getItem('login_type') === 'employee'
}

// 状态映射
const statusType = (status: string) => {
  const map: Record<string, string> = {
    pending: 'warning',
    approved: 'success',
    pending_payment: 'primary',
    settled: 'success',
    rejected: 'danger',
  }
  return map[status] || 'default'
}

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending: '待审核',
    approved: '已通过',
    pending_payment: '待发放',
    settled: '已发放',
    rejected: '已驳回',
  }
  return map[status] || status
}

// 格式化时间
const formatTime = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
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

// 加载统计数据
const loadStats = async () => {
  try {
    const params: any = {}
    if (isEmployee()) {
      params.employeeId = getEmployeeId()
    } else {
      params.userId = getUserId()
    }
    const res = await get<any>('/orders/stats', params)
    if (res.data) {
      overview.total = res.data.total || 0
      overview.pending = res.data.pending || 0
      overview.approved = res.data.approved || 0
      overview.pendingPayment = res.data.pendingPayment || 0
      overview.settled = res.data.settled || 0
      overview.rejected = res.data.rejected || 0
    }
  } catch (error) {
    console.error('获取统计失败:', error)
  }
}

// 加载订单记录
const loadRecords = async () => {
  if (isLoading) {
    loading.value = false
    return
  }
  isLoading = true
  try {
    const params: any = {
      page: page.value,
      pageSize,
    }
    
    if (isEmployee()) {
      params.employeeId = getEmployeeId()
    } else {
      params.userId = getUserId() || undefined
    }
    
    if (activeTab.value !== 'all') {
      params.status = activeTab.value
    }

    const res = await get<any>('/orders', params)
    if (res.data) {
      const { list, total } = res.data
      if (page.value === 1) {
        records.value = list || []
      } else {
        records.value.push(...(list || []))
      }
      if (records.value.length >= total) {
        finished.value = true
      }
      page.value++
    }
  } catch (error) {
    console.error('获取订单失败:', error)
    finished.value = true
  } finally {
    loading.value = false
    isLoading = false
  }
}

// 侧拉菜单关闭时，重置确认状态和资金号输入状态
const handleSwipeClose = (recordId: string) => {
  // 如果正在切换状态，则不清除确认状态
  if (switchingIds.value.includes(recordId)) {
    return
  }
  const index = confirmingIds.value.indexOf(recordId)
  if (index > -1) {
    confirmingIds.value.splice(index, 1)
  }
  // 重置资金号输入状态
  const fundIndex = fundInputIds.value.indexOf(recordId)
  if (fundIndex > -1) {
    fundInputIds.value.splice(fundIndex, 1)
  }
}

// 获取侧拉菜单宽度
const getSwipeWidth = (recordId: string): number => {
  if (confirmingIds.value.includes(recordId)) {
    return 200
  }
  if (fundInputIds.value.includes(recordId)) {
    return 240
  }
  return 140
}

// 显示资金号输入框
const handleShowFundInput = (record: any) => {
  // 标记正在切换状态
  switchingIds.value.push(record.id)
  // 进入资金号输入状态
  fundInputIds.value.push(record.id)
  // 初始化输入框值
  if (!fundAccountNumbers[record.id]) {
    fundAccountNumbers[record.id] = ''
  }
  // 保持侧拉菜单打开状态并聚焦输入框
  setTimeout(() => {
    const swipeCell = swipeCellRefs[record.id]
    if (swipeCell && swipeCell.open) {
      swipeCell.open('right')
    }
    // 聚焦到输入框
    setTimeout(() => {
      const inputEl = fundInputRefs[record.id]
      if (inputEl) {
        inputEl.focus()
      }
    }, 100)
    // 清除切换状态标记
    const idx = switchingIds.value.indexOf(record.id)
    if (idx > -1) {
      switchingIds.value.splice(idx, 1)
    }
  }, 50)
}

// 提交资金号
const submitFundAccount = async (record: any) => {
  const fundAccount = fundAccountNumbers[record.id]?.trim()
  if (!fundAccount) {
    showToast('请输入资金号')
    return
  }
  
  try {
    const res = await post('/user/orders/fund-account', {
      userId: getUserId(),
      orderId: record.id,
      fundAccount
    })
    if (res.code === 0) {
      showToast('提交成功')
      // 更新订单记录中的资金号
      record.fundAccount = fundAccount
      // 重置输入状态
      const index = fundInputIds.value.indexOf(record.id)
      if (index > -1) {
        fundInputIds.value.splice(index, 1)
      }
      fundAccountNumbers[record.id] = ''
    } else {
      showToast(res.message || '提交失败')
    }
  } catch (error: any) {
    console.error('提交资金号失败:', error)
    showToast(error.message || '提交失败')
  }
}

// 删除订单（两步确认）
const handleDelete = async (record: any) => {
  // 检查是否已处于确认状态
  const isConfirming = confirmingIds.value.includes(record.id)
  
  if (isConfirming) {
    // 第二步：确认删除，执行软删除
    try {
      const res = await del(`/user/orders/${record.id}`, { userId: getUserId() })
      if (res.code === 0) {
        showToast('已移至回收站')
        // 从列表中移除
        const index = records.value.findIndex(r => r.id === record.id)
        if (index > -1) {
          records.value.splice(index, 1)
        }
        // 更新统计
        overview.total--
        const statusKey = record.status === 'pending_payment' ? 'pendingPayment' : record.status
        if (overview[statusKey as keyof typeof overview]) {
          (overview[statusKey as keyof typeof overview] as number)--
        }
      } else {
        showToast(res.message || '删除失败')
      }
    } catch (error: any) {
      console.error('删除订单失败:', error)
      showToast(error.message || '删除失败')
    } finally {
      // 移除确认状态
      const idx = confirmingIds.value.indexOf(record.id)
      if (idx > -1) {
        confirmingIds.value.splice(idx, 1)
      }
    }
  } else {
    // 第一步：仅允许删除待审核状态的订单
    if (record.status !== 'pending') {
      showToast('仅支持删除待审核状态的订单')
      return
    }
    // 标记正在切换状态，防止close事件清除确认状态
    switchingIds.value.push(record.id)
    // 进入确认状态
    confirmingIds.value.push(record.id)
    // 保持侧拉菜单打开状态（延迟执行确保DOM更新后再打开）
    setTimeout(() => {
      const swipeCell = swipeCellRefs[record.id]
      if (swipeCell && swipeCell.open) {
        swipeCell.open('right')
      }
      // 清除切换状态标记
      const idx = switchingIds.value.indexOf(record.id)
      if (idx > -1) {
        switchingIds.value.splice(idx, 1)
      }
    }, 50)
  }
}

// 打开回收站
const openRecycleBin = async () => {
  await loadDeletedOrders()
  showRecycleBin.value = true
}

// 加载已删除订单
const loadDeletedOrders = async () => {
  try {
    const res = await get<any>('/user/orders/deleted', { userId: getUserId() })
    if (res.code === 0) {
      deletedOrders.value = res.data || []
    }
  } catch (error) {
    console.error('获取已删除订单失败:', error)
  }
}

// 恢复订单
const handleRestore = async (order: any) => {
  if (!order) {
    showToast('请选择要恢复的订单')
    return
  }
  
  try {
    const res = await post(`/user/orders/${order.id}/restore`, { userId: getUserId() })
    if (res.code === 0) {
      showToast('恢复成功')
      // 从回收站移除
      const index = deletedOrders.value.findIndex(o => o.id === order.id)
      if (index > -1) {
        deletedOrders.value.splice(index, 1)
      }
      // 刷新订单列表
      initData()
    } else {
      showToast(res.message || '恢复失败')
    }
  } catch (error: any) {
    console.error('恢复订单失败:', error)
    showToast(error.message || '恢复失败')
  }
}

// Tab 切换
const onTabChange = () => {
  page.value = 1
  records.value = []
  finished.value = false
  loading.value = true
  loadRecords()
}

// 初始化加载
const initData = () => {
  page.value = 1
  records.value = []
  finished.value = false
  loading.value = false
  isLoading = false
  loadStats()
  loadRecords()
}

onMounted(() => {
  initData()
})

onActivated(() => {
  initData()
})
</script>

<style scoped lang="scss">
.commission-page {
  min-height: 100%;
  background-color: #f7f8fa;
}

// 佣金概览
.commission-overview {
  padding: 12px 16px;
}

.overview-card {
  background: linear-gradient(135deg, #1989fa 0%, #4fc3f7 100%);
  border-radius: 12px;
  padding: 24px 20px;
  color: #ffffff;
}

.total-commission {
  text-align: center;
  margin-bottom: 20px;

  .label {
    display: block;
    font-size: 13px;
    opacity: 0.8;
    margin-bottom: 8px;
  }

  .amount {
    display: block;
    font-size: 36px;
    font-weight: 700;
  }
}

.commission-details {
  display: flex;
  justify-content: space-around;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);

  .detail-item {
    text-align: center;

    .value {
      display: block;
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .label {
      font-size: 12px;
      opacity: 0.8;
    }
  }
}

// 记录列表
.record-list {
  padding: 0 12px;
}

.record-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #ffffff;
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 8px;
}

.record-left {
  flex: 1;
  min-width: 0;
}

.record-title {
  font-size: 14px;
  font-weight: 500;
  color: #323233;
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.record-user-info {
  font-size: 12px;
  color: #646566;
  margin-bottom: 4px;
}

.record-time {
  font-size: 12px;
  color: #969799;
  display: block;
  margin-bottom: 2px;
}

.reject-reason {
  font-size: 12px;
  color: #ee0a24;
  display: block;
  margin-top: 4px;
}

.record-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
  margin-left: 12px;
}

.record-price {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

// 侧拉菜单样式（微信风格）
:deep(.van-swipe-cell__right) {
  display: flex;
  align-items: stretch;
  height: 100%;
}

.swipe-actions {
  display: flex;
  align-items: stretch;
  height: 100%;
  width: 100%;
  
  :deep(.van-button) {
    flex: 1;
    height: 100%;
    border-radius: 0;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    font-size: 14px;
    font-weight: 500;
    
    &.van-button--danger {
      background-color: #ee0a24;
      color: #ffffff;
    }
    
    &.van-button--warning {
      background-color: #ff976a;
      color: #ffffff;
    }
    
    &.van-button--primary {
      background-color: #1989fa;
      color: #ffffff;
    }
  }
}

// 资金号输入框区域
.fund-action {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  background-color: #1989fa;
}

.fund-input {
  flex: 1;
  height: 32px;
  padding: 0 12px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  background-color: #ffffff;
  color: #323233;
  outline: none;
}

.fund-input::placeholder {
  color: #969799;
}

// 回收站样式
.recycle-bin-content {
  padding: 8px 0;
}

.empty-recycle {
  text-align: center;
  padding: 32px 0;
  
  p {
    margin-top: 12px;
    font-size: 14px;
    color: #969799;
  }
}

.deleted-list {
  padding: 0 8px;
}

.deleted-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  margin-bottom: 8px;
  background-color: #f5f5f5;
  border-radius: 8px;
  border: 2px solid transparent;
  transition: all 0.2s ease;
  
  &:active {
    background-color: #ebebeb;
  }
  
  &.active {
    background-color: #e8f4fd;
    border-color: #1989fa;
    
    .deleted-title {
      color: #1989fa;
    }
  }
}

.deleted-info {
  flex: 1;
  min-width: 0;
}

.deleted-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.deleted-title {
  font-size: 15px;
  font-weight: 500;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deleted-user-info {
  font-size: 13px;
  color: #646566;
  margin-bottom: 6px;
  
  .phone-span {
    margin-left: 12px;
  }
}

.deleted-price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.deleted-price {
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

.deleted-time {
  font-size: 12px;
  color: #969799;
}

// 回收站侧拉菜单样式
.recycle-swipe-actions {
  display: flex;
  align-items: stretch;
  height: 100%;
  width: 100%;
  
  :deep(.van-button) {
    flex: 1;
    height: 100%;
    border-radius: 0;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    font-size: 14px;
    font-weight: 500;
    
    &.van-button--danger {
      background-color: #ee0a24;
      color: #ffffff;
    }
    
    &.van-button--primary {
      background-color: #1989fa;
      color: #ffffff;
    }
  }
}
</style>
