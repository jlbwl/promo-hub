import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { useIsMobile } from './useIsMobile'

// 阻尼系数与最大下拉距离：拉到 2 倍阈值即触发
const DAMPING = 0.5
const MAX_OFFSET = 96
const MIN_REFRESH_MS = 320

/** 判断起手点是否位于横向可滚动区域，避免与横滑手势冲突 */
function isInsideHorizontalScroll(target: HTMLElement | null): boolean {
  let node: HTMLElement | null = target
  for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
    if (node.scrollWidth > node.clientWidth + 4) {
      const style = window.getComputedStyle(node)
      if (/(auto|scroll)/.test(style.overflowX)) return true
    }
  }
  return false
}

/**
 * 移动端列表下拉刷新：桌面端不注册任何手势。
 * 纵向滚动由布局中的 .mobile-main 承担，会向上查找真正的滚动容器。
 * @param refresh 刷新回调，返回 Promise 时等结束后再收起指示器
 * @param rootRef 列表页根元素
 * @param threshold 触发刷新的下拉距离（px）
 */
export function usePullToRefresh(
  refresh: () => Promise<unknown> | unknown,
  rootRef: Ref<HTMLElement | null>,
  threshold = 64
) {
  const { isMobile } = useIsMobile()

  const offset = ref(0)
  const pulling = ref(false)
  const refreshing = ref(false)

  let startX = 0
  let startY = 0
  let tracking = false
  let scrollHost: HTMLElement | null = null
  let teardown: (() => void) | null = null

  const hintText = computed(() => {
    if (refreshing.value) return '刷新中…'
    if (offset.value >= threshold) return '释放立即刷新'
    return offset.value > 0 ? '下拉刷新' : ''
  })

  const findScrollHost = (): HTMLElement | null => {
    let node = rootRef.value?.parentElement || null
    while (node) {
      const style = window.getComputedStyle(node)
      if (/(auto|scroll)/.test(style.overflowY)) return node
      node = node.parentElement
    }
    return null
  }

  const getScrollTop = () => {
    if (scrollHost) return scrollHost.scrollTop
    return window.scrollY || document.documentElement.scrollTop || 0
  }

  const cancelPull = () => {
    tracking = false
    pulling.value = false
    offset.value = 0
  }

  const handleTouchStart = (event: TouchEvent) => {
    if (!isMobile.value || refreshing.value || event.touches.length !== 1) return
    const target = event.target as HTMLElement | null
    if (target?.closest('input, textarea, [contenteditable="true"]')) return
    if (isInsideHorizontalScroll(target)) return
    scrollHost = findScrollHost()
    if (getScrollTop() > 0) return
    const touch = event.touches[0]
    startX = touch.clientX
    startY = touch.clientY
    tracking = true
    pulling.value = false
  }

  const handleTouchMove = (event: TouchEvent) => {
    if (!tracking || refreshing.value || !isMobile.value) return
    if (event.touches.length !== 1) {
      cancelPull()
      return
    }
    const touch = event.touches[0]
    const dx = touch.clientX - startX
    const dy = touch.clientY - startY

    if (!pulling.value) {
      // 横向滑动或上滑优先交给页面，只有明确的向下手势才进入下拉
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
        tracking = false
        return
      }
      if (dy < 8) return
      if (getScrollTop() > 0) {
        tracking = false
        return
      }
      pulling.value = true
    }

    if (getScrollTop() > 0) {
      cancelPull()
      return
    }
    // 阻断浏览器回弹，让指示器跟随手指
    if (event.cancelable) event.preventDefault()
    offset.value = Math.min(MAX_OFFSET, dy * DAMPING)
  }

  const handleTouchEnd = async () => {
    if (!tracking) return
    const shouldRefresh = pulling.value && offset.value >= threshold
    tracking = false
    pulling.value = false

    if (!shouldRefresh) {
      offset.value = 0
      return
    }

    refreshing.value = true
    offset.value = threshold
    const startedAt = Date.now()
    try {
      await refresh()
    } finally {
      // 网络很快时避免指示器一闪而过
      const remain = MIN_REFRESH_MS - (Date.now() - startedAt)
      if (remain > 0) await new Promise(resolve => setTimeout(resolve, remain))
      refreshing.value = false
      offset.value = 0
    }
  }

  onMounted(() => {
    const el = rootRef.value
    if (!el) return
    const onStart = (event: Event) => handleTouchStart(event as TouchEvent)
    const onMove = (event: Event) => handleTouchMove(event as TouchEvent)
    const onEnd = () => { void handleTouchEnd() }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', cancelPull)
    teardown = () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', cancelPull)
    }
  })

  onBeforeUnmount(() => {
    teardown?.()
    teardown = null
  })

  return { offset, pulling, refreshing, hintText }
}
