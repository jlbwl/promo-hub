/**
 * 清理粘贴/输入的 HTML：移除 script、style 标签与 on* 内联事件属性
 */
export const sanitizeHtml = (html: string): string => {
  const div = document.createElement('div')
  div.innerHTML = html

  // 移除script标签
  const scripts = div.querySelectorAll('script')
  scripts.forEach(s => s.remove())

  // 移除style标签
  const styles = div.querySelectorAll('style')
  styles.forEach(s => s.remove())

  // 移除on*属性
  const allElements = div.querySelectorAll('*')
  allElements.forEach(el => {
    const attrs = Array.from(el.attributes)
    attrs.forEach(attr => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name)
      }
    })
  })

  return div.innerHTML
}
