<template>
  <div class="user-list">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="search-card">
      <el-row :gutter="20" align="middle">
        <el-col :span="8">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索姓名或手机号"
            prefix-icon="Search"
            clearable
            @clear="handleSearch"
            @keyup.enter="handleSearch"
          />
        </el-col>
        <el-col :span="6">
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
        <el-table-column prop="createdAt" label="注册时间" width="180" />
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
        <el-descriptions-item label="注册时间">{{ detailData.createdAt }}</el-descriptions-item>
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

// 用户数据类型
interface UserItem {
  id: number
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
  id: 0,
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

// 模拟数据加载
const loadData = () => {
  loading.value = true
  setTimeout(() => {
    // 模拟数据
    const mockData: UserItem[] = [
      { id: 1, name: '张三', phone: '13900139001', role: 'admin', status: 1, createdAt: '2025-01-15 10:30:00' },
      { id: 2, name: '李四', phone: '13900139002', role: 'manager', status: 1, createdAt: '2025-02-20 14:20:00' },
      { id: 3, name: '王五', phone: '13900139003', role: 'user', status: 1, createdAt: '2025-03-10 09:15:00' },
      { id: 4, name: '赵六', phone: '13900139004', role: 'user', status: 0, createdAt: '2025-03-18 16:45:00' },
      { id: 5, name: '孙七', phone: '13900139005', role: 'manager', status: 1, createdAt: '2025-04-01 11:00:00' },
      { id: 6, name: '周八', phone: '13900139006', role: 'user', status: 1, createdAt: '2025-04-12 08:30:00' },
      { id: 7, name: '吴九', phone: '13900139007', role: 'user', status: 0, createdAt: '2025-04-20 13:10:00' },
      { id: 8, name: '郑十', phone: '13900139008', role: 'user', status: 1, createdAt: '2025-04-25 17:50:00' },
      { id: 9, name: '钱十一', phone: '13900139009', role: 'manager', status: 1, createdAt: '2025-05-03 10:00:00' },
      { id: 10, name: '陈十二', phone: '13900139010', role: 'user', status: 1, createdAt: '2025-05-15 15:30:00' }
    ]

    // 根据搜索条件过滤
    let filtered = mockData
    if (searchKeyword.value) {
      const keyword = searchKeyword.value.toLowerCase()
      filtered = filtered.filter(
        (item) => item.name.includes(keyword) || item.phone.includes(keyword)
      )
    }
    if (searchStatus.value !== '') {
      filtered = filtered.filter((item) => item.status === searchStatus.value)
    }

    tableData.value = filtered
    pagination.total = filtered.length
    loading.value = false
  }, 300)
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
    row.status = row.status === 1 ? 0 : 1
    ElMessage.success(`${action}成功`)
  } catch {
    // 用户取消操作
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
