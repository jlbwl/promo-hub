<template>
  <div class="manager-list">
    <!-- 搜索栏 -->
    <el-card
      shadow="never"
      class="search-card"
    >
      <el-row
        :gutter="20"
        align="middle"
      >
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
          <el-button
            type="primary"
            icon="Search"
            @click="handleSearch"
          >
            搜索
          </el-button>
        </el-col>
        <el-col
          :span="12"
          style="text-align: right;"
        >
          <el-button
            type="primary"
            icon="Plus"
            @click="showAddDialog"
          >
            添加渠道
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
        :data="filteredData"
        stripe
        border
        style="width: 100%"
      >
        <el-table-column
          prop="teamName"
          label="渠道名称"
          width="140"
          show-overflow-tooltip
        />
        <el-table-column
          prop="phone"
          label="手机号"
          width="140"
        />
        <el-table-column
          prop="status"
          label="状态"
          width="200"
          align="center"
        >
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
        <el-table-column
          label="创建时间"
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
              修改渠道名称
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
        <el-form-item
          label="渠道名称"
          prop="teamName"
        >
          <el-input
            v-model="addForm.teamName"
            placeholder="渠道名称"
          />
        </el-form-item>
        <el-form-item
          label="密码"
          prop="password"
        >
          <el-input
            v-model="addForm.password"
            type="password"
            placeholder="登录密码"
            show-password
          />
        </el-form-item>
        <el-form-item
          label="手机号"
          prop="phone"
          required
        >
          <el-input
            v-model="addForm.phone"
            placeholder="手机号"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="addLoading"
          @click="handleAdd"
        >
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
      <el-form
        :model="teamNameForm"
        label-width="100px"
      >
        <el-form-item label="渠道名称">
          <el-input
            v-model="teamNameForm.teamName"
            placeholder="请输入渠道名称"
            :disabled="teamNameLoading"
          />
        </el-form-item>
        <el-form-item label="原渠道名称">
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
import { useManagerList } from '../../composables/useManagerList'

// 格式化时间（shared 统一北京时区实现）
const formatTime = (iso: string) => formatTimeBase(iso, '--')

const {
  searchKeyword,
  loading,
  filteredData,
  addDialogVisible,
  addLoading,
  addFormRef,
  addForm,
  addFormRules,
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
  showAddDialog,
  resetAddForm,
  handleAdd,
  handleToggleManagerStatus,
  handleDelete,
  sendSmsCode,
  confirmDelete,
  handleEditTeamName,
  handleSaveTeamName
} = useManagerList()

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="scss" src="./ManagerListView.scss"></style>
