<template>
  <div class="product-list-page">
    <!-- 搜索栏 -->
    <div class="search-bar">
      <el-input
        v-model="searchKeyword"
        placeholder="请输入产品标题搜索"
        prefix-icon="Search"
        clearable
        style="width: 260px;"
        @clear="handleSearch"
        @keyup.enter="handleSearch"
      />
      <el-select
        v-model="searchStatus"
        placeholder="产品状态"
        clearable
        style="width: 140px;"
        @change="handleSearch"
      >
        <el-option label="全部" value="" />
        <el-option label="草稿" value="draft" />
        <el-option label="已发布" value="published" />
        <el-option label="已下架" value="offline" />
      </el-select>
      <el-button type="primary" icon="Search" @click="handleSearch">搜索</el-button>
      <el-button icon="Refresh" @click="handleReset">重置</el-button>
      <div style="flex: 1;" />
      <el-button type="primary" icon="Plus" @click="$router.push('/products/create')">
        新建产品
      </el-button>
    </div>

    <!-- 数据表格 -->
    <el-table
      v-loading="loading"
      :data="tableData"
      border
      stripe
      style="width: 100%;"
    >
      <el-table-column label="封面" width="100" align="center">
        <template #default="{ row }">
          <el-image
            :src="row.cover"
            :preview-src-list="[row.cover]"
            fit="cover"
            style="width: 60px; height: 60px; border-radius: 4px;"
            preview-teleported
          >
            <template #error>
              <div class="image-placeholder">
                <el-icon><Picture /></el-icon>
              </div>
            </template>
          </el-image>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="220">
        <template #default="{ row }">
          <div class="title-with-category">
            <span class="title-text">{{ row.title }}</span>
            <el-tag v-if="getCategoryLabel(row)" type="primary" size="small" class="category-tag">
              {{ getCategoryLabel(row) }}
            </el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="price" label="积分值" width="100" align="right">
        <template #default="{ row }">
          <span style="color: #f56c6c; font-weight: 500;">{{ Number(row.price || 0).toFixed(2) }}</span>
        </template>
      </el-table-column>

      <el-table-column prop="status" label="状态" width="130" align="center">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)">
            {{ statusText(row.status) }}
          </el-tag>
          <el-button
            v-if="row.status === 'admin_offline' && row.offlineReason"
            type="info"
            text
            size="small"
            style="margin-left: 4px;"
            @click="showOfflineReason(row)"
          >
            查看理由
          </el-button>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="发布时间" width="170" align="center" />
      <el-table-column label="操作" width="220" align="center" fixed="right">
        <template #default="{ row }">
          <div class="table-actions">
            <el-button type="primary" text size="small" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button
              v-if="(row.status === 'draft' || row.status === 'offline') && row.status !== 'admin_offline'"
              type="success"
              text
              size="small"
              @click="handleToggleStatus(row, 'published')"
            >
              发布
            </el-button>
            <el-button
              v-if="row.status === 'published'"
              type="warning"
              text
              size="small"
              @click="handleToggleStatus(row, 'offline')"
            >
              下架
            </el-button>
            <el-button type="danger" text size="small" @click="handleDelete(row)">
              删除
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination-container">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @size-change="fetchData"
        @current-change="fetchData"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Picture } from '@element-plus/icons-vue'
import { get, put, del } from '@promo/shared/utils/request'
import type { ProductCategory } from '@promo/shared/types'

const router = useRouter()

// 加载状态
const loading = ref(false)
const categoriesLoading = ref(false)

// 搜索条件
const searchKeyword = ref('')
const searchStatus = ref('')

// 分类数据
const categories = ref<ProductCategory[]>([])

// 分页数据
const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

// 产品状态类型
type ProductStatus = 'draft' | 'published' | 'offline' | 'admin_offline'

// 产品数据接口
interface Product {
  id: string
  title: string
  cover: string
  coverImage: string
  price: number
  commission: number
  status: ProductStatus
  createdAt: string
  publishedAt: string
  offlineReason?: string
  category?: string
  categoryId?: string
  categoryNameSnapshot?: string
}

// 获取分类中文名称
const getCategoryLabel = (product: Product): string => {
  // 优先使用分类名称快照
  if (product.categoryNameSnapshot) {
    return product.categoryNameSnapshot
  }
  // 其次查找分类数据
  if (product.category) {
    const category = categories.value.find(c => c.value === product.category)
    if (category) return category.name
  }
  // 未分类
  return '未分类'
}

// 表格数据
const tableData = ref<Product[]>([])

// 获取状态标签类型
const statusTagType = (status: ProductStatus) => {
  const map: Record<ProductStatus, string> = {
    draft: 'info',
    published: 'success',
    offline: 'danger',
    admin_offline: 'danger'
  }
  return map[status]
}

// 获取状态文本
const statusText = (status: ProductStatus) => {
  const map: Record<ProductStatus, string> = {
    draft: '草稿',
    published: '已发布',
    offline: '已下架',
    admin_offline: '被管理员下架'
  }
  return map[status]
}

// 获取当前经理 ID
const getManagerId = () => {
  try {
    const info = JSON.parse(localStorage.getItem('manager_info') || '{}')
    return info.id || ''
  } catch {
    return ''
  }
}

// 获取分类列表
const fetchCategories = async () => {
  categoriesLoading.value = true
  try {
    const res = await get<{ list: ProductCategory[] }>('/categories')
    if (res.data?.list) {
      categories.value = res.data.list
    }
  } catch (error) {
    console.error('获取分类失败:', error)
  } finally {
    categoriesLoading.value = false
  }
}

// 获取产品列表数据
const fetchData = async () => {
  loading.value = true
  try {
    const res = await get<any>('/products', {
      page: pagination.page,
      pageSize: pagination.pageSize,
      status: searchStatus.value || undefined,
      managerId: getManagerId() || undefined,
      keyword: searchKeyword.value || undefined,
    })
    const { list, total } = res.data
    // 映射字段：coverImage -> cover
    tableData.value = list.map((p: any) => ({
      ...p,
      cover: p.coverImage || p.cover || '',
      commission: p.commission || 0,
    }))
    pagination.total = total
  } catch (error: any) {
    console.error('获取产品列表失败:', error)
    ElMessage.error(error.message || '获取产品列表失败')
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  fetchData()
}

// 重置搜索
const handleReset = () => {
  searchKeyword.value = ''
  searchStatus.value = ''
  pagination.page = 1
  fetchData()
}

// 编辑产品
const handleEdit = (row: Product) => {
  router.push(`/products/${row.id}/edit`)
}

// 切换产品状态（发布/下架）
const handleToggleStatus = async (row: Product, newStatus: ProductStatus) => {
  const statusLabel = newStatus === 'published' ? '发布' : '下架'
  try {
    await ElMessageBox.confirm(
      `确定要${statusLabel}产品「${row.title}」吗？`,
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await put(`/products/${row.id}`, { status: newStatus, managerId: getManagerId() })
    ElMessage.success(`${statusLabel}成功`)
    fetchData()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '操作失败')
    }
  }
}

// 查看管理员下架理由
const showOfflineReason = (row: Product) => {
  ElMessageBox.alert(row.offlineReason || '未提供理由', '管理员下架理由', {
    confirmButtonText: '知道了',
    type: 'warning',
  })
}

// 删除产品
const handleDelete = async (row: Product) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除产品「${row.title}」吗？删除后不可恢复。`,
      '警告',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'error'
      }
    )
    const url = `/products/${row.id}?managerId=${getManagerId()}`
    console.log('[删除产品] 发送请求:', url)
    const res = await del<any>(url)
    console.log('[删除产品] 响应:', res)
    ElMessage.success('删除成功')
    fetchData()
  } catch (error: any) {
    console.error('[删除产品] 失败:', error)
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

onMounted(() => {
  fetchCategories()
  fetchData()
})
</script>

<style lang="scss" scoped>
.product-list-page {
  .image-placeholder {
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f5f7fa;
    border-radius: 4px;
    color: #c0c4cc;
    font-size: 24px;
  }

  .pagination-container {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }

  .title-with-category {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .title-text {
      font-size: 14px;
      color: #303133;
    }

    .category-tag {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 2px;
    }
  }
}
</style>
