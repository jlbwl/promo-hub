<template>
  <!-- 数据表格 -->
  <el-table
    v-loading="loading"
    :data="data"
    border
    stripe
    style="width: 100%;"
  >
    <el-table-column
      prop="productName"
      label="产品名称"
      min-width="180"
      show-overflow-tooltip
    >
      <template #default="{ row }">
        <span>{{ row.productName }}</span>
        <el-tag
          v-if="row.optionLabel"
          size="small"
          type="info"
          style="margin-left: 6px;"
        >
          {{ row.optionLabel }}
        </el-tag>
        <el-tag
          v-if="row.fundAccount"
          size="small"
          type="primary"
          plain
          style="margin-left: 6px;"
        >
          {{ row.fundAccount }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column
      prop="userName"
      label="用户姓名"
      width="120"
      show-overflow-tooltip
    >
      <template #default="{ row }">
        <span>{{ maskName(row.userName) }}</span>
      </template>
    </el-table-column>
    <el-table-column
      label="渠道名称"
      width="140"
      show-overflow-tooltip
    >
      <template #default="{ row }">
        <span>{{ teamNameOf(row.managerId) }}</span>
      </template>
    </el-table-column>
    <el-table-column
      label="团队名称"
      width="140"
      show-overflow-tooltip
    >
      <template #default="{ row }">
        <div
          v-if="row.teamName"
          class="editable-cell"
        >
          {{ row.teamName }}
          <el-icon
            class="edit-icon"
            @click="emit('edit-team', row)"
          >
            <Edit />
          </el-icon>
        </div>
        <div
          v-else
          class="editable-cell empty"
          @click="emit('edit-team', row)"
        >
          <span class="empty-text">点击编辑</span>
          <el-icon class="edit-icon">
            <Edit />
          </el-icon>
        </div>
      </template>
    </el-table-column>
    <el-table-column
      prop="userPhone"
      label="手机号"
      width="130"
      show-overflow-tooltip
    >
      <template #default="{ row }">
        <span>{{ maskPhone(row.userPhone) }}</span>
      </template>
    </el-table-column>
    <el-table-column
      prop="productPrice"
      label="推广费"
      width="100"
      align="right"
    >
      <template #default="{ row }">
        <span style="font-weight: 500;">{{ row.productPrice }}</span>
      </template>
    </el-table-column>
    <el-table-column
      prop="status"
      label="状态"
      width="100"
      align="center"
    >
      <template #default="{ row }">
        <el-tag :type="statusTagType(row.status)">
          {{ statusText(row.status) }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column
      label="做单时间"
      width="170"
      align="center"
    >
      <template #default="{ row }">
        {{ formatTime(row.createdAt) }}
      </template>
    </el-table-column>
    <el-table-column
      prop="rejectReason"
      label="驳回原因"
      width="120"
      show-overflow-tooltip
    >
      <template #default="{ row }">
        <span style="color: #f56c6c;">{{ row.rejectReason || '--' }}</span>
      </template>
    </el-table-column>
    <el-table-column
      prop="settledAt"
      label="发放日期"
      width="170"
      align="center"
    >
      <template #default="{ row }">
        <span>{{ row.settledAt ? formatTime(row.settledAt) : '--' }}</span>
      </template>
    </el-table-column>
    <el-table-column
      label="操作"
      width="120"
      align="center"
    >
      <template #default="{ row }">
        <el-button
          type="danger"
          text
          size="small"
          @click="emit('delete', row)"
        >
          删除
        </el-button>
      </template>
    </el-table-column>
  </el-table>

  <!-- 分页 -->
  <div class="pagination-container">
    <el-pagination
      :current-page="page"
      :page-size="pageSize"
      :page-sizes="[10, 20, 50]"
      :total="total"
      layout="total, sizes, prev, pager, next"
      background
      @update:current-page="emit('update:page', $event)"
      @update:page-size="emit('update:pageSize', $event)"
      @size-change="emit('page-change')"
      @current-change="emit('page-change')"
    />
  </div>
</template>

<script setup lang="ts">
import { Edit } from '@element-plus/icons-vue'
import { maskName, maskPhone, formatTime, statusTagType, statusText, getManagerTeamName } from '../utils'

const props = defineProps<{
  loading: boolean
  data: any[]
  managers: any[]
  total: number
  page: number
  pageSize: number
}>()

const emit = defineEmits<{
  'update:page': [value: number]
  'update:pageSize': [value: number]
  'page-change': []
  'edit-team': [row: any]
  delete: [row: any]
}>()

// 根据经理 ID 获取渠道名称
const teamNameOf = (managerId: string) => getManagerTeamName(props.managers, managerId)
</script>

<style lang="scss" scoped>
.pagination-container { display: flex; justify-content: flex-end; margin-top: 16px; }

.editable-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: all 0.2s;

  &:hover {
    background: #ecf5ff;
  }

  &.empty {
    color: #909399;

    .empty-text {
      font-size: 13px;
    }
  }

  .edit-icon {
    font-size: 14px;
    color: #409eff;
    opacity: 0;
    transition: opacity 0.2s;
  }

  &:hover .edit-icon,
  &.empty .edit-icon {
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .pagination-container {
    justify-content: center;
  }
}
</style>
