import { reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { get, put } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import type { PaginatedResponse } from '@promo/shared/types'
import { useSmsConfirm } from './useSmsConfirm'
import { useTeamNameEdit } from './useTeamNameEdit'

// 用户数据类型
export interface UserItem {
  id: string
  name: string
  phone: string
  teamName: string
  role: string
  status: number
  createdAt: string
  lastLoginAt?: string | null
}

export function useUserList() {
  // 搜索条件
  const searchKeyword = ref('')
  const searchStatus = ref<number | ''>('')
  // 加载状态
  const loading = ref(false)

  // 分页配置
  const pagination = reactive({
    page: 1,
    pageSize: 10,
    total: 0
  })

  // 表格数据
  const tableData = ref<UserItem[]>([])

  // 加载数据
  const loadData = async () => {
    loading.value = true
    try {
      const res = await get<PaginatedResponse<UserItem>>('/users', {
        page: pagination.page,
        pageSize: pagination.pageSize,
        status: searchStatus.value !== '' ? searchStatus.value : undefined,
        keyword: searchKeyword.value || undefined,
      })
      const { list, total } = res.data
      tableData.value = list || []
      pagination.total = total || 0
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '获取数据失败'))
    } finally {
      loading.value = false
    }
  }

  // 搜索处理
  const handleSearch = () => {
    pagination.page = 1
    loadData()
  }

  // 修改团队名称
  const {
    teamNameDialogVisible,
    teamNameLoading,
    teamNameForm,
    editRow,
    handleEditTeamName,
    handleSaveTeamName
  } = useTeamNameEdit<UserItem>({
    nameLabel: '团队名称',
    savePath: (id) => `/users/${id}/team-name`,
    onSaved: () => { void loadData() }
  })

  // 删除用户（短信二次确认）
  const {
    deleteSmsDialogVisible,
    smsCode,
    smsLoading,
    smsCooldown,
    handleDelete,
    sendSmsCode,
    confirmDelete
  } = useSmsConfirm({
    entityLabel: '用户',
    deletePath: (id, code) => `/users/${id}?smsCode=${code}`,
    onDeleted: () => { void loadData() }
  })

  // 切换用户角色
  const handleToggleUserRole = async (row: UserItem, newRole: string) => {
    if (row.role === newRole) return

    const roleLabel = newRole === 'user' ? '普通团队' : 'vip团队'
    try {
      await ElMessageBox.confirm(`确定要将团队「${row.teamName}」设置为${roleLabel}吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await put(`/users/${row.id}/role`, { role: newRole })
      ElMessage.success(`角色设置成功`)
      loadData()
    } catch (error) {
      if (error !== 'cancel') {
        ElMessage.error(getErrorMessage(error, '操作失败'))
      }
    }
  }

  // 切换用户状态
  const handleToggleUserStatus = async (row: UserItem, newStatus: number) => {
    if (row.status === newStatus) return

    const action = newStatus === 1 ? '启用' : '禁用'
    try {
      await ElMessageBox.confirm(`确定要${action}团队「${row.teamName}」吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await put(`/users/${row.id}/status`, { status: newStatus })
      ElMessage.success(`${action}成功`)
      loadData()
    } catch (error) {
      if (error !== 'cancel') {
        ElMessage.error(getErrorMessage(error, '操作失败'))
      }
    }
  }

  return {
    searchKeyword,
    searchStatus,
    loading,
    pagination,
    tableData,
    teamNameDialogVisible,
    teamNameLoading,
    teamNameForm,
    editRow,
    deleteSmsDialogVisible,
    smsCode,
    smsLoading,
    smsCooldown,
    loadData,
    handleSearch,
    handleToggleUserRole,
    handleToggleUserStatus,
    handleEditTeamName,
    handleSaveTeamName,
    handleDelete,
    sendSmsCode,
    confirmDelete
  }
}
