import { logger } from '@promo/shared/utils/logger'
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { get, put } from '@promo/shared/utils/request'
import { getErrorMessage } from '@promo/shared/utils/errors'
import { appendQrCodeToWorkbook, createDispatchWorkbook, downloadWorkbook } from '../utils'
import type { QrCodeItem } from '../utils'
import type { Product, ProductCategory } from '@promo/shared/types'

/**
 * 分类管理页：分类列表加载、归档/启用切换与一键派单导出
 */
export function useCategoryAdmin() {
  // 加载状态
  const loading = ref(false)

  // 表格数据
  const tableData = ref<ProductCategory[]>([])

  // 加载数据
  const loadData = async () => {
    loading.value = true
    try {
      const res = await get<{ list: ProductCategory[] }>('/categories', { includeArchived: 'true' })
      tableData.value = res.data?.list || []
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '获取数据失败'))
    } finally {
      loading.value = false
    }
  }

  // 切换状态
  const handleToggleStatus = async (row: ProductCategory) => {
    const newStatus = row.status === 'active' ? 'archived' : 'active'
    const action = newStatus === 'active' ? '启用' : '归档'
    try {
      await ElMessageBox.confirm(`确定要${action}分类「${row.name}」吗？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      if (newStatus === 'archived') {
        await import('@promo/shared/utils/request').then(({ del }) => del(`/categories/${row.id}`))
      } else {
        await put(`/categories/${row.id}`, { status: newStatus })
      }
      ElMessage.success(`${action}成功`)
      loadData()
    } catch (error) {
      if (error !== 'cancel') {
        ElMessage.error(getErrorMessage(error, '操作失败'))
      }
    }
  }

  // 一键派单导出Excel（fallbackQrDataUrl 为默认二维码获取失败时的回退图片）
  const exportProducts = async (fallbackQrDataUrl: string) => {
    try {
      const res = await get<{ list: Product[] }>('/products', { adminMode: 'true', status: 'published', page: '1', pageSize: '1000' })
      const products = res.data?.list || []

      if (products.length === 0) {
        ElMessage.info('暂无开放的产品')
        return
      }

      const categories = await get<{ list: ProductCategory[] }>('/categories')

      const workbook = createDispatchWorkbook(products, categories.data?.list || [])

      let currentQrCodeDataUrl = fallbackQrDataUrl
      try {
        const qrRes = await get<QrCodeItem>('/admin/qrcodes/default')
        if (qrRes.data && qrRes.data.dataUrl) {
          currentQrCodeDataUrl = qrRes.data.dataUrl
        }
      } catch (error) {
        logger.error('获取默认二维码失败:', error)
      }

      appendQrCodeToWorkbook(workbook, currentQrCodeDataUrl)

      const today = new Date()
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const fileName = `派单表_${dateStr}.xlsx`

      await downloadWorkbook(workbook, fileName)

      ElMessage.success('派单表导出成功')
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '导出失败'))
    }
  }

  onMounted(() => {
    loadData()
  })

  return {
    loading,
    tableData,
    loadData,
    handleToggleStatus,
    exportProducts,
  }
}
