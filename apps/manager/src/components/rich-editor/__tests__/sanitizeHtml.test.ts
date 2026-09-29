/**
 * sanitizeHtml 单元测试：粘贴内容 XSS 防护
 */
import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from '../sanitizeHtml'

describe('sanitizeHtml', () => {
  it('移除 script 标签', () => {
    expect(sanitizeHtml('<p>hi</p><script>alert(1)</script>')).toBe('<p>hi</p>')
  })

  it('移除 style 标签', () => {
    expect(sanitizeHtml('<p>hi</p><style>.x{}</style>')).toBe('<p>hi</p>')
  })

  it('移除 on* 内联事件属性', () => {
    const out = sanitizeHtml('<img src="a.png" onerror="alert(1)"><div onclick="x()">t</div>')
    expect(out).not.toContain('onerror')
    expect(out).not.toContain('onclick')
    expect(out).toContain('src="a.png"')
  })

  it('保留正常内容与图片', () => {
    const html = '<p>产品介绍</p><img src="https://x/a.png"><ul><li>要点</li></ul>'
    expect(sanitizeHtml(html)).toContain('产品介绍')
    expect(sanitizeHtml(html)).toContain('https://x/a.png')
  })

  it('大小写变体的事件属性同样移除', () => {
    const out = sanitizeHtml('<div OnClick="x()">t</div>')
    expect(out.toLowerCase()).not.toContain('onclick')
  })
})
