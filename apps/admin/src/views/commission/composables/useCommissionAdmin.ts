import { logger } from '@promo/shared/utils/logger'
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { get } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import type { Manager, Order, OrderStats, PaginatedResponse } from '@promo/shared/types'

// 团队筛选选项：订单中 teamName 去重后的列表项
interface TeamOptionItem {
  teamName?: string
}

// /orders 列表查询参数
interface OrderQueryParams {
  page: number
  pageSize: number
  status?: string
  managerId?: string
  teamName?: string
  keyword?: string
}

/**
 * 佣金管理页：筛选、分页、统计与选项数据的获取逻辑
 */
export function useCommissionAdmin() {
  const loading = ref(false)
  const filterStatus = ref('')
  const filterManager = ref('')
  const filterTeam = ref('')
  const filterKeyword = ref('')
  const pagination = reactive({ page: 1, pageSize: 10, total: 0 })
  const tableData = ref<Order[]>([])

  // 经理列表和团队筛选选项（来自订单中 teamName 去重）
  const managers = ref<Manager[]>([])
  const teamOptions = ref<{ key: string; label: string }[]>([])

  const stats = reactive({ total: 0, pending: 0, approved: 0, pendingPayment: 0, settled: 0, rejected: 0 })

  const fetchStats = async () => {
    try {
      const res = await get<OrderStats>('/orders/stats')
      if (res.data) Object.assign(stats, { total: res.data.total || 0, pending: res.data.pending || 0, approved: res.data.approved || 0, pendingPayment: res.data.pendingPayment || 0, settled: res.data.settled || 0, rejected: res.data.rejected || 0 })
    } catch (e) { logger.error(e) }
  }

  // 获取经理列表
  const fetchManagers = async () => {
    try {
      const res = await get<Manager[]>('/managers')
      if (res.data) managers.value = res.data || []
    } catch (e) { logger.error(e) }
  }

  // 获取团队筛选选项：订单中 teamName 去重列表（订单冗余了用户信息，users 表不含访客单）
  const fetchTeamOptions = async () => {
    try {
      const res = await get<TeamOptionItem[]>('/orders/user-options')
      const list: TeamOptionItem[] = res.data || []
      const seen = new Set<string>()
      const options: { key: string; label: string }[] = []
      for (const o of list) {
        const team = (o.teamName || '').trim()
        if (!team || seen.has(team)) continue
        seen.add(team)
        options.push({ key: team, label: team })
      }
      teamOptions.value = options
    } catch (e) { logger.error(e) }
  }

  const fetchData = async () => {
    loading.value = true
    try {
      const params: OrderQueryParams = { page: pagination.page, pageSize: pagination.pageSize }
      if (filterStatus.value) params.status = filterStatus.value
      if (filterManager.value) params.managerId = filterManager.value
      // 选项值即 teamName，按团队名称精确筛选
      if (filterTeam.value) params.teamName = filterTeam.value
      if (filterKeyword.value) params.keyword = filterKeyword.value
      const res = await get<PaginatedResponse<Order>>('/orders', params)
      if (res.data) { tableData.value = res.data.list || []; pagination.total = res.data.total || 0 }
    } catch (e) { ElMessage.error(getErrorMessage(e, '获取失败')) }
    finally { loading.value = false }
  }

  const handleReset = () => { filterStatus.value = ''; filterManager.value = ''; filterTeam.value = ''; filterKeyword.value = ''; pagination.page = 1; fetchData() }

  // 订单变更（删除/编辑团队名称）后统一刷新列表、统计与团队选项
  const refreshAll = () => { fetchData(); fetchStats(); fetchTeamOptions() }

  onMounted(() => { fetchStats(); fetchData(); fetchManagers(); fetchTeamOptions() })

  return {
    loading,
    filterStatus,
    filterManager,
    filterTeam,
    filterKeyword,
    pagination,
    tableData,
    managers,
    teamOptions,
    stats,
    fetchData,
    handleReset,
    refreshAll,
  }
}
