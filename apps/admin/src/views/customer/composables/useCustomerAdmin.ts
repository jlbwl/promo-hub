import { reactive, ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { del, get, post, put } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import {
  buildCustomerExportWorkbook,
  buildCustomerTemplateWorkbook,
  downloadWorkbook,
  todayStamp,
  type CustomerItem,
} from '../utils'

export interface CustomerFormPayload {
  groupName: string
  contactName: string
  payMethod: string
  cardNo: string
  searchCount: number
  status: string
}

/**
 * 客户管理页：列表筛选分页、新增/编辑、删除、导出与模板下载。
 * 导入（预览 + 提交）由 CustomerImportDialog 自行完成，成功后回调 loadData。
 */
export function useCustomerAdmin() {
  const searchKeyword = ref('')
  const searchPayMethod = ref('')
  const searchStatus = ref('')
  const loading = ref(false)

  const pagination = reactive({
    page: 1,
    pageSize: 10,
    total: 0,
  })

  const tableData = ref<CustomerItem[]>([])

  const buildFilters = () => ({
    keyword: searchKeyword.value || undefined,
    payMethod: searchPayMethod.value || undefined,
    status: searchStatus.value || undefined,
  })

  const loadData = async () => {
    loading.value = true
    try {
      const res = await get<{ list: CustomerItem[]; total: number; page: number; pageSize: number }>(
        '/admin/customers',
        {
          ...buildFilters(),
          page: pagination.page,
          pageSize: pagination.pageSize,
        }
      )
      tableData.value = res.data?.list || []
      pagination.total = res.data?.total || 0
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '获取客户列表失败'))
    } finally {
      loading.value = false
    }
  }

  const handleSearch = () => {
    pagination.page = 1
    loadData()
  }

  const handleReset = () => {
    searchKeyword.value = ''
    searchPayMethod.value = ''
    searchStatus.value = ''
    pagination.page = 1
    loadData()
  }

  const saveCustomer = async (payload: CustomerFormPayload, id?: string) => {
    if (id) {
      await put(`/admin/customers/${id}`, payload)
    } else {
      await post('/admin/customers', payload)
    }
  }

  const handleDelete = async (row: CustomerItem) => {
    try {
      await ElMessageBox.confirm(
        `确定删除客户「${row.groupName}」吗？删除后不影响既有订单。`,
        '提示',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
      )
      await del(`/admin/customers/${row.id}`)
      ElMessage.success('删除成功')
      // 删除最后一条时回退一页，避免停留在空页
      if (tableData.value.length === 1 && pagination.page > 1) {
        pagination.page -= 1
      }
      loadData()
    } catch (error) {
      if (error !== 'cancel') {
        ElMessage.error(getErrorMessage(error, '删除失败'))
      }
    }
  }

  const exportCustomers = async () => {
    try {
      const res = await get<{ list: CustomerItem[]; total: number; truncated: boolean }>(
        '/admin/customers/export',
        buildFilters()
      )
      const list = res.data?.list || []
      if (list.length === 0) {
        ElMessage.info('没有可导出的客户')
        return
      }
      if (res.data?.truncated) {
        ElMessage.warning(`客户数量超过导出上限，本次仅导出前 ${list.length} 条`)
      }
      const workbook = await buildCustomerExportWorkbook(list)
      await downloadWorkbook(workbook, `客户预设_${todayStamp()}.xlsx`)
      ElMessage.success('导出成功')
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '导出失败'))
    }
  }

  const downloadTemplate = async () => {
    try {
      const workbook = await buildCustomerTemplateWorkbook()
      await downloadWorkbook(workbook, '客户预设导入模板.xlsx')
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '模板下载失败'))
    }
  }

  onMounted(() => {
    loadData()
  })

  return {
    searchKeyword,
    searchPayMethod,
    searchStatus,
    loading,
    pagination,
    tableData,
    loadData,
    handleSearch,
    handleReset,
    saveCustomer,
    handleDelete,
    exportCustomers,
    downloadTemplate,
  }
}
