<template>
  <div class="user-list">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="search-card">
      <el-row :gutter="20" align="middle">
        <el-col :span="6">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索团队名称或手机号"
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
            <el-option label="普通用户" value="user" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-input
            v-model="searchTeamName"
            placeholder="团队名称筛选"
            clearable
            @clear="handleSearch"
            @keyup.enter="handleSearch"
          />
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
        <el-table-column prop="teamName" label="团队名称" width="160" show-overflow-tooltip />
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
        <el-table-column label="操作" min-width="260" fixed="right">
          <template #default="{ row }">
            <el-button type="warning" text size="small" @click="handleEditTeamName(row)">
              修改团队名称
            </el-button>
            <el-button
              :type="row.status === 1 ? 'danger' : 'success'"
              text
              size="small"
              @click="handleToggleStatus(row)"
            >
              {{ row.status === 1 ? '禁用' : '启用' }}
            </el-button>
            <el-button type="danger" text size="small" @click="handleDelete(row)">
              删除
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

    <!-- 修改团队名称弹窗 -->
    <el-dialog
      v-model="teamNameDialogVisible"
      title="修改团队名称"
      width="400px"
    >
      <el-form :model="teamNameForm" label-width="100px">
        <el-form-item label="团队名称">
          <el-input
            v-model="teamNameForm.teamName"
            placeholder="请输入团队名称"
            :disabled="teamNameLoading"
          />
        </el-form-item>
        <el-form-item label="原团队名称">
          <el-input :value="editRow?.teamName || '--'" disabled />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="teamNameDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="teamNameLoading" @click="handleSaveTeamName">
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 删除确认弹窗 -->
    <el-dialog
      v-model="deleteSmsDialogVisible"
      title="安全验证"
      width="400px"
    >
      <el-form :model="{ smsCode: smsCode }" label-width="100px">
        <el-form-item label="短信验证码">
          <el-input
            v-model="smsCode"
            placeholder="请输入验证码"
            :disabled="smsLoading"
            maxlength="6"
          />
        </el-form-item>
      </el-form>
      <p style="color: #999; font-size: 12px; margin-top: -10px; margin-bottom: 16px;">
        请输入管理员手机收到的验证码
      </p>
      <template #footer>
        <el-button @click="deleteSmsDialogVisible = false; smsCode = ''">取消</el-button>
        <el-button
          type="primary"
          :loading="smsLoading"
          @click="confirmDelete"
        >
          确认删除
        </el-button>
        <el-button
          type="success"
          :loading="smsLoading"
          @click="sendSmsCode"
          :disabled="smsCooldown > 0"
        >
          {{ smsCooldown > 0 ? `${smsCooldown}s` : '获取验证码' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { get, put, del, post } from '@promo/shared/utils/request'

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
const searchTeamName = ref('')
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
  teamName: string
  role: string
  status: number
  createdAt: string
}

// 表格数据
const tableData = ref<UserItem[]>([])

// 修改团队名称弹窗
const teamNameDialogVisible = ref(false)
const teamNameLoading = ref(false)
const teamNameForm = reactive({
  teamName: ''
})
const editRow = ref<UserItem | null>(null)

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
    manager: '渠道经理',
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
      teamName: searchTeamName.value || undefined,
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

// 切换启用/禁用状态
const handleToggleStatus = async (row: UserItem) => {
  const action = row.status === 1 ? '禁用' : '启用'
  try {
    await ElMessageBox.confirm(`确定要${action}团队「${row.teamName}」吗？`, '提示', {
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

// 修改团队名称
const handleEditTeamName = (row: UserItem) => {
  editRow.value = row
  teamNameForm.teamName = row.teamName || ''
  teamNameDialogVisible.value = true
}

// 保存团队名称
const handleSaveTeamName = async () => {
  if (!teamNameForm.teamName.trim()) {
    ElMessage.warning('请输入团队名称')
    return
  }
  if (!editRow.value) return

  console.log('[调试] 开始保存团队名称:', {
    id: editRow.value.id,
    newTeamName: teamNameForm.teamName.trim()
  })

  teamNameLoading.value = true
  try {
    await put(`/users/${editRow.value.id}/team-name`, { teamName: teamNameForm.teamName.trim() })
    console.log('[调试] 保存成功')
    ElMessage.success('修改成功')
    teamNameDialogVisible.value = false
    loadData()
  } catch (error: any) {
    console.error('[调试] 保存失败:', error)
    ElMessage.error(error.message || '修改失败')
  } finally {
    teamNameLoading.value = false
  }
}

// 删除用户
const handleDelete = async (row: UserItem) => {
  try {
    await ElMessageBox.confirm(
      `删除后将清空该用户「${row.teamName}」的所有档案，且数据不可找回，确定要删除吗？`,
      '危险操作',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'error',
        confirmButtonClass: 'el-button--danger'
      }
    )
    
    // 显示短信验证弹窗
    deleteRow.value = row
    deleteSmsDialogVisible.value = true
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '操作失败')
    }
  }
}

// 短信验证码相关
const deleteRow = ref<UserItem | null>(null)
const deleteSmsDialogVisible = ref(false)
const smsCode = ref('')
const smsLoading = ref(false)
const smsCooldown = ref(0)

// 发送验证码
const sendSmsCode = async () => {
  if (smsCooldown.value > 0) return
  
  smsLoading.value = true
  try {
    const res = await post('/admin/sms/verify', { type: 'delete_user' })
    if (res.code === 0) {
      ElMessage.success('验证码已发送')
      smsCooldown.value = 60
      const timer = setInterval(() => {
        smsCooldown.value--
        if (smsCooldown.value <= 0) {
          clearInterval(timer)
        }
      }, 1000)
    } else {
      ElMessage.error(res.message || '发送失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '发送失败')
  } finally {
    smsLoading.value = false
  }
}

// 确认删除
const confirmDelete = async () => {
  if (!smsCode.value.trim() || !deleteRow.value) {
    ElMessage.warning('请输入验证码')
    return
  }

  smsLoading.value = true
  try {
    const res = await del(`/users/${deleteRow.value.id}`, {
      params: { smsCode: smsCode.value }
    })
    if (res.code === 0) {
      ElMessage.success('删除成功')
      deleteSmsDialogVisible.value = false
      smsCode.value = ''
      deleteRow.value = null
      loadData()
    } else {
      ElMessage.error(res.message || '删除失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '删除失败')
  } finally {
    smsLoading.value = false
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
