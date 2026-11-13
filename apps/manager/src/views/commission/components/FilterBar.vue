<template>
  <!-- 筛选栏 -->
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
      style="width: 140px;"
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
    </el-select>
    <!-- 审核日期：自然日范围，选同一天即单日；审核通过与驳回都算当天审核 -->
    <span class="filter-label">审核日期</span>
    <el-date-picker
      :model-value="reviewDateRange"
      type="daterange"
      value-format="YYYY-MM-DD"
      range-separator="至"
      start-placeholder="开始日期"
      end-placeholder="结束日期"
      style="width: 240px;"
      @update:model-value="(v: string[] | null) => emit('update:reviewDateRange', v)"
      @change="emit('change')"
    />
    <!-- 只看重单：服务端筛选，与状态/关键词叠加 -->
    <el-checkbox
      :model-value="onlyDuplicate"
      style="margin-left: 4px;"
      @update:model-value="(v: boolean | string | number) => emit('update:onlyDuplicate', Boolean(v))"
      @change="emit('change')"
    >
      只看重单
    </el-checkbox>
    <span class="duplicate-hint">同客户同产品 ≥2 笔有效订单（已驳回/已删除不计）</span>
    <el-button
      icon="Refresh"
      @click="emit('reset')"
    >
      重置
    </el-button>
  </div>
</template>

<script setup lang="ts">
// 筛选栏：关键词、订单状态
defineProps<{
  keyword: string
  status: string
  reviewDateRange: string[] | null
  onlyDuplicate: boolean
}>()

const emit = defineEmits<{
  'update:keyword': [value: string]
  'update:status': [value: string]
  'update:reviewDateRange': [value: string[] | null]
  'update:onlyDuplicate': [value: boolean]
  change: []
  reset: []
}>()
</script>

<style lang="scss" scoped>
.filter-label {
  margin-left: 6px;
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.duplicate-hint {
  margin-left: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
