<template>
  <div class="search-bar">
    <el-input
      :model-value="keyword"
      placeholder="搜索产品名称、用户姓名、手机号"
      prefix-icon="Search"
      clearable
      style="width: 300px;"
      @update:model-value="emit('update:keyword', $event)"
      @clear="emit('change')"
      @keyup.enter="emit('change')"
    />
    <el-select
      :model-value="status"
      placeholder="订单状态"
      clearable
      style="width: 140px; margin-left: 12px;"
      @update:model-value="emit('update:status', $event)"
      @change="emit('change')"
    >
      <el-option
        label="全部"
        value=""
      />
      <el-option
        label="待审核"
        value="pending"
      />
      <el-option
        label="已通过"
        value="approved"
      />
      <el-option
        label="待发放"
        value="pending_payment"
      />
      <el-option
        label="已发放"
        value="settled"
      />
      <el-option
        label="已驳回"
        value="rejected"
      />
    </el-select>
    <el-select
      :model-value="manager"
      placeholder="筛选经理"
      clearable
      style="width: 160px; margin-left: 12px;"
      @update:model-value="emit('update:manager', $event)"
      @change="emit('change')"
    >
      <el-option
        label="全部经理"
        value=""
      />
      <el-option
        v-for="m in managers"
        :key="m.id"
        :label="m.name"
        :value="m.id"
      />
    </el-select>
    <el-select
      :model-value="user"
      placeholder="筛选用户"
      clearable
      filterable
      style="width: 260px; margin-left: 12px;"
      @update:model-value="emit('update:user', $event)"
      @change="emit('change')"
    >
      <el-option
        label="全部用户"
        value=""
      />
      <el-option
        v-for="o in userOptions"
        :key="o.key"
        :label="o.label"
        :value="o.key"
      />
    </el-select>
    <el-button
      icon="Refresh"
      style="margin-left: 12px;"
      @click="emit('reset')"
    >
      重置
    </el-button>
  </div>
</template>

<script setup lang="ts">
// 筛选栏：关键词、订单状态、经理、用户（用户选项值格式为 userPhone||teamName）
import type { Manager } from '@promo/shared/types'

defineProps<{
  keyword: string
  status: string
  manager: string
  user: string
  managers: Manager[]
  userOptions: { key: string; label: string }[]
}>()

const emit = defineEmits<{
  'update:keyword': [value: string]
  'update:status': [value: string]
  'update:manager': [value: string]
  'update:user': [value: string]
  change: []
  reset: []
}>()
</script>

<style lang="scss" scoped>
.search-bar { margin-bottom: 16px; }

@media (max-width: 768px) {
  .search-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-start;

    :deep(.el-input) {
      width: 100%;
      max-width: none;
    }

    :deep(.el-select) {
      width: 100%;
      max-width: none;
      margin-left: 0 !important;
    }

    :deep(.el-button) {
      margin-left: 0 !important;
    }
  }
}
</style>
