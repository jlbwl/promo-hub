import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useIsMobile } from './useIsMobile'

// 左缘起手宽度与触发距离：只在屏幕边缘起手，避免与页面内滑动冲突
const EDGE_WIDTH = 24
const MIN_DISTANCE = 60
const MAX_VERTICAL_DRIFT = 60

/** 判断起手点是否位于横向可滚动区域（表格横滑等） */
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

/** 是否有可见的弹层（抽屉、弹窗、确认框），有则让位给弹层手势 */
function hasVisibleOverlay(): boolean {
  const overlays = document.querySelectorAll<HTMLElement>('.el-overlay')
  return Array.from(overlays).some((el) => {
    const style = window.getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden'
  })
}

/**
 * 移动端左缘右滑返回上一页。
 * 仅当浏览器历史里存在上一页（window.history.state.back）时才返回，避免退出站点。
 * @param isEnabled 额外开关，例如抽屉打开时暂停手势
 */
export function useSwipeBack(isEnabled: () => boolean = () => true) {
  const router = useRouter()
  const { isMobile } = useIsMobile()

  let startX = 0
  let startY = 0
  let tracking = false
  let triggered = false

  const canGoBack = () => Boolean(window.history.state?.back)

  const handleTouchStart = (event: TouchEvent) => {
    tracking = false
    triggered = false
    if (!isMobile.value || !isEnabled() || event.touches.length !== 1) return
    const touch = event.touches[0]
    if (touch.clientX > EDGE_WIDTH) return
    const target = event.target as HTMLElement | null
    if (target?.closest('.el-drawer, .el-dialog, .el-overlay, .el-table, .el-scrollbar__wrap')) return
    if (hasVisibleOverlay()) return
    if (isInsideHorizontalScroll(target)) return
    startX = touch.clientX
    startY = touch.clientY
    tracking = true
  }

  const handleTouchMove = (event: TouchEvent) => {
    if (!tracking) return
    if (event.touches.length !== 1) {
      tracking = false
      return
    }
    const touch = event.touches[0]
    const dx = touch.clientX - startX
    const dy = touch.clientY - startY

    // 纵向偏移过大视为滚动，交给页面处理
    if (!triggered && Math.abs(dy) > MAX_VERTICAL_DRIFT) {
      tracking = false
      return
    }
    if (dx > MIN_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) {
      triggered = true
      // 阻止浏览器原生侧滑返回，由路由接管
      if (event.cancelable) event.preventDefault()
    }
  }

  const handleTouchEnd = () => {
    if (tracking && triggered && canGoBack()) router.back()
    tracking = false
    triggered = false
  }

  onMounted(() => {
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)
    window.addEventListener('touchcancel', handleTouchEnd)
  })

  onUnmounted(() => {
    window.removeEventListener('touchstart', handleTouchStart)
    window.removeEventListener('touchmove', handleTouchMove)
    window.removeEventListener('touchend', handleTouchEnd)
    window.removeEventListener('touchcancel', handleTouchEnd)
  })
}
