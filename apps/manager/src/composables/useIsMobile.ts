import { onMounted, onUnmounted, ref } from 'vue'

// 与样式断点保持一致：≤768px 视为移动端
export const MOBILE_MEDIA_QUERY = '(max-width: 768px)'

/**
 * 移动端断点判断：供需要切换 DOM 结构（表格 → 卡片列表）的组件使用，
 * 纯样式适配仍由 CSS @media 完成，避免所有场景都改成 JS 判断
 */
export function useIsMobile() {
  const isMobile = ref(false)
  let mediaQuery: MediaQueryList | null = null

  const update = () => {
    isMobile.value = mediaQuery ? mediaQuery.matches : false
  }

  onMounted(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY)
    update()
    mediaQuery.addEventListener('change', update)
  })

  onUnmounted(() => {
    mediaQuery?.removeEventListener('change', update)
    mediaQuery = null
  })

  return { isMobile }
}
