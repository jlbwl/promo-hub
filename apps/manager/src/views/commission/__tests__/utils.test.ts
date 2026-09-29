/**
 * commission/utils 单元测试：订单状态映射、脱敏与时间格式化（shared 再导出）、经理身份读取
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { formatTime, getManagerId, maskName, maskPhone, statusTagType, statusText } from '../utils'

beforeEach(() => {
  localStorage.clear()
})

describe('statusTagType / statusText', () => {
  it('状态映射到标签类型与中文文案，未知状态兜底', () => {
    expect(statusTagType('pending')).toBe('warning')
    expect(statusTagType('approved')).toBe('success')
    // 注意：源码中 pending_payment 映射为 ''，但 `map[status] || 'info'` 使空串回落为 'info'
    expect(statusTagType('pending_payment')).toBe('info')
    expect(statusTagType('settled')).toBe('success')
    expect(statusTagType('rejected')).toBe('danger')
    expect(statusTagType('unknown')).toBe('info')

    expect(statusText('pending')).toBe('待审核')
    expect(statusText('approved')).toBe('已通过')
    expect(statusText('pending_payment')).toBe('待发放')
    expect(statusText('settled')).toBe('已发放')
    expect(statusText('rejected')).toBe('已驳回')
    expect(statusText('unknown')).toBe('unknown')
  })
})

describe('脱敏与时间格式化（shared 再导出）', () => {
  it('maskPhone 保留前 3 后 4，短号与空值兜底', () => {
    expect(maskPhone('13812345678')).toBe('138****5678')
    expect(maskPhone('123')).toBe('123')
    expect(maskPhone(undefined)).toBe('--')
  })

  it('maskName 保留首尾字符，空值兜底', () => {
    expect(maskName('张三')).toBe('张*')
    expect(maskName('欧阳锋')).toBe('欧*锋')
    expect(maskName(undefined)).toBe('--')
  })

  it('formatTime 按 UTC+8 输出分钟级时间，空值返回占位文本', () => {
    expect(formatTime('2026-01-02T15:30:00Z')).toBe('2026-01-02 23:30')
    expect(formatTime('')).toBe('')
    expect(formatTime(undefined, '暂无')).toBe('暂无')
  })
})

describe('getManagerId', () => {
  it('读取 manager_info 中的 id', () => {
    localStorage.setItem('manager_info', JSON.stringify({ id: 'm1', name: '经理' }))
    expect(getManagerId()).toBe('m1')
  })

  it('缺失、非法 JSON 或缺少 id 时返回空字符串', () => {
    expect(getManagerId()).toBe('')
    localStorage.setItem('manager_info', '{bad json')
    expect(getManagerId()).toBe('')
    localStorage.setItem('manager_info', JSON.stringify({ name: '经理' }))
    expect(getManagerId()).toBe('')
  })
})
