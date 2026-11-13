import { computed, reactive, ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { del, get, post, put } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import {
  buildCustomerExportWorkbook,
  buildCustomerTemplateWorkbook,
  downloadWorkbook,
  readCustomerViewMode,
  saveCustomerViewMode,
  todayStamp,
  CARD_PAGE_SIZE,
  CARD_PAGE_SIZES,
  TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZES,
  type CustomerItem,
  type CustomerViewMode,
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

  // 视图切换：默认表格，用户选择写入 localStorage
  const viewMode = ref<CustomerViewMode>(readCustomerViewMode())

  const pagination = reactive({
    page: 1,
    pageSize: viewMode.value === 'card' ? CARD_PAGE_SIZE : TABLE_PAGE_SIZE,
    total: 0,
  })

  // 两套页大小选项共用同一个分页对象，切换视图时同步重置页码与页大小
  const pageSizes = computed(() => (viewMode.value === 'card' ? CARD_PAGE_SIZES : TABLE_PAGE_SIZES))

  const setViewMode = (mode: CustomerViewMode): void => {
    if (mode === viewMode.value) return
    viewMode.value = mode
    saveCustomerViewMode(mode)
    pagination.pageSize = mode === 'card' ? CARD_PAGE_SIZE : TABLE_PAGE_SIZE
    pagination.page = 1
    loadData()
  }

  // 排序：仅使用次数走后端排序，空值表示使用默认排序
  const sortBy = ref<'' | 'searchCount'>('')
  const sortOrder = ref<'' | 'asc' | 'desc'>('')

  const tableData = ref<CustomerItem[]>([])

  const buildFilters = () => ({
    keyword: searchKeyword.value || undefined,
    payMethod: searchPayMethod.value || undefined,
    status: searchStatus.value || undefined,
  })

  const loadData = async () => {
    loading.value = true
    try {
      const params: Record<string, string | number | undefined> = {
        ...buildFilters(),
        page: pagination.page,
        pageSize: pagination.pageSize,
      }
      if (sortBy.value) {
        params.sortBy = sortBy.value
        params.sortOrder = sortOrder.value
      }
      const res = await get<{ list: CustomerItem[]; total: number; page: number; pageSize: number }>(
        '/admin/customers',
        params
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
    sortBy.value = ''
    sortOrder.value = ''
    pagination.page = 1
    loadData()
  }

  /** el-table 的 sort-change：只有使用次数走后端排序，取消排序时回到默认顺序 */
  const handleSortChange = (payload: { prop?: string; order?: string | null }): void => {
    if (payload.prop === 'searchCount' && (payload.order === 'ascending' || payload.order === 'descending')) {
      sortBy.value = 'searchCount'
      sortOrder.value = payload.order === 'ascending' ? 'asc' : 'desc'
    } else {
      sortBy.value = ''
      sortOrder.value = ''
    }
    pagination.page = 1
    loadData()
  }

  /**
   * 单客户换码：先上传拿地址，再回写客户记录。
   * 失败信息沿用后端分档文案（格式不支持 / 超 5MB / 存储不可用）。
   */
  const replaceQrcode = async (row: CustomerItem, file: File): Promise<void> => {
    try {
      const formData = new FormData()
      formData.append('file', file, file.name)
      const res = await post<{ url: string }>('/admin/customers/qrcode/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const url = res.data?.url
      if (!url) {
        ElMessage.error('收款码上传失败：未返回图片地址')
        return
      }
      await put(`/admin/customers/${row.id}/qrcode`, { url })
      ElMessage.success('收款码已更新')
      await loadData()
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '收款码更新失败'))
    }
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
    pageSizes,
    tableData,
    viewMode,
    setViewMode,
    loadData,
    handleSearch,
    handleReset,
    handleSortChange,
    replaceQrcode,
    saveCustomer,
    handleDelete,
    exportCustomers,
    downloadTemplate,
  }
}
