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

/**
 * 剥离粘贴内容的格式：保留段落/列表/表格等结构与图片，
 * 移除颜色、背景色、加粗等样式与格式化标签，使粘贴结果默认为普通文本样式
 */
export const stripFormatting = (html: string): string => {
  const div = document.createElement('div')
  div.innerHTML = html

  // 移除无内容意义的标签（Word/网页剪贴板常携带）
  div.querySelectorAll('script, style, meta, link, title').forEach(el => el.remove())

  // 解包格式化标签：保留内部文本，去掉加粗/斜体/颜色/链接等样式载体
  div.querySelectorAll('b, strong, i, em, u, s, del, strike, span, font, mark, h1, h2, h3, h4, h5, h6, a').forEach(el => {
    el.replaceWith(...Array.from(el.childNodes))
  })

  // 清空剩余元素的所有属性（style/class/bgcolor/on* 等），
  // 图片仅保留 src 并统一限宽样式，避免外链大图撑破布局
  div.querySelectorAll('*').forEach(el => {
    const isImg = el.tagName === 'IMG'
    const src = isImg ? el.getAttribute('src') : null
    Array.from(el.attributes).forEach(attr => el.removeAttribute(attr.name))
    if (isImg && src) {
      el.setAttribute('src', src)
      el.setAttribute('style', 'max-width:100%;height:auto;margin:12px 0;border-radius:4px;display:block;')
    }
  })

  return div.innerHTML
}
