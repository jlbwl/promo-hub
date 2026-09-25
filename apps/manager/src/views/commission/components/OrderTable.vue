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
      width="200"
      align="center"
      fixed="right"
    >
      <template #default="{ row }">
        <div class="table-actions">
          <template v-if="row.status === 'pending'">
            <el-button
              type="success"
              text
              size="small"
              @click="emit('approve', row)"
            >
              审核通过
            </el-button>
            <el-button
              type="danger"
              text
              size="small"
              @click="emit('reject', row)"
            >
              驳回
            </el-button>
          </template>
          <template v-else-if="row.status === 'approved'">
            <el-button
              type="primary"
              text
              size="small"
              @click="emit('add-to-payment', row)"
            >
              添加到待发放
            </el-button>
          </template>
          <template v-else>
            <span style="color: #909399; font-size: 13px;">--</span>
          </template>
        </div>
      </template>
    </el-table-column>
  </el-table>

  <!-- 分页 -->
  <div class="pagination-container">
    <el-pagination
      :current-page="page"
      :page-size="pageSize"
      :page-sizes="[10, 20, 50, 100]"
      :total="total"
      layout="total, sizes, prev, pager, next, jumper"
      background
      @update:current-page="emit('update:page', $event)"
      @update:page-size="emit('update:pageSize', $event)"
      @size-change="emit('page-change')"
      @current-change="emit('page-change')"
    />
  </div>
</template>

<script setup lang="ts">
import { maskName, maskPhone, formatTime, statusTagType, statusText } from '../utils'
import type { Order } from '@promo/shared/types'

defineProps<{
  loading: boolean
  data: Order[]
  total: number
  page: number
  pageSize: number
}>()

const emit = defineEmits<{
  'update:page': [value: number]
  'update:pageSize': [value: number]
  'page-change': []
  approve: [row: Order]
  reject: [row: Order]
  'add-to-payment': [row: Order]
}>()
</script>

<style lang="scss" scoped>
.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
