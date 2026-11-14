<template>
  <!-- 下拉刷新指示器：下拉距离由 composable 计算，此处只负责展示 -->
  <div
    class="pull-refresh-hint"
    :class="{ 'is-dragging': dragging, 'is-refreshing': refreshing }"
    :style="{ height: `${offset}px` }"
    aria-live="polite"
  >
    <span
      v-if="text"
      class="pull-refresh-text"
    >{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  offset: number
  text: string
  dragging: boolean
  refreshing: boolean
}>()
</script>

<style lang="scss" scoped>
.pull-refresh-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 0;
  overflow: hidden;
  font-size: 12px;
  color: #909399;
  transition: height 0.2s ease;
}

.pull-refresh-hint.is-dragging {
  transition: none;
}

.pull-refresh-hint.is-refreshing {
  color: #409eff;
}
</style>
