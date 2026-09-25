import { describe, it, expect } from 'vitest'
import { sanitizeRichText } from '../sanitize.js'

describe('sanitizeRichText', () => {
  it('should keep plain text unchanged', () => {
    expect(sanitizeRichText('纯文本描述')).toBe('纯文本描述')
  })

  it('should keep allowed formatting tags', () => {
    const html = '<p style="text-align:center"><strong>标题</strong><br>内容 <em>强调</em></p><ul><li>条目</li></ul>'
    // 自闭合标签会被规范化为 XHTML 风格（<br />）
    expect(sanitizeRichText(html)).toBe(html.replace('<br>', '<br />'))
  })

  it('should strip script tags entirely', () => {
    expect(sanitizeRichText('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>')
    expect(sanitizeRichText('<script>alert(1)</script>')).toBe('')
  })

  it('should strip event handler attributes', () => {
    const out = sanitizeRichText('<img src="https://a.com/x.png" onerror="alert(1)">')
    expect(out).toContain('src="https://a.com/x.png"')
    expect(out).not.toContain('onerror')
  })

  it('should remove javascript: hrefs', () => {
    const out = sanitizeRichText('<a href="javascript:alert(1)">点我</a>')
    expect(out).not.toContain('javascript:')
    expect(out).toContain('点我')
  })

  it('should keep data: image sources (editor base64 uploads) and force rel on links', () => {
    const out = sanitizeRichText('<img src="data:image/png;base64,iVBORw0KGgo="><a href="https://a.com">链接</a>')
    expect(out).toContain('data:image/png;base64,iVBORw0KGgo=')
    expect(out).toContain('rel="noopener noreferrer nofollow"')
  })

  it('should strip protocol-relative and unknown-scheme urls', () => {
    const out = sanitizeRichText('<img src="//evil.com/x.png"><a href="vbscript:msgbox(1)">x</a>')
    expect(out).not.toContain('//evil.com')
    expect(out).not.toContain('vbscript:')
  })

  it('should return empty string for falsy input', () => {
    expect(sanitizeRichText('')).toBe('')
    expect(sanitizeRichText(undefined)).toBe('')
    expect(sanitizeRichText(null)).toBe('')
  })
})
