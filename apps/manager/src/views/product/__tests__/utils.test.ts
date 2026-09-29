/**
 * product/utils 单元测试：富文本压缩优化与经理登录信息读取
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { optimizeRichText, readManagerInfo } from '../utils'
import { logger } from '@promo/shared/utils/logger'

vi.mock('@promo/shared/utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('optimizeRichText', () => {
  it('空内容直接返回空字符串', () => {
    expect(optimizeRichText('')).toBe('')
  })

  it('移除注释、class/style 属性并压缩空白', () => {
    // 注意：空白压缩先于属性移除执行，属性删除后会残留空格
    expect(optimizeRichText('<p class="a" style="color:red">  hello   world  </p><!-- note -->')).toBe('<p  > hello world </p>')
  })

  it('检测到 base64 图片时告警并保留内容', () => {
    const html = '<img src="data:image/png;base64,AAAA">'
    const result = optimizeRichText(html)
    expect(logger.warn).toHaveBeenCalledWith('[富文本] 检测到 1 张 base64 图片，请使用编辑器上传功能')
    expect(result).toBe(html)
  })
})

describe('readManagerInfo', () => {
  it('正常缓存返回解析后的经理信息', () => {
    localStorage.setItem('manager_info', JSON.stringify({ id: 'm9', name: '经理' }))
    expect(readManagerInfo()).toEqual({ id: 'm9', name: '经理' })
  })

  it('缓存缺失、非法 JSON 或缺少 id 时抛出统一错误', () => {
    expect(() => readManagerInfo()).toThrow('登录信息已过期，请重新登录')
    localStorage.setItem('manager_info', '{bad json')
    expect(() => readManagerInfo()).toThrow('登录信息已过期，请重新登录')
    localStorage.setItem('manager_info', JSON.stringify({ name: '经理' }))
    expect(() => readManagerInfo()).toThrow('登录信息已过期，请重新登录')
  })
})
