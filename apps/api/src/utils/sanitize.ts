/**
 * 富文本净化：产品 description 等用户可控 HTML 在入库前做白名单过滤，
 * 防止存储型 XSS（用户端以 v-html 渲染）
 */
import sanitizeHtml from 'sanitize-html'

const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    // 结构与文本
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span', 'br', 'hr',
    'strong', 'b', 'em', 'i', 'u', 's', 'del', 'blockquote', 'pre', 'code',
    // 列表
    'ul', 'ol', 'li',
    // 媒体与链接
    'a', 'img', 'video', 'source',
    // 表格
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    // execCommand 兼容
    'font',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    video: ['src', 'controls', 'width', 'height', 'poster'],
    source: ['src', 'type'],
    font: ['color', 'face', 'size'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
    // 富文本编辑器（execCommand）会为对齐/颜色生成内联样式
    '*': ['style'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'data'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowProtocolRelative: false,
  transformTags: {
    // 外链强制补 rel，防钓鱼/注入
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow' }),
  },
}

/**
 * 净化富文本 HTML
 * @param html - 原始 HTML 字符串
 * @returns 白名单过滤后的安全 HTML
 */
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return ''
  return sanitizeHtml(html, RICH_TEXT_OPTIONS)
}
