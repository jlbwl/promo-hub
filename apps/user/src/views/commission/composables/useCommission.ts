import { logger } from '@promo/shared/utils/logger'
import { ref, reactive, onMounted, onActivated } from 'vue'
import { showToast } from 'vant'
import { get, post } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import { getUserId, getEmployeeId, isEmployee } from '../utils'
import type { Order, OrderStats } from '@promo/shared/types'

/**
 * 佣金页：概览统计、订单分页加载、回收站的数据获取与业务逻辑
 */
export function useCommission() {
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
  const records = ref<Order[]>([])

  // 防止重复加载
  let isLoading = false

  // 回收站相关
  const showRecycleBin = ref(false)
  const deletedOrders = ref<Order[]>([])

  // 加载统计数据
  const loadStats = async () => {
    try {
      const params: {
        employeeId?: string
        userId?: string
      } = {}
      if (isEmployee()) {
        params.employeeId = getEmployeeId()
      } else {
        params.userId = getUserId()
      }
      const res = await get<OrderStats>('/orders/stats', params)
      if (res.data) {
        overview.total = res.data.total || 0
        overview.pending = res.data.pending || 0
        overview.approved = res.data.approved || 0
        overview.pendingPayment = res.data.pendingPayment || 0
        overview.settled = res.data.settled || 0
        overview.rejected = res.data.rejected || 0
      }
    } catch (error) {
      logger.error('获取统计失败:', error)
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
      const params: {
        page: number
        pageSize: number
        employeeId?: string
        userId?: string
        status?: string
      } = {
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

      const res = await get<{ list: Order[]; total: number }>('/orders', params)
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
      logger.error('获取订单失败:', error)
      finished.value = true
    } finally {
      loading.value = false
      isLoading = false
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
      const res = await get<Order[]>('/user/orders/deleted', { userId: getUserId() })
      if (res.code === 0) {
        deletedOrders.value = res.data || []
      }
    } catch (error) {
      logger.error('获取已删除订单失败:', error)
    }
  }

  // 恢复订单
  const handleRestore = async (order: Order) => {
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
    } catch (error) {
      logger.error('恢复订单失败:', error)
      showToast(getErrorMessage(error, '恢复失败'))
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

  return {
    activeTab,
    loading,
    finished,
    overview,
    records,
    showRecycleBin,
    deletedOrders,
    loadRecords,
    onTabChange,
    openRecycleBin,
    handleRestore,
  }
}
