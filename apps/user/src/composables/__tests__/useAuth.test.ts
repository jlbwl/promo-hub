/**
 * useAuth 单元测试：本地登录态校验、token 刷新、认证信息清理
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuth } from '../useAuth'
import { refreshTokens } from '@promo/shared/utils/request'

vi.mock('@promo/shared/utils/request', () => ({ refreshTokens: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('checkAuth', () => {
  it('无 token 时未登录', async () => {
    const auth = useAuth()
    await expect(auth.checkAuth()).resolves.toBe(false)
    expect(auth.isAuthenticated.value).toBe(false)
  })

  it('有 token 但缺 user_info 时未登录', async () => {
    localStorage.setItem('user_token', 't')
    const auth = useAuth()
    await expect(auth.checkAuth()).resolves.toBe(false)
    expect(auth.isAuthenticated.value).toBe(false)
  })

  it('user_info 缺少 id 时视为损坏：清除该项并返回未登录', async () => {
    localStorage.setItem('user_token', 't')
    localStorage.setItem('user_info', JSON.stringify({ nickname: 'n' }))
    const auth = useAuth()

    await expect(auth.checkAuth()).resolves.toBe(false)

    expect(localStorage.getItem('user_info')).toBeNull()
    expect(localStorage.getItem('user_token')).toBe('t')
  })

  it('user_info JSON 损坏时清除该项并返回未登录', async () => {
    localStorage.setItem('user_token', 't')
    localStorage.setItem('user_info', '{broken')
    const auth = useAuth()

    await expect(auth.checkAuth()).resolves.toBe(false)
    expect(localStorage.getItem('user_info')).toBeNull()
  })

  it('token 与含 id 的 user_info 齐全即视为已登录', async () => {
    localStorage.setItem('user_token', 't')
    localStorage.setItem('user_info', JSON.stringify({ id: 'u_1' }))
    const auth = useAuth()

    await expect(auth.checkAuth()).resolves.toBe(true)
    expect(auth.isAuthenticated.value).toBe(true)
  })
})

describe('refreshToken', () => {
  it('复用 shared 刷新成功返回 true', async () => {
    vi.mocked(refreshTokens).mockResolvedValue('new-token')
    const auth = useAuth()
    await expect(auth.refreshToken()).resolves.toBe(true)
    expect(refreshTokens).toHaveBeenCalledTimes(1)
  })

  it('刷新失败返回 false 且不向外抛错', async () => {
    vi.mocked(refreshTokens).mockRejectedValue(new Error('expired'))
    const auth = useAuth()
    await expect(auth.refreshToken()).resolves.toBe(false)
  })
})

describe('clearAuth / getToken / getUserInfo', () => {
  it('clearAuth 清除全部认证存储并复位登录状态', () => {
    localStorage.setItem('user_token', 't')
    localStorage.setItem('user_info', '{"id":"u_1"}')
    localStorage.setItem('refresh_token', 'r')
    localStorage.setItem('user_refresh_token', 'ur')
    const auth = useAuth()

    auth.clearAuth()

    expect(localStorage.getItem('user_token')).toBeNull()
    expect(localStorage.getItem('user_info')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
    expect(localStorage.getItem('user_refresh_token')).toBeNull()
    expect(auth.isAuthenticated.value).toBe(false)
  })

  it('getToken 读取 user_token，缺失时为 null', () => {
    const auth = useAuth()
    expect(auth.getToken()).toBeNull()
    localStorage.setItem('user_token', 't')
    expect(auth.getToken()).toBe('t')
  })

  it('getUserInfo 返回解析对象，缺失/损坏时为 null', () => {
    const auth = useAuth()
    expect(auth.getUserInfo()).toBeNull()

    localStorage.setItem('user_info', JSON.stringify({ id: 'u_1' }))
    expect(auth.getUserInfo()).toEqual({ id: 'u_1' })

    localStorage.setItem('user_info', '{broken')
    expect(auth.getUserInfo()).toBeNull()
  })
})
