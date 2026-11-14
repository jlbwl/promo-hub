<template>
  <!-- 左滑露出操作：受控展开，同一列表由父级保证只展开一个 -->
  <div
    class="swipe-cell"
    :class="{ 'is-open': open, 'is-revealing': revealing }"
  >
    <div
      ref="contentRef"
      class="swipe-cell-content"
      :class="{ 'is-dragging': dragging }"
      :style="contentStyle"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerUp"
      @click.capture="handleClickCapture"
      @transitionend="handleTransitionEnd"
      @dragstart.prevent
    >
      <slot />
    </div>
    <div
      ref="actionsRef"
      class="swipe-cell-actions"
    >
      <slot
        name="actions"
        :open="open"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  /** 是否展开（受控） */
  open?: boolean
  /** 禁用滑动 */
  disabled?: boolean
}>(), {
  open: false,
  disabled: false
})

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
}>()

// 左缘 24px 留给系统/页面返回手势，卡片滑动不从边缘起手
const EDGE_GUARD = 24
const AXIS_LOCK_DISTANCE = 6

const contentRef = ref<HTMLElement | null>(null)
const actionsRef = ref<HTMLElement | null>(null)
const actionsWidth = ref(0)
const offset = ref(0)
const dragging = ref(false)

let startX = 0
let startY = 0
let startOffset = 0
let axis: 'x' | 'y' | null = null
let pointerId: number | null = null
let moved = false
let suppressClick = false
let suppressTimer: ReturnType<typeof setTimeout> | null = null
let resizeObserver: ResizeObserver | null = null

// 收起动画结束后彻底移除 transform，让内容层回到非合成层
const settled = ref(true)

const contentStyle = computed(() => {
  const shouldAnimate = !dragging.value
  // 静止收起时不下发 transform，避免常驻合成层在滚动回弹时脱离裁切露出操作层
  const hasTransform = dragging.value || offset.value !== 0 || !settled.value
  return {
    transform: hasTransform ? `translate3d(${offset.value}px, 0, 0)` : 'none',
    transition: shouldAnimate ? 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none'
  }
})

// 操作层是否允许绘制：拖动中、有位移或已展开时才显示，
// 收起后延迟到收起动画结束再隐藏，避免回弹/惯性滚动时操作项闪现
const revealing = computed(() => dragging.value || offset.value !== 0 || props.open)

// 位移变化即进入合成层，直到收起动画结束后再释放
watch(offset, (value) => {
  if (value !== 0) settled.value = false
})

const handleTransitionEnd = (event: TransitionEvent) => {
  if (event.propertyName !== 'transform') return
  if (!dragging.value && offset.value === 0) settled.value = true
}

// 渲染后测量操作区宽度，状态切换（发布/下架）导致按钮数量变化时同步
const measure = () => {
  actionsWidth.value = actionsRef.value?.offsetWidth || 0
  if (props.open && !dragging.value) offset.value = -actionsWidth.value
  else if (!props.open && !dragging.value) offset.value = 0
}

const suppressNextClick = () => {
  suppressClick = true
  if (suppressTimer) clearTimeout(suppressTimer)
  suppressTimer = setTimeout(() => {
    suppressClick = false
    suppressTimer = null
  }, 300)
}

const handleClickCapture = (event: MouseEvent) => {
  if (!suppressClick) return
  event.preventDefault()
  event.stopPropagation()
}

const resetDrag = () => {
  if (pointerId !== null && contentRef.value?.hasPointerCapture(pointerId)) {
    contentRef.value.releasePointerCapture(pointerId)
  }
  pointerId = null
  axis = null
  moved = false
  dragging.value = false
}

const handlePointerDown = (event: PointerEvent) => {
  if (props.disabled) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  // 左缘起手交给页面返回手势，避免与返回冲突
  if (event.clientX <= EDGE_GUARD) return
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, [contenteditable="true"]')) return

  startX = event.clientX
  startY = event.clientY
  startOffset = offset.value
  axis = null
  pointerId = event.pointerId
  moved = false
}

const handlePointerMove = (event: PointerEvent) => {
  if (pointerId === null || event.pointerId !== pointerId) return
  const dx = event.clientX - startX
  const dy = event.clientY - startY

  if (!axis) {
    if (Math.abs(dx) < AXIS_LOCK_DISTANCE && Math.abs(dy) < AXIS_LOCK_DISTANCE) return
    if (Math.abs(dx) > Math.abs(dy) * 1.2) {
      // 关闭态右滑：不拦截，交给左缘返回或页面自身
      if (dx > 0 && startOffset === 0) {
        axis = 'y'
        return
      }
      axis = 'x'
      dragging.value = true
      contentRef.value?.setPointerCapture(event.pointerId)
    } else {
      // 纵向滚动/下拉刷新开始，展开的卡片自动收起
      axis = 'y'
      if (props.open) emit('update:open', false)
      return
    }
  }

  if (axis !== 'x' || actionsWidth.value === 0) return
  moved = true
  if (event.cancelable) event.preventDefault()

  // 两侧轻微阻尼，避免硬边界
  let next = startOffset + dx
  if (next > 0) next *= 0.3
  const min = -actionsWidth.value
  if (next < min) next = min + (next - min) * 0.3
  offset.value = next
}

const handlePointerUp = () => {
  if (pointerId === null) return
  if (axis === 'x') {
    const shouldOpen = offset.value < -actionsWidth.value / 2
    offset.value = shouldOpen ? -actionsWidth.value : 0
    emit('update:open', shouldOpen)
    if (moved) suppressNextClick()
  } else if (!moved && props.open) {
    // 展开态轻点卡片：收起，并吞掉这次点击
    emit('update:open', false)
    suppressNextClick()
  }
  resetDrag()
}

// 外部收起（点其它区域、滚动、切换卡片）时跟随动画
watch(() => props.open, (open) => {
  if (dragging.value) return
  offset.value = open ? -actionsWidth.value : 0
})

onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && actionsRef.value) {
    resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(actionsRef.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (suppressTimer) clearTimeout(suppressTimer)
  resetDrag()
})
</script>

<style lang="scss" scoped>
.swipe-cell {
  position: relative;
  overflow: hidden;
  background-color: #ffffff;
  /* 硬裁切操作层：滚动/回弹时合成层不会越过圆角裁切区露出来 */
  contain: paint;
  isolation: isolate;
}

.swipe-cell-content {
  position: relative;
  z-index: 1;
  /* 内容层自身铺白，圆角卡片的四个角不会透出下方操作色块 */
  background-color: #ffffff;
  touch-action: pan-y;
}

.swipe-cell-content.is-dragging {
  will-change: transform;
  user-select: none;
}

.swipe-cell-actions {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 0;
  display: flex;
  align-items: stretch;
  /* 收起后不绘制操作层，滚动/回弹/合成时不可能露出；展开时立即可见 */
  visibility: hidden;
  transition: visibility 0s linear 0.25s;
}

.swipe-cell.is-revealing .swipe-cell-actions {
  visibility: visible;
  transition: visibility 0s;
}

.swipe-cell-actions :deep(.swipe-action) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  min-height: 44px;
  height: 100%;
  padding: 0 8px;
  border: none;
  color: #ffffff;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
  text-align: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  &:active {
    filter: brightness(0.94);
  }

  &.is-edit {
    background-color: #409eff;
  }

  &.is-publish,
  &.is-success {
    background-color: #67c23a;
  }

  &.is-offline {
    background-color: #e6a23c;
  }

  &.is-danger {
    background-color: #f56c6c;
  }
}
</style>
