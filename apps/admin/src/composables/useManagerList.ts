import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { get, post, put } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import type { Manager } from '@promo/shared/types'
import { useSmsConfirm } from './useSmsConfirm'
import { useTeamNameEdit } from './useTeamNameEdit'

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

  // 修改渠道名称
  const {
    teamNameDialogVisible,
    teamNameLoading,
    teamNameForm,
    editRow,
    handleEditTeamName,
    handleSaveTeamName
  } = useTeamNameEdit<Manager>({
    nameLabel: '渠道名称',
    savePath: (id) => `/managers/${id}/team-name`,
    onSaved: () => { void loadData() }
  })

  // 删除渠道（短信二次确认）
  const {
    deleteSmsDialogVisible,
    smsCode,
    smsLoading,
    smsCooldown,
    handleDelete,
    sendSmsCode,
    confirmDelete
  } = useSmsConfirm({
    entityLabel: '渠道',
    deletePath: id => `/managers/${id}`,
    onDeleted: () => { void loadData() }
  })

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
