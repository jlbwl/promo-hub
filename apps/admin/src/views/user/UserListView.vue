<template>
  <div class="user-list">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="search-card">
      <el-row :gutter="20" align="middle">
        <el-col :span="6">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索姓名或手机号"
            prefix-icon="Search"
            clearable
            @clear="handleSearch"
            @keyup.enter="handleSearch"
          />
        </el-col>
        <el-col :span="4">
          <el-select
            v-model="searchRole"
            placeholder="角色筛选"
            clearable
            @change="handleSearch"
          >
            <el-option label="全部" value="" />
            <el-option label="推广经理" value="manager" />
            <el-option label="普通用户" value="user" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-select
            v-model="searchStatus"
            placeholder="状态筛选"
            clearable
            @change="handleSearch"
          >
            <el-option label="全部" value="" />
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-button type="primary" icon="Search" @click="handleSearch">
            搜索
          </el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 数据表格 -->
    <el-card shadow="never" style="margin-top: 16px;">
      <el-table
        :data="tableData"
        stripe
        border
        style="width: 100%"
        v-loading="loading"
      >
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="phone" label="手机号" width="140" />
        <el-table-column prop="role" label="角色" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="getRoleTagType(row.role)">
              {{ getRoleLabel(row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" text size="small" @click="handleViewDetail(row)">
              查看详情
            </el-button>
            <el-button
              :type="row.status === 1 ? 'danger' : 'success'"
              text
              size="small"
              @click="handleToggleStatus(row)"
            >
              {{ row.status === 1 ? '禁用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSearch"
          @current-change="handleSearch"
        />
      </div>
    </el-card>

    <!-- 用户详情弹窗 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="用户详情"
      width="500px"
    >
      <el-descriptions :column="1" border>
        <el-descriptions-item label="姓名">{{ detailData.name }}</el-descriptions-item>
        <el-descriptions-item label="手机号">{{ detailData.phone }}</el-descriptions-item>
        <el-descriptions-item label="角色">
          <el-tag :type="getRoleTagType(detailData.role)">
            {{ getRoleLabel(detailData.role) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="detailData.status === 1 ? 'success' : 'danger'">
            {{ detailData.status === 1 ? '启用' : '禁用' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="注册时间">{{ formatTime(detailData.createdAt) }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { get, put } from '@promo/shared/utils/request'

// 格式化时间（北京时区 UTC+8）
const formatTime = (iso: string) => {
  if (!iso) return '--'
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  // 获取北京时区时间（UTC+8）
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth() + 1
  let day = d.getUTCDate()
  let hours = d.getUTCHours() + 8
  // 处理跨天情况
  if (hours >= 24) {
    hours -= 24
    day += 1
  }
  return `${year}-${p(month)}-${p(day)} ${p(hours)}:${p(d.getUTCMinutes())}`
}

// 搜索条件
const searchKeyword = ref('')
const searchRole = ref('')
const searchStatus = ref<number | ''>('')
// 加载状态
const loading = ref(false)

// 分页配置
const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

// 用户数据类型
interface UserItem {
  id: string
  name: string
  phone: string
  role: string
  status: number
  createdAt: string
}

// 表格数据
const tableData = ref<UserItem[]>([])

// 详情弹窗
const detailDialogVisible = ref(false)
const detailData = reactive<UserItem>({
  id: '',
  name: '',
  phone: '',
  role: '',
  status: 0,
  createdAt: ''
})

// 获取角色标签类型
const getRoleTagType = (role: string) => {
  const map: Record<string, string> = {
    admin: 'danger',
    manager: 'warning',
    user: ''
  }
  return map[role] || 'info'
}

// 获取角色标签文字
const getRoleLabel = (role: string) => {
  const map: Record<string, string> = {
    admin: '管理员',
    manager: '推广经理',
    user: '普通用户'
  }
  return map[role] || role
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const res = await get<any>('/users', {
      page: pagination.page,
      pageSize: pagination.pageSize,
      role: searchRole.value || undefined,
      status: searchStatus.value !== '' ? searchStatus.value : undefined,
      keyword: searchKeyword.value || undefined,
    })
    const { list, total } = res.data
    tableData.value = list || []
    pagination.total = total || 0
  } catch (error: any) {
    ElMessage.error(error.message || '获取数据失败')
  } finally {
    loading.value = false
  }
}

// 搜索处理
const handleSearch = () => {
  pagination.page = 1
  loadData()
}

// 查看用户详情
const handleViewDetail = (row: UserItem) => {
  Object.assign(detailData, row)
  detailDialogVisible.value = true
}

// 切换启用/禁用状态
const handleToggleStatus = async (row: UserItem) => {
  const action = row.status === 1 ? '禁用' : '启用'
  try {
    await ElMessageBox.confirm(`确定要${action}用户「${row.name}」吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const newStatus = row.status === 1 ? 0 : 1
    await put(`/users/${row.id}/status`, { status: newStatus })
    ElMessage.success(`${action}成功`)
    loadData()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '操作失败')
    }
  }
}

// 页面加载时获取数据
onMounted(() => {
  loadData()
})
</script>

<style lang="scss" scoped>
.user-list {
  .search-card {
    :deep(.el-card__body) {
      padding-bottom: 2px;
    }
  }

  .pagination-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }
}
</style>
