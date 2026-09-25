<template>
  <!-- 数据表格 -->
  <el-card
    shadow="never"
    style="margin-top: 16px;"
  >
    <el-table
      v-loading="loading"
      :data="data"
      stripe
      border
      style="width: 100%"
    >
      <el-table-column
        prop="name"
        label="分类名称"
        width="180"
      />
      <el-table-column
        prop="value"
        label="分类标识"
        width="200"
      />
      <el-table-column
        prop="sort"
        label="排序"
        width="100"
        align="center"
      />
      <el-table-column
        prop="status"
        label="状态"
        width="120"
        align="center"
      >
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'">
            {{ row.status === 'active' ? '启用' : '已归档' }}
          </el-tag>
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
        label="更新时间"
        width="180"
      >
        <template #default="{ row }">
          {{ formatTime(row.updatedAt) }}
        </template>
      </el-table-column>
      <el-table-column
        label="操作"
        min-width="240"
        fixed="right"
      >
        <template #default="{ row }">
          <el-button
            type="primary"
            text
            size="small"
            @click="emit('edit', row)"
          >
            编辑
          </el-button>
          <el-button
            type="warning"
            text
            size="small"
            @click="emit('toggle-status', row)"
          >
            {{ row.status === 'active' ? '归档' : '启用' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { formatTime } from '../utils'
import type { ProductCategory } from '@promo/shared/types'

defineProps<{
  loading: boolean
  data: ProductCategory[]
}>()

const emit = defineEmits<{
  edit: [row: ProductCategory]
  'toggle-status': [row: ProductCategory]
}>()
</script>
