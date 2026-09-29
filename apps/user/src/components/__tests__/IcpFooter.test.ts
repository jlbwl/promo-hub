/**
 * IcpFooter 组件测试：备案号渲染与占位文案
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import IcpFooter from '../IcpFooter.vue'

describe('IcpFooter', () => {
  it('配置备案号时渲染指向备案系统的链接', () => {
    const w = mount(IcpFooter, { props: { icpNumber: '京ICP备2026号' } })

    const link = w.find('.icp-link')
    expect(link.text()).toBe('京ICP备2026号')
    expect(link.attributes('href')).toBe('https://beian.miit.gov.cn/')
    expect(link.attributes('target')).toBe('_blank')
    expect(w.find('.icp-placeholder').exists()).toBe(false)
  })

  it('未配置备案号时显示占位文案', () => {
    const w = mount(IcpFooter)

    expect(w.find('.icp-placeholder').text()).toBe('请在备案成功后配置备案号')
    expect(w.find('.icp-link').exists()).toBe(false)
  })
})
