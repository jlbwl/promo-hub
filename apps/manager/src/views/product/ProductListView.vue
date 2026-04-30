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
      <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
      <el-table-column prop="price" label="价格" width="100" align="right">
        <template #default="{ row }">
          <span style="color: #f56c6c; font-weight: 500;">¥{{ row.price.toFixed(2) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="commission" label="佣金" width="100" align="right">
        <template #default="{ row }">
          <span style="color: #67c23a; font-weight: 500;">¥{{ row.commission.toFixed(2) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)">
            {{ statusText(row.status) }}
          </el-tag>
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
              v-if="row.status === 'draft' || row.status === 'offline'"
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

const router = useRouter()

// 加载状态
const loading = ref(false)

// 搜索条件
const searchKeyword = ref('')
const searchStatus = ref('')

// 分页数据
const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

// 产品状态类型
type ProductStatus = 'draft' | 'published' | 'offline'

// 产品数据接口
interface Product {
  id: number
  title: string
  cover: string
  price: number
  commission: number
  status: ProductStatus
  createdAt: string
}

// 表格数据
const tableData = ref<Product[]>([])

// 获取状态标签类型
const statusTagType = (status: ProductStatus) => {
  const map: Record<ProductStatus, string> = {
    draft: 'info',
    published: 'success',
    offline: 'danger'
  }
  return map[status]
}

// 获取状态文本
const statusText = (status: ProductStatus) => {
  const map: Record<ProductStatus, string> = {
    draft: '草稿',
    published: '已发布',
    offline: '已下架'
  }
  return map[status]
}

// 获取产品列表数据
const fetchData = async () => {
  loading.value = true
  try {
    // 模拟接口请求
    await new Promise(resolve => setTimeout(resolve, 500))

    // 模拟数据
    const mockData: Product[] = [
      {
        id: 1,
        title: '高端护肤品套装 - 补水保湿系列',
        cover: 'https://via.placeholder.com/120',
        price: 299.00,
        commission: 45.00,
        status: 'published',
        createdAt: '2026-04-28 10:30:00'
      },
      {
        id: 2,
        title: '智能蓝牙耳机 降噪版',
        cover: 'https://via.placeholder.com/120',
        price: 199.00,
        commission: 30.00,
        status: 'published',
        createdAt: '2026-04-27 14:20:00'
      },
      {
        id: 3,
        title: '有机绿茶礼盒装',
        cover: 'https://via.placeholder.com/120',
        price: 158.00,
        commission: 20.00,
        status: 'draft',
        createdAt: '2026-04-26 09:15:00'
      },
      {
        id: 4,
        title: '运动健身器材套装',
        cover: 'https://via.placeholder.com/120',
        price: 399.00,
        commission: 60.00,
        status: 'offline',
        createdAt: '2026-04-25 16:45:00'
      },
      {
        id: 5,
        title: '儿童益智玩具积木',
        cover: 'https://via.placeholder.com/120',
        price: 89.00,
        commission: 12.00,
        status: 'published',
        createdAt: '2026-04-24 11:00:00'
      }
    ]

    // 根据搜索条件过滤
    let filtered = [...mockData]
    if (searchKeyword.value) {
      filtered = filtered.filter(item =>
        item.title.includes(searchKeyword.value)
      )
    }
    if (searchStatus.value) {
      filtered = filtered.filter(item => item.status === searchStatus.value)
    }

    // 更新分页信息
    pagination.total = filtered.length
    tableData.value = filtered
  } catch (error) {
    console.error('获取产品列表失败:', error)
    ElMessage.error('获取产品列表失败')
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
    // 模拟接口请求
    await new Promise(resolve => setTimeout(resolve, 300))
    row.status = newStatus
    ElMessage.success(`${statusLabel}成功`)
  } catch {
    // 用户取消操作
  }
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
    // 模拟接口请求
    await new Promise(resolve => setTimeout(resolve, 300))
    tableData.value = tableData.value.filter(item => item.id !== row.id)
    pagination.total--
    ElMessage.success('删除成功')
  } catch {
    // 用户取消操作
  }
}

onMounted(() => {
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
}
</style>
