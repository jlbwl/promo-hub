/**
 * 密码登录身份回退逻辑测试：
 * 只有明确的凭据失败才允许尝试员工身份，网络错误/超时/5xx 一律不发起第二次请求
 */
import { describe, it, expect, vi } from 'vitest'
import { isCredentialFailure, loginWithIdentityFallback } from '../usePasswordLogin'

const createHooks = () => ({
  loginUser: vi.fn<() => Promise<{ token: string }>>(),
  loginEmployee: vi.fn<() => Promise<{ token: string }>>(),
  onUserLogin: vi.fn(),
  onEmployeeLogin: vi.fn(),
  notify: vi.fn(),
  onFailure: vi.fn(),
})

describe('isCredentialFailure', () => {
  it('网络错误与超时不视为凭据失败', () => {
    const networkError = Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })
    const timeoutError = Object.assign(new Error('timeout'), { code: 'ECONNABORTED' })
    expect(isCredentialFailure(networkError)).toBe(false)
    expect(isCredentialFailure(timeoutError)).toBe(false)
  })

  it('5xx 与限流不视为凭据失败', () => {
    expect(isCredentialFailure({ response: { status: 500 } })).toBe(false)
    expect(isCredentialFailure({ response: { status: 429 } })).toBe(false)
    expect(isCredentialFailure({ code: 500 })).toBe(false)
    expect(isCredentialFailure({ code: 429 })).toBe(false)
  })

  it('4xx 与凭据业务码视为凭据失败', () => {
    expect(isCredentialFailure({ response: { status: 400 } })).toBe(true)
    expect(isCredentialFailure({ response: { status: 401 } })).toBe(true)
    // 用户登录 INVALID_CREDENTIALS=2003，员工登录业务码 1
    expect(isCredentialFailure({ code: 2003 })).toBe(true)
    expect(isCredentialFailure({ code: 1 })).toBe(true)
  })
})

describe('loginWithIdentityFallback', () => {
  it('普通登录成功时不再请求员工登录', async () => {
    const hooks = createHooks()
    hooks.loginUser.mockResolvedValue({ token: 'user-token' })

    await expect(loginWithIdentityFallback(hooks)).resolves.toBe('user')
    expect(hooks.loginEmployee).not.toHaveBeenCalled()
    expect(hooks.onEmployeeLogin).not.toHaveBeenCalled()
  })

  it('网络错误时只发一次请求，不触发员工登录', async () => {
    const hooks = createHooks()
    const networkError = Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })
    hooks.loginUser.mockRejectedValue(networkError)

    await expect(loginWithIdentityFallback(hooks)).resolves.toBe('failed')
    expect(hooks.loginUser).toHaveBeenCalledTimes(1)
    expect(hooks.loginEmployee).not.toHaveBeenCalled()
    expect(hooks.onFailure).toHaveBeenCalledWith(networkError)
  })

  it('服务端 5xx 时不触发员工登录', async () => {
    const hooks = createHooks()
    const serverError = { response: { status: 503 } }
    hooks.loginUser.mockRejectedValue(serverError)

    await expect(loginWithIdentityFallback(hooks)).resolves.toBe('failed')
    expect(hooks.loginEmployee).not.toHaveBeenCalled()
    expect(hooks.onFailure).toHaveBeenCalledWith(serverError)
  })

  it('凭据错误时提示正在切换身份并尝试员工登录', async () => {
    const hooks = createHooks()
    hooks.loginUser.mockRejectedValue({ code: 2003 })
    hooks.loginEmployee.mockResolvedValue({ token: 'employee-token' })

    await expect(loginWithIdentityFallback(hooks)).resolves.toBe('employee')
    expect(hooks.loginEmployee).toHaveBeenCalledTimes(1)
    expect(hooks.onEmployeeLogin).toHaveBeenCalledWith({ token: 'employee-token' })
    expect(hooks.notify).toHaveBeenCalledWith('账号或密码不匹配，正在尝试员工身份登录')
    expect(hooks.onFailure).not.toHaveBeenCalled()
  })

  it('员工登录也失败时给出明确失败提示', async () => {
    const hooks = createHooks()
    hooks.loginUser.mockRejectedValue({ response: { status: 401 } })
    hooks.loginEmployee.mockRejectedValue({ code: 400 })

    await expect(loginWithIdentityFallback(hooks)).resolves.toBe('failed')
    expect(hooks.loginEmployee).toHaveBeenCalledTimes(1)
    expect(hooks.notify).toHaveBeenCalledWith('账号或密码不匹配，正在尝试员工身份登录')
    expect(hooks.onFailure).toHaveBeenCalled()
  })
})
