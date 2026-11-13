<template>
  <el-card shadow="never" class="customer-table-card">
    <el-table
      v-loading="loading"
      :data="data"
      stripe
      border
      style="width: 100%"
    >
      <el-table-column prop="groupName" label="群号简称" min-width="140" show-overflow-tooltip />
      <el-table-column prop="contactName" label="对接人" min-width="120" show-overflow-tooltip />
      <el-table-column label="收款方式" width="110" align="center">
        <template #default="{ row }">
          <el-tag :type="payMethodTagType(row.payMethod)" size="small">
            {{ row.payMethodLabel }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="cardNo" label="卡号/备注" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.cardNo || '--' }}
        </template>
      </el-table-column>
      <el-table-column label="收款码" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.hasQrCode ? 'success' : 'info'" size="small">
            {{ row.hasQrCode ? '有' : '无' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="searchCount" label="使用次数" width="100" align="center" sortable />
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
            {{ row.statusLabel }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="170">
        <template #default="{ row }">
          {{ formatTime(row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" text size="small" @click="emit('edit', row)">
            编辑
          </el-button>
          <el-button type="danger" text size="small" @click="emit('delete', row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrapper">
      <el-pagination
        :current-page="pagination.page"
        :page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @update:current-page="emit('page-change', $event)"
        @update:page-size="emit('size-change', $event)"
      />
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { formatTime as formatTimeBase } from '@promo/shared/utils/helpers'
import type { CustomerItem } from '../utils'

defineProps<{
  data: CustomerItem[]
  loading: boolean
  pagination: { page: number; pageSize: number; total: number }
}>()

const emit = defineEmits<{
  edit: [row: CustomerItem]
  delete: [row: CustomerItem]
  'page-change': [page: number]
  'size-change': [pageSize: number]
}>()

const formatTime = (iso?: string): string => (iso ? formatTimeBase(iso) : '--')

const payMethodTagType = (payMethod: string): 'primary' | 'success' | 'warning' => {
  if (payMethod === 'wechat') return 'success'
  if (payMethod === 'usdt') return 'warning'
  return 'primary'
}
</script>

<style lang="scss" scoped>
.customer-table-card {
  margin-top: 16px;

  .pagination-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }

  :deep(.el-table) {
    min-width: 1024px;
  }
}

@media (max-width: 768px) {
  .pagination-wrapper {
    justify-content: center;
  }
}
</style>
