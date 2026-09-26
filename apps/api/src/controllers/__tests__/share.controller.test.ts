import { describe, it, expect } from 'vitest'
import { renderSharePage } from '../share.controller.js'

describe('renderSharePage 分享落地页', () => {
  const base = {
    title: '测试产品',
    description: '产品摘要',
    imageUrl: 'https://www.jlbtg.cn/uploads/covers/a.jpg',
    targetUrl: 'https://www.jlbtg.cn/user/product/p1?share=true&sharerId=u_1',
  }

  it('标题与封面写入 <title> 和 OG 标签，微信卡片可区分产品', () => {
    const html = renderSharePage({ ...base, title: '周日露营套餐' })
    expect(html).toContain('<title>周日露营套餐</title>')
    expect(html).toContain('og:title" content="周日露营套餐"')
    expect(html).toContain('og:image" content="https://www.jlbtg.cn/uploads/covers/a.jpg"')
  })

  it('产品标题中的 HTML 会被转义，防止注入页面', () => {
    const html = renderSharePage({ ...base, title: '<script>alert(1)</script>特惠' })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('跳转目标写入 meta refresh 与 JS replace，人类访客自动进入详情页', () => {
    const html = renderSharePage(base)
    // meta refresh 中 URL 的 & 被 HTML 转义为 &amp;
    expect(html).toContain(`content="0;url=${base.targetUrl.replace(/&/g, '&amp;')}"`)
    expect(html).toContain(JSON.stringify(base.targetUrl))
  })

  it('无封面时不输出 og:image 的空值图片标签', () => {
    const html = renderSharePage({ ...base, imageUrl: '' })
    expect(html).not.toContain('og:image')
    expect(html).not.toContain('<img')
  })
})
