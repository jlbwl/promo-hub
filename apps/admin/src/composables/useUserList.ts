import { logger } from '@promo/shared/utils/logger'
import { reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { get, put, del, post } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import type { PaginatedResponse } from '@promo/shared/types'

// 用户数据类型
export interface UserItem {
  id: string
  name: string
  phone: string
  teamName: string
  role: string
  status: number
  createdAt: string
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

  // 修改团队名称弹窗
  const teamNameDialogVisible = ref(false)
  const teamNameLoading = ref(false)
  const teamNameForm = reactive({
    teamName: ''
  })
  const editRow = ref<UserItem | null>(null)

  // 短信验证码相关
  const deleteRow = ref<UserItem | null>(null)
  const deleteSmsDialogVisible = ref(false)
  const smsCode = ref('')
  const smsLoading = ref(false)
  const smsCooldown = ref(0)

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

  // 修改团队名称
  const handleEditTeamName = (row: UserItem) => {
    editRow.value = row
    teamNameForm.teamName = row.teamName || ''
    teamNameDialogVisible.value = true
  }

  // 保存团队名称
  const handleSaveTeamName = async () => {
    if (!teamNameForm.teamName.trim()) {
      ElMessage.warning('请输入团队名称')
      return
    }
    if (!editRow.value) return

    logger.debug('[调试] 开始保存团队名称:', {
      id: editRow.value.id,
      newTeamName: teamNameForm.teamName.trim()
    })

    teamNameLoading.value = true
    try {
      await put(`/users/${editRow.value.id}/team-name`, { teamName: teamNameForm.teamName.trim() })
      logger.debug('[调试] 保存成功')
      ElMessage.success('修改成功')
      teamNameDialogVisible.value = false
      loadData()
    } catch (error) {
      logger.error('[调试] 保存失败:', error)
      ElMessage.error(getErrorMessage(error, '修改失败'))
    } finally {
      teamNameLoading.value = false
    }
  }

  // 删除用户
  const handleDelete = async (row: UserItem) => {
    try {
      await ElMessageBox.confirm(
        `删除后将清空该用户「${row.teamName}」的所有档案，且数据不可找回，确定要删除吗？`,
        '危险操作',
        {
          confirmButtonText: '确定删除',
          cancelButtonText: '取消',
          type: 'error',
          confirmButtonClass: 'el-button--danger'
        }
      )

      // 显示短信验证弹窗
      deleteRow.value = row
      deleteSmsDialogVisible.value = true
    } catch (error) {
      if (error !== 'cancel') {
        ElMessage.error(getErrorMessage(error, '操作失败'))
      }
    }
  }

  // 发送验证码
  const sendSmsCode = async () => {
    if (smsCooldown.value > 0) return

    // 从 localStorage 获取管理员信息
    const adminInfo = JSON.parse(localStorage.getItem('admin_info') || '{}')
    const token = localStorage.getItem('token')
    logger.debug('[调试] 准备发送短信验证码:', {
      adminInfo,
      token: token ? '已获取' : '未获取',
      phone: adminInfo.phone
    })

    if (!adminInfo.phone) {
      ElMessage.error('未获取到管理员手机号，请重新登录')
      return
    }

    smsLoading.value = true
    try {
      logger.debug('[调试] 开始调用短信接口:', '/admin/sms/send')
      const res = await post('/admin/sms/send', { phone: adminInfo.phone })
      logger.debug('[调试] 短信接口响应:', res)
      if (res.code === 0) {
        ElMessage.success('验证码已发送')
        smsCooldown.value = 60
        const timer = setInterval(() => {
          smsCooldown.value--
          if (smsCooldown.value <= 0) {
            clearInterval(timer)
          }
        }, 1000)
      } else {
        logger.error('[调试] 短信接口返回错误:', res.message)
        ElMessage.error(res.message || '发送失败')
      }
    } catch (error) {
      logger.error('[调试] 短信接口调用异常:', error)
      ElMessage.error(getErrorMessage(error, '发送失败'))
    } finally {
      smsLoading.value = false
    }
  }

  // 确认删除
  const confirmDelete = async () => {
    if (!smsCode.value.trim() || !deleteRow.value) {
      ElMessage.warning('请输入验证码')
      return
    }

    smsLoading.value = true
    try {
      const res = await del(`/users/${deleteRow.value.id}?smsCode=${smsCode.value}`)
      if (res.code === 0) {
        ElMessage.success('删除成功')
        deleteSmsDialogVisible.value = false
        smsCode.value = ''
        deleteRow.value = null
        loadData()
      } else {
        ElMessage.error(res.message || '删除失败')
      }
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '删除失败'))
    } finally {
      smsLoading.value = false
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
