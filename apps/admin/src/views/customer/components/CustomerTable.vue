<template>
  <el-card shadow="never" class="customer-table-card">
    <el-table
      v-loading="loading"
      :data="data"
      stripe
      border
      style="width: 100%"
      @sort-change="handleSortChange"
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
      <el-table-column prop="searchCount" label="使用次数" width="100" align="center" sortable="custom" />
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
  </el-card>
</template>

<script setup lang="ts">
import { formatTime as formatTimeBase } from '@promo/shared/utils/helpers'
import type { CustomerItem } from '../utils'

defineProps<{
  data: CustomerItem[]
  loading: boolean
}>()

const emit = defineEmits<{
  edit: [row: CustomerItem]
  delete: [row: CustomerItem]
  'sort-change': [payload: { prop?: string; order?: string | null }]
}>()

const formatTime = (iso?: string): string => (iso ? formatTimeBase(iso) : '--')

const payMethodTagType = (payMethod: string): 'primary' | 'success' | 'warning' => {
  if (payMethod === 'wechat') return 'success'
  if (payMethod === 'usdt') return 'warning'
  return 'primary'
}

// 服务端排序：把 el-table 的排序事件原样抛给外层，由接口按参数重新取数
const handleSortChange = (payload: { prop?: string; order?: string | null }): void => {
  emit('sort-change', { prop: payload.prop, order: payload.order })
}
</script>

<style lang="scss" scoped>
.customer-table-card {
  margin-top: 16px;

  :deep(.el-table) {
    min-width: 1024px;
  }
}
</style>
