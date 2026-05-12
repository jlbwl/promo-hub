<template>
  <div class="manager-list">
    <!-- 搜索栏 -->
    <el-card shadow="never" class="search-card">
      <el-row :gutter="20" align="middle">
        <el-col :span="8">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索渠道名称或手机号"
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
        <el-col :span="12" style="text-align: right;">
          <el-button type="primary" icon="Plus" @click="showAddDialog">
            添加渠道
          </el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 数据表格 -->
    <el-card shadow="never" style="margin-top: 16px;">
      <el-table
        :data="filteredData"
        stripe
        border
        style="width: 100%"
        v-loading="loading"
      >
        <el-table-column prop="teamName" label="渠道名称" width="140" show-overflow-tooltip />
        <el-table-column prop="phone" label="手机号" width="140" />
        <el-table-column prop="role" label="角色" width="220" align="center">
          <template #default="{ row }">
            <el-button-group>
              <el-button
                :type="row.role === 'manager' ? 'primary' : ''"
                size="small"
                @click="handleToggleManagerRole(row, 'manager')"
              >
                普通渠道
              </el-button>
              <el-button
                :type="row.role === 'vip' ? 'success' : ''"
                size="small"
                @click="handleToggleManagerRole(row, 'vip')"
              >
                vip渠道
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="200" align="center">
          <template #default="{ row }">
            <el-button-group>
              <el-button
                :type="row.status === 'active' ? 'success' : ''"
                size="small"
                @click="handleToggleManagerStatus(row, 'active')"
              >
                启用
              </el-button>
              <el-button
                :type="row.status === 'inactive' ? 'danger' : ''"
                size="small"
                @click="handleToggleManagerStatus(row, 'inactive')"
              >
                禁用
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="warning" text size="small" @click="handleEditTeamName(row)">
              修改渠道名称
            </el-button>
            <el-button type="danger" text size="small" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 添加经理弹窗 -->
    <el-dialog
      v-model="addDialogVisible"
      title="添加渠道"
      width="450px"
      @close="resetAddForm"
    >
      <el-form
        ref="addFormRef"
        :model="addForm"
        :rules="addFormRules"
        label-width="80px"
      >
        <el-form-item label="渠道名称" prop="teamName">
          <el-input v-model="addForm.teamName" placeholder="渠道名称" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="addForm.password" type="password" placeholder="登录密码" show-password />
        </el-form-item>
        <el-form-item label="手机号" prop="phone" required>
          <el-input v-model="addForm.phone" placeholder="手机号" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="addLoading" @click="handleAdd">
          添加
        </el-button>
      </template>
    </el-dialog>

    <!-- 修改渠道名称弹窗 -->
    <el-dialog
      v-model="teamNameDialogVisible"
      title="修改渠道名称"
      width="400px"
    >
      <el-form :model="teamNameForm" label-width="100px">
        <el-form-item label="渠道名称">
          <el-input
            v-model="teamNameForm.teamName"
            placeholder="请输入渠道名称"
            :disabled="teamNameLoading"
          />
        </el-form-item>
        <el-form-item label="原渠道名称">
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
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { get, post, put, del } from '@promo/shared/utils/request'

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

// 搜索关键词
const searchKeyword = ref('')
// 加载状态
const loading = ref(false)

// 表格数据
const tableData = ref<any[]>([])

// 过滤后的数据
const filteredData = computed(() => {
  if (!searchKeyword.value) return tableData.value
  const keyword = searchKeyword.value.toLowerCase()
  return tableData.value.filter(
    (item: any) =>
      (item.teamName || '').toLowerCase().includes(keyword) ||
      (item.phone || '').includes(keyword)
  )
})

// 添加弹窗
const addDialogVisible = ref(false)
const addLoading = ref(false)
const addFormRef = ref<FormInstance>()
const addForm = reactive({
  teamName: '',
  password: '',
  phone: ''
})

// 修改渠道名称弹窗
const teamNameDialogVisible = ref(false)
const teamNameLoading = ref(false)
const teamNameForm = reactive({
  teamName: ''
})
const editRow = ref<any>(null)

// 获取角色标签类型
const getRoleTagType = (role: string) => {
  const map: Record<string, string> = {
    admin: 'danger',
    manager: '',
    vip: 'success'
  }
  return map[role] || ''
}

// 获取角色标签文字
const getRoleLabel = (role: string) => {
  const map: Record<string, string> = {
    admin: '管理员',
    manager: '普通渠道',
    vip: 'vip渠道'
  }
  return map[role] || '普通渠道'
}

const addFormRules: FormRules = {
  teamName: [
    { required: true, message: '请输入渠道名称', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 20, message: '密码长度在 6 到 20 个字符', trigger: 'blur' }
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ]
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const res = await get<any>('/managers')
    tableData.value = res.data || []
  } catch (error: any) {
    ElMessage.error(error.message || '获取数据失败')
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  // 前端过滤，无需重新请求
}

// 显示添加弹窗
const showAddDialog = () => {
  addDialogVisible.value = true
}

// 重置表单
const resetAddForm = () => {
  addForm.teamName = ''
  addForm.password = ''
  addForm.phone = ''
  addFormRef.value?.resetFields()
}

// 添加经理
const handleAdd = async () => {
  if (!addFormRef.value) return
  try {
    await addFormRef.value.validate()
    addLoading.value = true
    await post('/managers', {
      teamName: addForm.teamName,
      password: addForm.password,
      phone: addForm.phone,
    })
    ElMessage.success('添加成功')
    addDialogVisible.value = false
    loadData()
  } catch (error: any) {
    ElMessage.error(error.message || '添加失败')
  } finally {
    addLoading.value = false
  }
}

// 切换渠道角色
const handleToggleManagerRole = async (row: any, newRole: string) => {
  if (row.role === newRole) return
  
  const roleLabel = newRole === 'manager' ? '普通渠道' : 'vip渠道'
  try {
    await ElMessageBox.confirm(`确定要将渠道「${row.teamName}」设置为${roleLabel}吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await put(`/managers/${row.id}`, { role: newRole })
    ElMessage.success(`角色设置成功`)
    loadData()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '操作失败')
    }
  }
}

// 切换渠道状态
const handleToggleManagerStatus = async (row: any, newStatus: string) => {
  if (row.status === newStatus) return
  
  const action = newStatus === 'active' ? '启用' : '禁用'
  try {
    await ElMessageBox.confirm(`确定要${action}渠道「${row.teamName}」吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await put(`/managers/${row.id}`, { status: newStatus === 'active' ? 'active' : 'inactive' })
    ElMessage.success(`${action}成功`)
    loadData()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '操作失败')
    }
  }
}

// 删除
const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `删除后将清空该渠道「${row.teamName}」的所有档案，且数据不可找回，确定要删除吗？`,
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
const deleteRow = ref<any>(null)
const deleteSmsDialogVisible = ref(false)
const smsCode = ref('')
const smsLoading = ref(false)
const smsCooldown = ref(0)

// 发送验证码
const sendSmsCode = async () => {
  if (smsCooldown.value > 0) return
  
  // 从 localStorage 获取管理员信息
  const adminInfo = JSON.parse(localStorage.getItem('admin_info') || '{}')
  const token = localStorage.getItem('token')
  console.log('[调试] 准备发送短信验证码:', {
    adminInfo,
    token: token ? '已获取' : '未获取',
    phone: adminInfo.phone
  })
  
  if (!adminInfo.phone) {
    ElMessage.error('未获取到管理员手机号，请重新登录')
    return
  }
  
  smsLoading.value = true
  try {
    console.log('[调试] 开始调用短信接口:', '/admin/sms/send')
    const res = await post('/admin/sms/send', { phone: adminInfo.phone })
    console.log('[调试] 短信接口响应:', res)
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
      console.error('[调试] 短信接口返回错误:', res.message)
      ElMessage.error(res.message || '发送失败')
    }
  } catch (error: any) {
    console.error('[调试] 短信接口调用异常:', error)
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
    const res = await del(`/managers/${deleteRow.value.id}?smsCode=${smsCode.value}`)
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

// 修改渠道名称
const handleEditTeamName = (row: any) => {
  editRow.value = row
  teamNameForm.teamName = row.teamName || ''
  teamNameDialogVisible.value = true
}

// 保存渠道名称
const handleSaveTeamName = async () => {
  if (!teamNameForm.teamName.trim()) {
    ElMessage.warning('请输入渠道名称')
    return
  }
  if (!editRow.value) return

  console.log('[调试] 开始保存渠道名称:', {
    id: editRow.value.id,
    newTeamName: teamNameForm.teamName.trim()
  })

  teamNameLoading.value = true
  try {
    await put(`/managers/${editRow.value.id}/team-name`, { teamName: teamNameForm.teamName.trim() })
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
}
</style>
