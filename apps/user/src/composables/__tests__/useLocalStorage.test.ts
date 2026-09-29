/**
 * useLocalStorage / useUser 单元测试：本地身份读取
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useLocalStorage, useUser } from '../useLocalStorage'

beforeEach(() => {
  localStorage.clear()
})

describe('useLocalStorage', () => {
  it('未存储时返回默认值', () => {
    const { get } = useLocalStorage<{ id?: string }>('user_info', {})
    expect(get()).toEqual({})
  })

  it('set 后 get 返回存储对象', () => {
    const { get, set } = useLocalStorage<{ id?: string }>('user_info', {})
    set({ id: 'u_1' })
    expect(get()).toEqual({ id: 'u_1' })
  })

  it('存储内容损坏时返回默认值', () => {
    localStorage.setItem('user_info', '{broken json')
    const { get } = useLocalStorage<{ id?: string }>('user_info', {})
    expect(get()).toEqual({})
  })

  it('remove 后回到默认值', () => {
    const { get, set, remove } = useLocalStorage<{ id?: string }>('user_info', {})
    set({ id: 'u_1' })
    remove()
    expect(get()).toEqual({})
  })
})

describe('useUser', () => {
  it('getUserId 读取 user_info.id，缺失时为空串', () => {
    expect(useUser().getUserId()).toBe('')
    localStorage.setItem('user_info', JSON.stringify({ id: 'u_1', teamName: 'A团队' }))
    expect(useUser().getUserId()).toBe('u_1')
  })

  it('getManagerId 读取归属经理', () => {
    localStorage.setItem('user_info', JSON.stringify({ managerId: 'm_1' }))
    expect(useUser().getManagerId()).toBe('m_1')
  })

  it('isEmployee 依据 login_type 判断（全项目原始字符串写入，非 JSON）', () => {
    expect(useUser().isEmployee()).toBe(false)
    localStorage.setItem('login_type', 'employee')
    expect(useUser().isEmployee()).toBe(true)
  })
})
