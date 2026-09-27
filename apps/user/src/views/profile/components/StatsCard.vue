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
        color="#1989fa"
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
  margin: -20px 16px 12px;
  padding: 20px;
  background-color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  position: relative;
  z-index: 1;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;

  &:active {
    opacity: 0.7;
  }
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #323233;
}

.stat-label {
  font-size: 12px;
  color: #969799;
}
</style>
