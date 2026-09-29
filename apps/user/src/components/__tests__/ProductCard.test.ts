/**
 * ProductCard 组件测试：渲染、访客/登录态收藏按钮、事件
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Vant from 'vant'
import type { Product } from '@promo/shared/types'
import ProductCard from '../ProductCard.vue'

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/' }),
}))

const product: Product & { inCart?: boolean } = {
  id: 'p_1',
  title: '测试产品',
  description: '',
  coverImage: 'https://x/a.png',
  price: 99,
  category: 'test',
  status: 'published',
  createdAt: '2026-01-01 00:00:00',
}

// 生产环境由 unplugin-vue-components 自动导入，测试需显式注册 Vant 与 v-lazy 指令
const mountCard = (props: Record<string, unknown> = {}) =>
  mount(ProductCard, {
    props: { product, ...props },
    global: { plugins: [Vant], directives: { lazy: {} } },
  })

beforeEach(() => {
  localStorage.clear()
})

describe('ProductCard', () => {
  it('渲染标题与价格', () => {
    const w = mountCard()
    expect(w.find('.product-title').text()).toBe('测试产品')
    expect(w.find('.product-price').text()).toBe('¥99')
  })

  it('访客（无 token）不显示收藏按钮', () => {
    expect(mountCard().find('.product-actions').exists()).toBe(false)
  })

  it('登录用户显示收藏按钮，点击发出 add-to-cart', async () => {
    localStorage.setItem('user_token', 't')
    const w = mountCard()
    expect(w.find('.product-actions').exists()).toBe(true)
    await w.find('.product-actions button').trigger('click')
    expect(w.emitted('add-to-cart')?.[0]?.[0]).toMatchObject({ id: 'p_1' })
  })

  it('showActions=false 时登录也不显示', () => {
    localStorage.setItem('user_token', 't')
    expect(mountCard({ showActions: false }).find('.product-actions').exists()).toBe(false)
  })

  it('点击卡片发出 click 事件并携带产品', async () => {
    const w = mountCard()
    await w.find('.product-card').trigger('click')
    expect(w.emitted('click')?.[0]?.[0]).toMatchObject({ id: 'p_1' })
  })

  it('categoryName 存在时渲染分类标签', () => {
    expect(mountCard({ categoryName: '美妆' }).find('.category-tag').text()).toBe('美妆')
  })
})
