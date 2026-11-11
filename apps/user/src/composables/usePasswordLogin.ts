/**
 * 密码登录身份回退逻辑
 *
 * 只有明确的凭据失败（4xx 或业务错误码）才尝试员工身份登录；
 * 网络错误、超时、5xx、限流一律只保留一次请求，避免放大限流并误判为两次失败。
 */

import { ErrorCode } from '@promo/shared/utils/errors'

export interface PasswordLoginHooks<U, E> {
  /** 普通用户登录请求 */
  loginUser: () => Promise<U>
  /** 员工登录请求 */
  loginEmployee: () => Promise<E>
  /** 普通登录成功回调 */
  onUserLogin: (data: U) => void
  /** 员工登录成功回调 */
  onEmployeeLogin: (data: E) => void
  /** 轻提示（用于告知正在切换身份） */
  notify: (message: string) => void
  /** 最终失败回调，透传原始错误供页面展示 */
  onFailure: (error: unknown) => void
}

export type PasswordLoginResult = 'user' | 'employee' | 'failed'

// 凭据类业务码：用户登录 2003、员工登录 1、兼容历史 401
const CREDENTIAL_BUSINESS_CODES = new Set<number>([1, 401, ErrorCode.INVALID_CREDENTIALS])

/**
 * 判断是否为明确的凭据类失败（账号或密码不匹配）
 */
export function isCredentialFailure(error: unknown): boolean {
  if (!error) return false
  const err = error as { response?: { status?: number }; code?: number | string }

  // axios 以字符串 code 标记网络错误/超时（如 ERR_NETWORK、ECONNABORTED），没有服务端响应
  if (typeof err.code === 'string') return false

  const status = err.response?.status
  if (typeof status === 'number') {
    return status >= 400 && status < 500 && status !== 429
  }

  // 业务错误码失败（HTTP 200/4xx 被请求层归一化后只保留业务码）
  return typeof err.code === 'number' && CREDENTIAL_BUSINESS_CODES.has(err.code)
}

/**
 * 执行密码登录：凭据失败时切换员工身份，其余失败直接返回
 */
export async function loginWithIdentityFallback<U, E>(
  hooks: PasswordLoginHooks<U, E>,
): Promise<PasswordLoginResult> {
  try {
    const data = await hooks.loginUser()
    hooks.onUserLogin(data)
    return 'user'
  } catch (error) {
    if (!isCredentialFailure(error)) {
      hooks.onFailure(error)
      return 'failed'
    }

    // 明确告知正在切换身份，避免用户以为仍是普通登录
    hooks.notify('账号或密码不匹配，正在尝试员工身份登录')
    try {
      const data = await hooks.loginEmployee()
      hooks.onEmployeeLogin(data)
      return 'employee'
    } catch {
      hooks.onFailure(new Error('登录失败：手机号或密码不正确，员工身份同样未通过'))
      return 'failed'
    }
  }
}
