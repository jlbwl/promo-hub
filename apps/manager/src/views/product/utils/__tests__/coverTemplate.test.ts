import { describe, expect, it } from 'vitest'
import type { ProductCategory } from '@promo/shared/types'
import {
  buildCoverTemplate,
  buildCoverTemplates,
  coverSignature,
  getAutoCoverSignature,
  isAutoCover,
  markAutoCover,
  stableHash,
} from '../coverTemplate'

const category = (id: string, value: string, name: string): ProductCategory => ({
  id,
  value,
  name,
  sort: 0,
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
})

const categories = [
  category('c1', 'comprehensive-instant', '综合-立返'),
  category('c2', 'personal-insurance', '个养和加挂'),
  category('c3', 'limit3-instant', '限三-立返'),
  category('c4', 'unlimit3-data', '不限三-数据'),
  category('c5', 'third-party-instant', '三方-立返'),
]

describe('coverTemplate', () => {
  it('模板数量跟随分类数量动态生成', () => {
    expect(buildCoverTemplates(categories)).toHaveLength(categories.length)
    expect(buildCoverTemplates(categories.slice(0, 3))).toHaveLength(3)
    expect(buildCoverTemplates([])).toHaveLength(0)
  })

  it('同一分类的模板稳定一致，不受列表顺序与数量影响', () => {
    const first = buildCoverTemplate(categories[1])
    const reordered = buildCoverTemplates([...categories].reverse()).find(
      (item) => item.categoryValue === categories[1].value
    )
    expect(reordered).toEqual(first)
    expect(buildCoverTemplate(categories[1])).toEqual(first)
  })

  it('不同分类生成不同的配色或装饰', () => {
    const templates = buildCoverTemplates(categories)
    const looks = templates.map((item) => `${item.fromColor}|${item.midColor}|${item.toColor}|${item.ornament}`)
    expect(new Set(looks).size).toBe(looks.length)
  })

  it('稳定哈希对相同输入返回相同结果', () => {
    expect(stableHash('limit3-instant')).toBe(stableHash('limit3-instant'))
    expect(stableHash('limit3-instant')).not.toBe(stableHash('unlimit3-data'))
  })

  it('自动封面标记可写入、读取与识别', () => {
    const signature = coverSignature('测试产品', 'limit3-instant')
    const url = markAutoCover('/uploads/covers/a.png', signature)
    expect(url).toBe(`/uploads/covers/a.png?gen=${signature}`)
    expect(isAutoCover(url)).toBe(true)
    expect(getAutoCoverSignature(url)).toBe(signature)

    // 人工上传的地址没有标记，不能被识别为自动封面
    expect(isAutoCover('/uploads/covers/manual.png')).toBe(false)
    expect(getAutoCoverSignature('/uploads/covers/manual.png')).toBeNull()
  })

  it('重新标记不会重复拼接查询参数', () => {
    const first = markAutoCover('/uploads/covers/a.png', '0000aaaa')
    const second = markAutoCover(first, '0000bbbb')
    expect(second).toBe('/uploads/covers/a.png?gen=0000bbbb')
  })

  it('标题或分类变化时签名变化', () => {
    expect(coverSignature('产品 A', 'limit3-instant')).not.toBe(coverSignature('产品 B', 'limit3-instant'))
    expect(coverSignature('产品 A', 'limit3-instant')).not.toBe(coverSignature('产品 A', 'unlimit3-data'))
  })
})
