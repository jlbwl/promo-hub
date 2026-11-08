<template>
  <!-- 数据统计 -->
  <div class="stats-card">
    <div
      class="stat-item"
      @click="emit('show-employees')"
    >
      <van-icon
        name="users"
        size="20"
      />
      <span class="stat-value">{{ employeeCount }}</span>
      <span class="stat-label">我的团队</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  employeeCount: number
}>()

const emit = defineEmits<{
  'show-employees': []
}>()
</script>

<style scoped lang="scss">
// 数据统计卡片
.stats-card {
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin: -26px 14px 12px;
  padding: 18px;
  background-color: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: 0 10px 26px -20px rgba(31, 24, 17, 0.5);
  position: relative;
  z-index: 2;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  cursor: pointer;

  :deep(.van-icon) {
    color: var(--brand);
  }

  &:active {
    opacity: 0.7;
  }
}

.stat-value {
  font-size: 20px;
  font-weight: 750;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 10.5px;
  color: var(--muted);
  letter-spacing: 0.02em;
}
</style>
