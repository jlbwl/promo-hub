<template>
  <div class="manager-list">
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
        <el-table-column prop="commissionRate" label="佣金比例" width="100" align="center">
          <template #default="{ row }">
            {{ row.commissionRate }}%
          </template>
        </el-table-column>
        <el-table-column prop="managedUsers" label="管理用户数" width="120" align="center" />
        <el-table-column prop="totalCommission" label="总佣金" width="140" align="right">
          <template #default="{ row }">
            ¥{{ row.totalCommission.toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" text size="small" @click="handleEditRate(row)">
              编辑佣金比例
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

    <!-- 编辑佣金比例弹窗 -->
    <el-dialog
      v-model="editDialogVisible"
      title="编辑佣金比例"
      width="400px"
    >
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="姓名">
          <span>{{ editForm.name }}</span>
        </el-form-item>
        <el-form-item label="佣金比例">
          <el-input-number
            v-model="editForm.commissionRate"
            :min="0"
            :max="100"
            :precision="1"
            :step="0.5"
          />
          <span style="margin-left: 8px;">%</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveRate">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

// 搜索关键词
const searchKeyword = ref('')
// 加载状态
const loading = ref(false)

// 分页配置
const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

// 表格数据类型
interface ManagerItem {
  id: number
  name: string
  phone: string
  commissionRate: number
  managedUsers: number
  totalCommission: number
  status: number
}

// 表格数据
const tableData = ref<ManagerItem[]>([])

// 编辑弹窗
const editDialogVisible = ref(false)
const editForm = reactive({
  id: 0,
  name: '',
  commissionRate: 0
})

// 模拟数据加载
const loadData = () => {
  loading.value = true
  setTimeout(() => {
    // 模拟数据
    const mockData: ManagerItem[] = [
      { id: 1, name: '张三', phone: '13800138001', commissionRate: 15, managedUsers: 56, totalCommission: 12500.00, status: 1 },
      { id: 2, name: '李四', phone: '13800138002', commissionRate: 12, managedUsers: 43, totalCommission: 9800.50, status: 1 },
      { id: 3, name: '王五', phone: '13800138003', commissionRate: 10, managedUsers: 78, totalCommission: 15600.00, status: 1 },
      { id: 4, name: '赵六', phone: '13800138004', commissionRate: 8, managedUsers: 21, totalCommission: 3200.00, status: 0 },
      { id: 5, name: '孙七', phone: '13800138005', commissionRate: 20, managedUsers: 92, totalCommission: 28900.00, status: 1 },
      { id: 6, name: '周八', phone: '13800138006', commissionRate: 18, managedUsers: 65, totalCommission: 18700.00, status: 1 },
      { id: 7, name: '吴九', phone: '13800138007', commissionRate: 14, managedUsers: 34, totalCommission: 7600.00, status: 0 },
      { id: 8, name: '郑十', phone: '13800138008', commissionRate: 16, managedUsers: 47, totalCommission: 11200.00, status: 1 }
    ]

    // 根据搜索关键词过滤
    let filtered = mockData
    if (searchKeyword.value) {
      const keyword = searchKeyword.value.toLowerCase()
      filtered = mockData.filter(
        (item) => item.name.includes(keyword) || item.phone.includes(keyword)
      )
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

// 编辑佣金比例
const handleEditRate = (row: ManagerItem) => {
  editForm.id = row.id
  editForm.name = row.name
  editForm.commissionRate = row.commissionRate
  editDialogVisible.value = true
}

// 保存佣金比例
const handleSaveRate = () => {
  const item = tableData.value.find((i) => i.id === editForm.id)
  if (item) {
    item.commissionRate = editForm.commissionRate
    ElMessage.success('佣金比例更新成功')
  }
  editDialogVisible.value = false
}

// 切换启用/禁用状态
const handleToggleStatus = async (row: ManagerItem) => {
  const action = row.status === 1 ? '禁用' : '启用'
  try {
    await ElMessageBox.confirm(`确定要${action}推广经理「${row.name}」吗？`, '提示', {
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
.manager-list {
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
