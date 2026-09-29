import { logger } from '@promo/shared/utils/logger'
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { get, post, put, del } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import type { Manager } from '@promo/shared/types'

export function useManagerList() {
  // 搜索关键词
  const searchKeyword = ref('')
  // 加载状态
  const loading = ref(false)

  // 表格数据
  const tableData = ref<Manager[]>([])

  // 过滤后的数据
  const filteredData = computed(() => {
    if (!searchKeyword.value) return tableData.value
    const keyword = searchKeyword.value.toLowerCase()
    return tableData.value.filter(
      (item: Manager) =>
        (item.teamName || '').toLowerCase().includes(keyword) ||
        (item.phone || '').includes(keyword)
    )
  })

  // 添加弹窗
  const addDialogVisible = ref(false)
  const addLoading = ref(false)
  const addFormRef = ref<FormInstance>()
  const addForm = reactive({
    teamName: '',
    password: '',
    phone: ''
  })

  // 修改渠道名称弹窗
  const teamNameDialogVisible = ref(false)
  const teamNameLoading = ref(false)
  const teamNameForm = reactive({
    teamName: ''
  })
  const editRow = ref<Manager | null>(null)

  // 短信验证码相关
  const deleteRow = ref<Manager | null>(null)
  const deleteSmsDialogVisible = ref(false)
  const smsCode = ref('')
  const smsLoading = ref(false)
  const smsCooldown = ref(0)

  const addFormRules: FormRules = {
    teamName: [
      { required: true, message: '请输入渠道名称', trigger: 'blur' }
    ],
    password: [
      { required: true, message: '请输入密码', trigger: 'blur' },
      { min: 6, max: 20, message: '密码长度在 6 到 20 个字符', trigger: 'blur' }
    ],
    phone: [
      { required: true, message: '请输入手机号', trigger: 'blur' },
      { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
    ]
  }

  // 加载数据
  const loadData = async () => {
    loading.value = true
    try {
      const res = await get<Manager[]>('/managers')
      tableData.value = res.data || []
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '获取数据失败'))
    } finally {
      loading.value = false
    }
  }

  // 搜索
  const handleSearch = () => {
    // 前端过滤，无需重新请求
  }

  // 显示添加弹窗
  const showAddDialog = () => {
    addDialogVisible.value = true
  }

  // 重置表单
  const resetAddForm = () => {
    addForm.teamName = ''
    addForm.password = ''
    addForm.phone = ''
    addFormRef.value?.resetFields()
  }

  // 添加经理
  const handleAdd = async () => {
    if (!addFormRef.value) return
    try {
      await addFormRef.value.validate()
      addLoading.value = true
      await post('/managers', {
        teamName: addForm.teamName,
        password: addForm.password,
        phone: addForm.phone,
      })
      ElMessage.success('添加成功')
      addDialogVisible.value = false
      loadData()
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '添加失败'))
    } finally {
      addLoading.value = false
    }
  }

  // 切换渠道状态
  const handleToggleManagerStatus = async (row: Manager, newStatus: string) => {
    if (row.status === newStatus) return

    const action = newStatus === 'active' ? '启用' : '禁用'
    try {
      await ElMessageBox.confirm(`确定要${action}渠道「${row.teamName}」吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await put(`/managers/${row.id}`, { status: newStatus === 'active' ? 'active' : 'inactive' })
      ElMessage.success(`${action}成功`)
      loadData()
    } catch (error) {
      if (error !== 'cancel') {
        ElMessage.error(getErrorMessage(error, '操作失败'))
      }
    }
  }

  // 删除
  const handleDelete = async (row: Manager) => {
    try {
      await ElMessageBox.confirm(
        `删除后将清空该渠道「${row.teamName}」的所有档案，且数据不可找回，确定要删除吗？`,
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
      const res = await del(`/managers/${deleteRow.value.id}?smsCode=${smsCode.value}`)
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

  // 修改渠道名称
  const handleEditTeamName = (row: Manager) => {
    editRow.value = row
    teamNameForm.teamName = row.teamName || ''
    teamNameDialogVisible.value = true
  }

  // 保存渠道名称
  const handleSaveTeamName = async () => {
    if (!teamNameForm.teamName.trim()) {
      ElMessage.warning('请输入渠道名称')
      return
    }
    if (!editRow.value) return

    logger.debug('[调试] 开始保存渠道名称:', {
      id: editRow.value.id,
      newTeamName: teamNameForm.teamName.trim()
    })

    teamNameLoading.value = true
    try {
      await put(`/managers/${editRow.value.id}/team-name`, { teamName: teamNameForm.teamName.trim() })
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

  return {
    searchKeyword,
    loading,
    filteredData,
    addDialogVisible,
    addLoading,
    addFormRef,
    addForm,
    addFormRules,
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
    showAddDialog,
    resetAddForm,
    handleAdd,
    handleToggleManagerStatus,
    handleDelete,
    sendSmsCode,
    confirmDelete,
    handleEditTeamName,
    handleSaveTeamName
  }
}
