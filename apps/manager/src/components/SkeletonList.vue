<template>
  <!-- 统一的移动端列表骨架：所有列表页共用同一套占位块与流光动效 -->
  <div
    class="skeleton-list"
    :class="`is-${variant}`"
    aria-busy="true"
    aria-live="polite"
  >
    <div
      v-for="i in rows"
      :key="i"
      class="skeleton-card"
    >
      <div
        v-if="variant === 'media'"
        class="skeleton-cover skeleton-block"
      />
      <div class="skeleton-lines">
        <span
          v-for="(width, index) in lineWidths"
          :key="index"
          class="skeleton-line skeleton-block"
          :style="{ width }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  /** 占位卡片数量 */
  rows?: number
  /** text：纯文字行（订单卡片）；media：左图右文（产品卡片） */
  variant?: 'text' | 'media'
}>(), {
  rows: 3,
  variant: 'text'
})

// 与真实卡片的主要行宽保持一致，避免骨架到内容切换时跳动
const lineWidths = computed(() => (
  props.variant === 'media'
    ? ['70%', '45%', '55%']
    : ['45%', '70%', '60%', '80%']
))
</script>

<style lang="scss" scoped>
.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skeleton-card {
  display: flex;
  gap: 12px;
  padding: 12px;
  background-color: #ffffff;
  border: 1px solid #ebeef5;
  border-radius: 12px;
}

.skeleton-list.is-text .skeleton-card {
  display: block;
  min-height: 132px;
  padding: 12px 14px;
}

.skeleton-cover {
  flex: none;
  width: 72px;
  height: 72px;
  border-radius: 8px;
}

.skeleton-lines {
  flex: 1;
  min-width: 0;
}

.skeleton-line {
  display: block;
  height: 12px;
  margin-top: 8px;
  border-radius: 6px;

  &:first-child {
    height: 16px;
    margin-top: 0;
  }
}

.skeleton-block {
  background: linear-gradient(90deg, #f2f3f5 25%, #e6e8eb 37%, #f2f3f5 63%);
  background-size: 400% 100%;
  animation: skeleton-shimmer 1.4s ease infinite;
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0 50%;
  }
}
</style>
