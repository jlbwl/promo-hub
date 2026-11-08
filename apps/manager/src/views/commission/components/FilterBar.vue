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
      <el-option
        label="已驳回"
        value="rejected"
      />
    </el-select>
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
  onlyDuplicate: boolean
}>()

const emit = defineEmits<{
  'update:keyword': [value: string]
  'update:status': [value: string]
  'update:onlyDuplicate': [value: boolean]
  change: []
  reset: []
}>()
</script>

<style lang="scss" scoped>
.duplicate-hint {
  margin-left: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
