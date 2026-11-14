<template>
  <div class="product-list-page">
    <!-- 搜索栏（桌面） -->
    <div
      v-if="!isMobile"
      class="search-bar"
    >
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
        <el-option
          label="全部"
          value=""
        />
        <el-option
          label="草稿"
          value="draft"
        />
        <el-option
          label="已发布"
          value="published"
        />
        <el-option
          label="已下架"
          value="offline"
        />
      </el-select>
      <el-button
        type="primary"
        icon="Search"
        @click="handleSearch"
      >
        搜索
      </el-button>
      <el-button
        icon="Refresh"
        @click="handleReset"
      >
        重置
      </el-button>
      <div style="flex: 1;" />
      <el-button
        type="primary"
        icon="Plus"
        @click="$router.push('/products/create')"
      >
        新建产品
      </el-button>
    </div>

    <!-- 搜索栏（移动端）：纵向堆叠，筛选与新建按钮铺满宽度 -->
    <div
      v-else
      class="search-bar search-bar--mobile"
    >
      <el-input
        v-model="searchKeyword"
        placeholder="请输入产品标题搜索"
        prefix-icon="Search"
        clearable
        @clear="handleSearch"
        @keyup.enter="handleSearch"
      />
      <div class="mobile-filter-row">
        <el-select
          v-model="searchStatus"
          placeholder="产品状态"
          clearable
          @change="handleSearch"
        >
          <el-option
            label="全部"
            value=""
          />
          <el-option
            label="草稿"
            value="draft"
          />
          <el-option
            label="已发布"
            value="published"
          />
          <el-option
            label="已下架"
            value="offline"
          />
        </el-select>
        <el-button
          type="primary"
          icon="Search"
          @click="handleSearch"
        >
          搜索
        </el-button>
        <el-button
          icon="Refresh"
          @click="handleReset"
        >
          重置
        </el-button>
      </div>
      <el-button
        type="primary"
        icon="Plus"
        class="mobile-create-btn"
        @click="$router.push('/products/create')"
      >
        新建产品
      </el-button>
    </div>

    <!-- 数据表格（桌面） -->
    <el-table
      v-if="!isMobile"
      v-loading="loading"
      :data="tableData"
      border
      stripe
      style="width: 100%;"
    >
      <el-table-column
        label="封面"
        width="100"
        align="center"
      >
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
      <el-table-column
        prop="title"
        label="标题"
        min-width="220"
      >
        <template #default="{ row }">
          <div class="title-with-category">
            <span class="title-text">{{ row.title }}</span>
            <el-tag
              v-if="getCategoryLabel(row)"
              type="primary"
              size="small"
              class="category-tag"
            >
              {{ getCategoryLabel(row) }}
            </el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column
        prop="price"
        label="推广费"
        width="100"
        align="right"
      >
        <template #default="{ row }">
          <span style="color: #f56c6c; font-weight: 500;">{{ Number(row.price || 0).toFixed(2) }}</span>
        </template>
      </el-table-column>

      <el-table-column
        prop="status"
        label="状态"
        width="130"
        align="center"
      >
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
      <el-table-column
        prop="createdAt"
        label="发布时间"
        width="170"
        align="center"
      />
      <el-table-column
        label="操作"
        width="220"
        align="center"
        fixed="right"
      >
        <template #default="{ row }">
          <div class="table-actions">
            <el-button
              type="primary"
              text
              size="small"
              @click="handleEdit(row)"
            >
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
            <el-button
              type="danger"
              text
              size="small"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <!-- 移动端：卡片列表 + 加载更多 -->
    <div
      v-else
      class="product-cards"
    >
      <!-- 首屏骨架 -->
      <template v-if="firstLoading">
        <div
          v-for="i in 3"
          :key="`skeleton-${i}`"
          class="product-card is-skeleton"
        >
          <div class="card-body">
            <div class="skeleton-block skeleton-cover" />
            <div class="card-main">
              <div
                class="skeleton-block"
                style="width: 70%; height: 16px;"
              />
              <div
                class="skeleton-block"
                style="width: 45%; height: 12px; margin-top: 12px;"
              />
              <div
                class="skeleton-block"
                style="width: 55%; height: 12px; margin-top: 8px;"
              />
            </div>
          </div>
        </div>
      </template>

      <!-- 首屏失败：整块给出可重试反馈 -->
      <div
        v-else-if="loadError && !tableData.length"
        class="load-feedback"
      >
        <p class="load-feedback-text">
          {{ loadError }}
        </p>
        <el-button
          type="primary"
          @click="handleRetry"
        >
          重新加载
        </el-button>
      </div>

      <!-- 空态 -->
      <el-empty
        v-else-if="!tableData.length"
        description="暂无产品"
        :image-size="96"
      >
        <el-button
          type="primary"
          @click="$router.push('/products/create')"
        >
          新建产品
        </el-button>
      </el-empty>

      <template v-else>
        <!-- 已有数据时的失败提示，保留列表并允许重试 -->
        <div
          v-if="loadError"
          class="load-feedback is-inline"
        >
          <span class="load-feedback-text">{{ loadError }}</span>
          <el-button
            type="primary"
            plain
            size="small"
            @click="handleRetry"
          >
            重试
          </el-button>
        </div>

        <div
          v-for="row in tableData"
          :key="row.id"
          class="product-card"
        >
          <div class="card-body">
            <el-image
              class="card-cover"
              :src="row.cover"
              :preview-src-list="row.cover ? [row.cover] : []"
              fit="cover"
              preview-teleported
            >
              <template #error>
                <div class="image-placeholder">
                  <el-icon><Picture /></el-icon>
                </div>
              </template>
            </el-image>
            <div class="card-main">
              <div class="card-title">
                {{ row.title }}
              </div>
              <div class="card-meta">
                <el-tag
                  type="primary"
                  size="small"
                  effect="plain"
                >
                  {{ getCategoryLabel(row) }}
                </el-tag>
                <el-tag
                  :type="statusTagType(row.status)"
                  size="small"
                >
                  {{ statusText(row.status) }}
                </el-tag>
                <el-button
                  v-if="row.status === 'admin_offline' && row.offlineReason"
                  type="info"
                  link
                  size="small"
                  @click="showOfflineReason(row)"
                >
                  下架理由
                </el-button>
              </div>
              <div class="card-figures">
                <span class="card-price">¥{{ Number(row.price || 0).toFixed(2) }}</span>
                <span class="card-time">{{ row.createdAt }}</span>
              </div>
            </div>
          </div>
          <!-- 卡片操作：按钮均满足 44px 触控高度 -->
          <div class="card-actions">
            <el-button
              type="primary"
              plain
              @click="handleEdit(row)"
            >
              编辑
            </el-button>
            <el-button
              v-if="row.status === 'draft' || row.status === 'offline'"
              type="success"
              plain
              @click="handleToggleStatus(row, 'published')"
            >
              发布
            </el-button>
            <el-button
              v-if="row.status === 'published'"
              type="warning"
              plain
              @click="handleToggleStatus(row, 'offline')"
            >
              下架
            </el-button>
            <el-button
              type="danger"
              plain
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </div>
        </div>

        <div class="load-more">
          <el-button
            v-if="hasMore"
            class="load-more-btn"
            :loading="loading"
            @click="loadMore"
          >
            加载更多
          </el-button>
          <span
            v-else
            class="load-more-end"
          >没有更多了</span>
        </div>
      </template>
    </div>

    <!-- 分页（桌面） -->
    <div
      v-if="!isMobile"
      class="pagination-container"
    >
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @size-change="() => fetchData()"
        @current-change="() => fetchData()"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { logger } from '@promo/shared/utils/logger'
import { getErrorMessage } from '@promo/shared/utils/errors'
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Picture } from '@element-plus/icons-vue'
import { get, put, del } from '@promo/shared/utils/request'
import type { PaginatedResponse, ProductCategory } from '@promo/shared/types'
import { useIsMobile } from '../../composables/useIsMobile'

const router = useRouter()
const route = useRoute()
const { isMobile } = useIsMobile()

// 加载状态
const loading = ref(false)
const categoriesLoading = ref(false)
// 列表加载失败信息（移动端展示可重试提示）
const loadError = ref('')

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
  publishedAt?: string
  offlineReason?: string
  category?: string
  categoryId?: string
  categoryNameSnapshot?: string
}

// 产品列表接口返回的原始数据结构
interface ProductApiItem {
  id: string
  title: string
  coverImage: string
  price: number
  status: ProductStatus
  createdAt: string
  cover?: string
  commission?: number
  publishedAt?: string
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

// 首屏加载中（用于移动端骨架屏）
const firstLoading = computed(() => loading.value && tableData.value.length === 0)
// 是否还有下一页（移动端加载更多）
const hasMore = computed(() => tableData.value.length < pagination.total)

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
    const infoStr = localStorage.getItem('manager_info')
    if (!infoStr) {
      logger.error('[getManagerId] 未找到 manager_info，请重新登录')
      return ''
    }
    const info = JSON.parse(infoStr)
    if (!info.id) {
      logger.error('[getManagerId] manager_info 中缺少 id 字段:', info)
      return ''
    }
    logger.debug('[getManagerId] 获取到经理 ID:', info.id)
    return info.id
  } catch (e) {
    logger.error('[getManagerId] 获取经理 ID 失败:', e)
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
    logger.error('获取分类失败:', error)
  } finally {
    categoriesLoading.value = false
  }
}

// 获取产品列表数据；append 为 true 时追加到现有列表（移动端加载更多）
const fetchData = async (append = false): Promise<boolean> => {
  if (append && loading.value) return false
  loading.value = true
  if (!append) loadError.value = ''
  try {
    const currentManagerId = getManagerId()
    logger.debug('[fetchData] 正在获取产品列表，managerId:', currentManagerId)
    
    const res = await get<PaginatedResponse<ProductApiItem>>('/products', {
      page: pagination.page,
      pageSize: pagination.pageSize,
      status: searchStatus.value || undefined,
      managerId: currentManagerId,
      keyword: searchKeyword.value || undefined,
    })
    
    const { list, total } = res.data
    logger.debug('[fetchData] 获取到产品列表:', { listCount: list.length, total })
    
    // 映射字段：coverImage -> cover
    const mapped = list.map((p: ProductApiItem) => ({
      ...p,
      cover: p.coverImage || p.cover || '',
      commission: p.commission || 0,
    }))
    tableData.value = append ? [...tableData.value, ...mapped] : mapped
    pagination.total = total
    loadError.value = ''
    return true
  } catch (error) {
    logger.error('获取产品列表失败:', error)
    loadError.value = getErrorMessage(error, '获取产品列表失败，请检查网络后重试')
    // 桌面端保持原有错误提示；移动端在列表区域给出可重试反馈
    if (!isMobile.value) ElMessage.error(loadError.value)
    return false
  } finally {
    loading.value = false
  }
}

// 移动端：加载下一页并追加，失败则回退页码
const loadMore = async () => {
  if (loading.value || !hasMore.value) return
  pagination.page += 1
  const ok = await fetchData(true)
  if (!ok) pagination.page -= 1
}

// 失败重试：已有数据时继续加载下一页，否则从第一页重新拉取
const handleRetry = () => {
  if (tableData.value.length && hasMore.value) {
    loadMore()
    return
  }
  pagination.page = 1
  fetchData()
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
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getErrorMessage(error, '操作失败'))
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
    logger.debug('[删除产品] 发送请求:', url)
    const res = await del<unknown>(url)
    logger.debug('[删除产品] 响应:', res)
    ElMessage.success('删除成功')
    fetchData()
  } catch (error) {
    logger.error('[删除产品] 失败:', error)
    if (error !== 'cancel') {
      ElMessage.error(getErrorMessage(error, '删除失败'))
    }
  }
}

onMounted(() => {
  logger.debug('[ProductListView] onMounted 触发')
  fetchCategories()
  fetchData()
})

// 监听路由变化，确保每次进入页面都重新获取数据
watch(
  () => route.fullPath,
  (newPath) => {
    logger.debug('[ProductListView] 路由变化:', newPath)
    if (route.path === '/products') {
      logger.debug('[ProductListView] 触发数据重新获取')
      // 确保每次都刷新数据
      fetchData()
    }
  },
  { immediate: true }
)
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

// ===== 移动端：纵向搜索栏、卡片列表、加载更多与失败重试 =====
@media (max-width: 767px) {
  .product-list-page {
    .search-bar--mobile {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
      margin-bottom: 12px;

      .mobile-filter-row {
        display: flex;
        align-items: center;
        gap: 8px;

        .el-select {
          flex: 1;
          min-width: 0;
        }

        .el-button {
          flex: none;
          margin-left: 0;
        }
      }

      .mobile-create-btn {
        width: 100%;
        margin-left: 0;
      }
    }

    .product-cards {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .product-card {
      padding: 12px;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
    }

    .card-body {
      display: flex;
      gap: 12px;
    }

    .card-cover {
      flex: none;
      width: 72px;
      height: 72px;
      border-radius: 8px;
      overflow: hidden;
      background: #f5f7fa;

      :deep(.image-placeholder) {
        width: 72px;
        height: 72px;
      }
    }

    .card-main {
      flex: 1;
      min-width: 0;
    }

    .card-title {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
      font-size: 15px;
      line-height: 20px;
      color: #303133;
    }

    .card-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin-top: 6px;
    }

    .card-figures {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
      margin-top: 6px;

      .card-price {
        color: #f56c6c;
        font-size: 15px;
        font-weight: 600;
      }

      .card-time {
        overflow: hidden;
        font-size: 12px;
        color: #909399;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .card-actions {
      display: flex;
      gap: 8px;
      margin-top: 10px;

      .el-button {
        flex: 1;
        min-width: 0;
        margin-left: 0;
      }
    }

    .load-more {
      display: flex;
      justify-content: center;
      padding: 4px 0 8px;

      .load-more-btn {
        width: 100%;
      }

      .load-more-end {
        padding: 8px 0;
        font-size: 12px;
        color: #909399;
      }
    }

    .load-feedback {
      padding: 32px 16px;
      text-align: center;
      background: #ffffff;
      border-radius: 12px;

      .load-feedback-text {
        margin-bottom: 12px;
        font-size: 14px;
        line-height: 20px;
        color: #909399;
      }

      &.is-inline {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        background: #fef0f0;

        .load-feedback-text {
          margin-bottom: 0;
          font-size: 13px;
          color: #f56c6c;
          text-align: left;
        }
      }
    }

    .skeleton-block {
      border-radius: 6px;
      background: linear-gradient(90deg, #f2f3f5 25%, #e6e8eb 37%, #f2f3f5 63%);
      background-size: 400% 100%;
      animation: product-skeleton-loading 1.4s ease infinite;
    }

    .skeleton-cover {
      flex: none;
      width: 72px;
      height: 72px;
      border-radius: 8px;
    }
  }
}

@keyframes product-skeleton-loading {
  0% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0 50%;
  }
}
</style>
