<template>
  <div
    class="user-avatar"
    :style="rootStyle"
  >
    <img
      v-if="showImage"
      class="avatar-img"
      :src="src"
      alt=""
      @error="handleError"
    >
    <span v-else>{{ initial }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/**
 * 默认头像：有可用图片时显示图片，缺图或加载失败时回退为金色渐变底 + 姓名首字
 * （样式与参考稿「我的」页头像一致：圆形、金褐渐变、浅色描边）
 */
const props = withDefaults(defineProps<{
  src?: string
  name?: string
  size?: number
}>(), {
  src: '',
  name: '',
  size: 52,
})

// 图片加载失败后不再重试，直接走首字占位，避免露出灰色占位图
const failed = ref(false)

watch(() => props.src, () => {
  failed.value = false
})

const showImage = computed(() => !!props.src && !failed.value)

const initial = computed(() => (props.name || '').trim().charAt(0) || '用')

const rootStyle = computed(() => {
  const size = props.size
  return {
    width: `${size}px`,
    height: `${size}px`,
    fontSize: `${Math.round(size * 0.35)}px`,
  }
})

const handleError = () => {
  failed.value = true
}
</script>

<style scoped lang="scss">
.user-avatar {
  display: grid;
  place-items: center;
  flex: none;
  overflow: hidden;
  border-radius: 50%;
  background: linear-gradient(145deg, #d8b07a, #9a6430 60%, #74461f);
  border: 1px solid rgba(255, 240, 214, 0.35);
  box-shadow: 0 6px 18px -8px rgba(0, 0, 0, 0.5);
  color: #fff6e6;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.02em;

  .avatar-img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
</style>
