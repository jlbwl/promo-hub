import { logger } from '@promo/shared/utils/logger'
import { ref, reactive, onMounted, onActivated } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { get, post, del } from '@promo/shared/utils/request'
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

  // 下拉刷新状态
  const refreshing = ref(false)

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
    settledAmount: 0,
    rejected: 0
  })

  // 订单记录
  const records = ref<Order[]>([])

  // 请求序号：切换 Tab/下拉刷新/重新初始化时自增，用于丢弃过期响应
  let querySeq = 0

  // 进行中的订单请求数量：分页追加时若有请求未完成则忽略，避免重复请求叠加
  let inFlightCount = 0

  // 回收站相关
  const showRecycleBin = ref(false)
  const deletedOrders = ref<Order[]>([])

  // O9：统计结果短时缓存，避免 keep-alive 激活/刷新时与订单列表重复请求
  const STATS_CACHE_TTL_MS = 10_000
  let statsCache: { key: string; at: number; data: OrderStats } | null = null

  const getStatsScopeKey = () => (isEmployee() ? `e:${getEmployeeId()}` : `u:${getUserId()}`)

  // 加载统计数据；force=true 时跳过短时缓存（下拉刷新/数据变更后）
  const loadStats = async (force = false): Promise<boolean> => {
    const scopeKey = getStatsScopeKey()
    if (!force && statsCache && statsCache.key === scopeKey && Date.now() - statsCache.at < STATS_CACHE_TTL_MS) {
      applyStats(statsCache.data)
      return true
    }
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
        applyStats(res.data)
        statsCache = { key: scopeKey, at: Date.now(), data: res.data }
      }
      return true
    } catch (error) {
      logger.error('获取统计失败:', error)
      return false
    }
  }

  const applyStats = (data: OrderStats) => {
    overview.total = data.total || 0
    overview.pending = data.pending || 0
    overview.approved = data.approved || 0
    overview.pendingPayment = data.pendingPayment || 0
    overview.settled = data.settled || 0
    overview.settledAmount = data.settledAmount || 0
    overview.rejected = data.rejected || 0
  }

  // 加载订单记录
  // reset=true 用于切换 Tab/下拉刷新/重新初始化：作为一次新查询，不因已有请求而跳过
  const loadRecords = async (reset = false): Promise<boolean> => {
    // 分页追加请求：已有请求未完成时忽略，避免重复请求叠加
    if (!reset && inFlightCount > 0) {
      return true
    }
    if (reset) {
      querySeq += 1
    }
    const seq = querySeq
    inFlightCount += 1
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
      // 请求期间切换了 Tab/刷新，丢弃过期响应，避免旧 Tab 数据写入新列表
      if (seq !== querySeq) {
        return true
      }
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
      return true
    } catch (error) {
      // 过期请求的失败不打扰用户
      if (seq !== querySeq) {
        return true
      }
      logger.error('获取订单失败:', error)
      finished.value = true
      return false
    } finally {
      inFlightCount -= 1
      if (inFlightCount === 0) {
        loading.value = false
      }
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
        // 刷新订单列表（数据已变更，统计缓存一并失效）
        statsCache = null
        initData()
      } else {
        showToast(res.message || '恢复失败')
      }
    } catch (error) {
      logger.error('恢复订单失败:', error)
      showToast(getErrorMessage(error, '恢复失败'))
    }
  }

  // 永久删除订单（物理删除，不可恢复）
  const handlePurge = async (order: Order) => {
    if (!order) {
      return
    }

    try {
      await showConfirmDialog({
        title: '永久删除',
        message: '该订单将从数据库中彻底移除，且不可恢复。确定要永久删除吗？',
        confirmButtonText: '永久删除',
        cancelButtonText: '再想想'
      })
    } catch {
      return // 用户取消
    }

    try {
      const res = await del(`/user/orders/${order.id}/purge`)
      if (res.code === 0) {
        showToast('已永久删除')
        // 从回收站移除
        const index = deletedOrders.value.findIndex(o => o.id === order.id)
        if (index > -1) {
          deletedOrders.value.splice(index, 1)
        }
      } else {
        showToast(res.message || '删除失败')
      }
    } catch (error) {
      logger.error('永久删除订单失败:', error)
      showToast(getErrorMessage(error, '删除失败'))
    }
  }

  // Tab 切换：重置分页并强制发起新查询，不因上一条请求未完成而跳过
  const onTabChange = () => {
    page.value = 1
    records.value = []
    finished.value = false
    loading.value = true
    loadRecords(true)
  }

  // 初始化加载
  const initData = () => {
    page.value = 1
    records.value = []
    finished.value = false
    loadStats()
    loadRecords(true)
  }

  // 下拉刷新：重新请求统计数据与第一页订单，失败时保留已展示的数据
  const refreshData = async () => {
    if (inFlightCount > 0) {
      refreshing.value = false
      return
    }
    const prevPage = page.value
    const prevFinished = finished.value
    page.value = 1
    finished.value = false
    const [statsOk, recordsOk] = await Promise.all([loadStats(true), loadRecords(true)])
    if (!statsOk || !recordsOk) {
      // 订单请求失败时恢复分页状态，避免列表被误判为「没有更多了」
      if (!recordsOk) {
        page.value = prevPage
        finished.value = prevFinished
      }
      showToast('刷新失败，请稍后重试')
    }
    refreshing.value = false
  }

  // 页面首次挂载与 keep-alive 激活都会触发加载，跳过首次激活避免重复请求
  let skipNextActivated = false
  onMounted(() => {
    initData()
    skipNextActivated = true
  })

  onActivated(() => {
    if (skipNextActivated) {
      skipNextActivated = false
      return
    }
    initData()
  })

  return {
    activeTab,
    loading,
    finished,
    refreshing,
    overview,
    records,
    showRecycleBin,
    handlePurge,
    deletedOrders,
    loadRecords,
    refreshData,
    onTabChange,
    openRecycleBin,
    handleRestore,
  }
}
