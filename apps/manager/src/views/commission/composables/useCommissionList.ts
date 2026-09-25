import { logger } from '@promo/shared/utils/logger'
import { getErrorMessage } from '@promo/shared/utils/errors'
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { get, put } from '@promo/shared/utils/request'
import { getManagerId } from '../utils'
import type { Order, OrderStats, PaginatedResponse } from '@promo/shared/types'

/**
 * 佣金管理页：筛选、分页、统计与订单审核/添加待发放操作逻辑
 */
export function useCommissionList() {
  // 加载状态
  const loading = ref(false)

  // 筛选状态
  const filterStatus = ref('')
  const filterKeyword = ref('')

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
  const tableData = ref<Order[]>([])

  // 获取统计数据
  const fetchStats = async () => {
    try {
      const res = await get<OrderStats>('/orders/stats', {
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
      logger.error('获取统计数据失败:', error)
    }
  }

  // 获取订单列表
  const fetchData = async () => {
    loading.value = true
    try {
      const res = await get<PaginatedResponse<Order>>('/orders', {
        page: pagination.page,
        pageSize: pagination.pageSize,
        managerId: getManagerId() || undefined,
        status: filterStatus.value || undefined,
        keyword: filterKeyword.value || undefined,
      })
      if (res.data) {
        const { list, total } = res.data
        tableData.value = list || []
        pagination.total = total || 0
      }
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '获取订单列表失败'))
    } finally {
      loading.value = false
    }
  }

  // 重置筛选
  const handleReset = () => {
    filterStatus.value = ''
    filterKeyword.value = ''
    pagination.page = 1
    fetchData()
  }

  // 审核通过
  const handleApprove = async (row: Order) => {
    try {
      await ElMessageBox.confirm(
        `确认「${row.productName}」记录有效，发放记录 ¥${row.productPrice}？`,
        '审核确认',
        { confirmButtonText: '通过', cancelButtonText: '取消', type: 'success' }
      )
      await put(`/orders/${row.id}/review`, { action: 'approve' })
      ElMessage.success('已确认记录有效，记录待发放')
      fetchStats()
      fetchData()
    } catch (error) {
      if (error !== 'cancel') {
        const message = getErrorMessage(error, '')
        if (message) {
          ElMessage.error(message)
        }
      }
    }
  }

  // 驳回申请
  const handleReject = async (row: Order) => {
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
    } catch (error) {
      if (error !== 'cancel') {
        const message = getErrorMessage(error, '')
        if (message) {
          ElMessage.error(message)
        }
      }
    }
  }

  // 添加到待付款
  const handleAddToPayment = async (row: Order) => {
    try {
      await ElMessageBox.confirm(
        `确认将「${row.productName}」添加到待发放列表？`,
        '添加到待发放',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'info' }
      )
      await put(`/orders/${row.id}/settle`, { action: 'pending_payment' })
      ElMessage.success('已添加到待发放')
      fetchStats()
      fetchData()
    } catch (error) {
      if (error !== 'cancel') {
        const message = getErrorMessage(error, '')
        if (message) {
          ElMessage.error(message)
        }
      }
    }
  }

  onMounted(() => {
    fetchStats()
    fetchData()
  })

  return {
    loading,
    filterStatus,
    filterKeyword,
    pagination,
    stats,
    tableData,
    fetchStats,
    fetchData,
    handleReset,
    handleApprove,
    handleReject,
    handleAddToPayment,
  }
}
