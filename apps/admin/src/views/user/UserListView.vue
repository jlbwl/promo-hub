<template>
  <div class="user-list">
    <!-- 搜索栏 -->
    <el-card
      shadow="never"
      class="search-card"
    >
      <el-row
        :gutter="20"
        align="middle"
      >
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
            v-model="searchStatus"
            placeholder="状态筛选"
            clearable
            @change="handleSearch"
          >
            <el-option
              label="全部"
              value=""
            />
            <el-option
              label="启用"
              :value="1"
            />
            <el-option
              label="禁用"
              :value="0"
            />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-button
            type="primary"
            icon="Search"
            @click="handleSearch"
          >
            搜索
          </el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 数据表格 -->
    <el-card
      shadow="never"
      style="margin-top: 16px;"
    >
      <el-table
        v-loading="loading"
        :data="tableData"
        stripe
        border
        style="width: 100%"
      >
        <el-table-column
          prop="teamName"
          label="团队名称"
          width="160"
          show-overflow-tooltip
        />
        <el-table-column
          prop="phone"
          label="手机号"
          width="140"
        />
        <el-table-column
          prop="role"
          label="角色"
          width="220"
          align="center"
        >
          <template #default="{ row }">
            <el-button-group>
              <el-button
                :type="row.role === 'user' ? 'primary' : ''"
                size="small"
                @click="handleToggleUserRole(row, 'user')"
              >
                普通团队
              </el-button>
              <el-button
                :type="row.role === 'vip' ? 'success' : ''"
                size="small"
                @click="handleToggleUserRole(row, 'vip')"
              >
                vip团队
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
        <el-table-column
          prop="status"
          label="状态"
          width="200"
          align="center"
        >
          <template #default="{ row }">
            <el-button-group>
              <el-button
                :type="row.status === 1 ? 'success' : ''"
                size="small"
                @click="handleToggleUserStatus(row, 1)"
              >
                启用
              </el-button>
              <el-button
                :type="row.status === 0 ? 'danger' : ''"
                size="small"
                @click="handleToggleUserStatus(row, 0)"
              >
                禁用
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
        <el-table-column
          label="注册时间"
          width="180"
        >
          <template #default="{ row }">
            {{ formatTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          min-width="180"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              type="warning"
              text
              size="small"
              @click="handleEditTeamName(row)"
            >
              修改团队名称
            </el-button>
            <el-button
              type="danger"
              text
              size="small"
              @click="handleDelete(row)"
            >
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
      <el-form
        :model="teamNameForm"
        label-width="100px"
      >
        <el-form-item label="团队名称">
          <el-input
            v-model="teamNameForm.teamName"
            placeholder="请输入团队名称"
            :disabled="teamNameLoading"
          />
        </el-form-item>
        <el-form-item label="原团队名称">
          <el-input
            :value="editRow?.teamName || '--'"
            disabled
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="teamNameDialogVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="teamNameLoading"
          @click="handleSaveTeamName"
        >
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
      <el-form
        :model="{ smsCode: smsCode }"
        label-width="100px"
      >
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
        <el-button @click="deleteSmsDialogVisible = false; smsCode = ''">
          取消
        </el-button>
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
          :disabled="smsCooldown > 0"
          @click="sendSmsCode"
        >
          {{ smsCooldown > 0 ? `${smsCooldown}s` : '获取验证码' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { formatTime as formatTimeBase } from '@promo/shared/utils/helpers'
import { useUserList } from '../../composables/useUserList'

// 格式化时间（shared 统一北京时区实现）
const formatTime = (iso: string) => formatTimeBase(iso, '--')

const {
  searchKeyword,
  searchStatus,
  loading,
  tableData,
  pagination,
  teamNameDialogVisible,
  teamNameLoading,
  teamNameForm,
  editRow,
  deleteSmsDialogVisible,
  smsCode,
  smsLoading,
  smsCooldown,
  loadData,
  handleSearch,
  handleToggleUserRole,
  handleToggleUserStatus,
  handleEditTeamName,
  handleSaveTeamName,
  handleDelete,
  sendSmsCode,
  confirmDelete
} = useUserList()

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="scss" src="./UserListView.scss"></style>
