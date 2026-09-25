import { logger } from '@promo/shared/utils/logger'
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { get } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import { maskName, maskPhone } from '../utils'

/**
 * 佣金管理页：筛选、分页、统计与选项数据的获取逻辑
 */
export function useCommissionAdmin() {
  const loading = ref(false)
  const filterStatus = ref('')
  const filterManager = ref('')
  const filterUser = ref('')
  const filterKeyword = ref('')
  const pagination = reactive({ page: 1, pageSize: 10, total: 0 })
  const tableData = ref<any[]>([])

  // 经理列表和用户筛选选项（来自订单中"用户+团队名称"去重组合）
  const managers = ref<any[]>([])
  const userOptions = ref<{ key: string; label: string }[]>([])

  const stats = reactive({ total: 0, pending: 0, approved: 0, pendingPayment: 0, settled: 0, rejected: 0 })

  const fetchStats = async () => {
    try {
      const res = await get<any>('/orders/stats')
      if (res.data) Object.assign(stats, { total: res.data.total || 0, pending: res.data.pending || 0, approved: res.data.approved || 0, pendingPayment: res.data.pendingPayment || 0, settled: res.data.settled || 0, rejected: res.data.rejected || 0 })
    } catch (e) { logger.error(e) }
  }

  // 获取经理列表
  const fetchManagers = async () => {
    try {
      const res = await get<any>('/managers')
      if (res.data) managers.value = res.data || []
    } catch (e) { logger.error(e) }
  }

  // 获取用户筛选选项：订单中"用户+团队名称"去重组合（订单冗余了用户信息，users 表不含访客单）
  const fetchUserOptions = async () => {
    try {
      const res = await get<any>('/orders/user-options')
      const list: any[] = res.data || []
      const seen = new Set<string>()
      const options: { key: string; label: string }[] = []
      for (const o of list) {
        const key = `${o.userPhone || ''}||${o.teamName || ''}`
        if (seen.has(key)) continue
        seen.add(key)
        const name = o.userName ? maskName(o.userName) : '--'
        const phone = o.userPhone ? maskPhone(o.userPhone) : '--'
        const who = `${name} ${phone}`
        options.push({ key, label: o.teamName ? `${o.teamName}（${who}）` : who })
      }
      userOptions.value = options
    } catch (e) { logger.error(e) }
  }

  const fetchData = async () => {
    loading.value = true
    try {
      const params: any = { page: pagination.page, pageSize: pagination.pageSize }
      if (filterStatus.value) params.status = filterStatus.value
      if (filterManager.value) params.managerId = filterManager.value
      if (filterUser.value) {
        // 选项值格式: userPhone||teamName，按用户手机号+团队名称精确筛选
        const [phone, team] = filterUser.value.split('||')
        if (phone) params.userPhone = phone
        if (team) params.teamName = team
      }
      if (filterKeyword.value) params.keyword = filterKeyword.value
      const res = await get<any>('/orders', params)
      if (res.data) { tableData.value = res.data.list || []; pagination.total = res.data.total || 0 }
    } catch (e) { ElMessage.error(getErrorMessage(e, '获取失败')) }
    finally { loading.value = false }
  }

  const handleReset = () => { filterStatus.value = ''; filterManager.value = ''; filterUser.value = ''; filterKeyword.value = ''; pagination.page = 1; fetchData() }

  // 订单变更（删除/编辑团队名称）后统一刷新列表、统计与用户选项
  const refreshAll = () => { fetchData(); fetchStats(); fetchUserOptions() }

  onMounted(() => { fetchStats(); fetchData(); fetchManagers(); fetchUserOptions() })

  return {
    loading,
    filterStatus,
    filterManager,
    filterUser,
    filterKeyword,
    pagination,
    tableData,
    managers,
    userOptions,
    stats,
    fetchData,
    handleReset,
    refreshAll,
  }
}
