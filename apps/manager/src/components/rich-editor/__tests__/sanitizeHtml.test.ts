/**
 * sanitizeHtml 单元测试：粘贴内容 XSS 防护
 * stripFormatting 单元测试：粘贴内容剥离颜色/背景/加粗等格式
 */
import { describe, it, expect } from 'vitest'
import { sanitizeHtml, stripFormatting } from '../sanitizeHtml'

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

describe('stripFormatting', () => {
  it('移除内联样式（颜色、背景色等）', () => {
    const out = stripFormatting('<p style="color: red; background-color: yellow;">文字</p>')
    expect(out).toBe('<p>文字</p>')
  })

  it('解包加粗/斜体等格式化标签并保留文本', () => {
    expect(stripFormatting('<p><b>加粗</b><strong>粗</strong></p>')).toBe('<p>加粗粗</p>')
    expect(stripFormatting('<p><em>斜体</em><u>下划线</u><s>删除线</s></p>')).toBe('<p>斜体下划线删除线</p>')
  })

  it('解包 span/font/mark/标题/链接等样式载体', () => {
    expect(stripFormatting('<span style="color:blue">蓝字</span>')).toBe('蓝字')
    expect(stripFormatting('<font color="red" size="5">红字</font>')).toBe('红字')
    expect(stripFormatting('<h1>标题</h1><mark>高亮</mark><a href="https://x.com">链接</a>')).toBe('标题高亮链接')
  })

  it('保留段落/列表/表格等结构标签', () => {
    const html = '<p>段落</p><ul><li>要点</li></ul><table><tbody><tr><td>格</td></tr></tbody></table>'
    const out = stripFormatting(html)
    expect(out).toContain('<p>段落</p>')
    expect(out).toContain('<ul><li>要点</li></ul>')
    expect(out).toContain('<td>格</td>')
  })

  it('移除 class/bgcolor 等表现属性', () => {
    const out = stripFormatting('<div class="wx-x" bgcolor="#fff"><p id="a">t</p></div>')
    expect(out).toBe('<div><p>t</p></div>')
  })

  it('图片仅保留 src 并统一限宽样式', () => {
    const out = stripFormatting('<img src="https://x/a.png" width="800" onclick="x()" style="width:800px">')
    expect(out).toContain('src="https://x/a.png"')
    expect(out).toContain('max-width:100%')
    expect(out).not.toContain('onclick')
    expect(out).not.toContain('width="800"')
  })

  it('移除 script/style/meta 等剪贴板杂项标签', () => {
    const out = stripFormatting('<p>hi</p><script>alert(1)</script><style>.x{}</style><meta charset="utf-8">')
    expect(out).toBe('<p>hi</p>')
  })

  it('嵌套格式化标签递归解包', () => {
    const out = stripFormatting('<p><b><span style="color:red"><u>深层</u></span></b></p>')
    expect(out).toBe('<p>深层</p>')
  })
})
