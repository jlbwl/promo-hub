import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import logger from '../utils/logger.js'

/**
 * CSRF 防护中间件（Double Submit Cookie 模式）
 *
 * 安全设计：
 * 1. Token 使用 crypto.randomBytes 生成，确保不可预测
 * 2. 强制要求 cookie 和 header/body 同时存在且匹配，防止绕过
 * 3. 仅精确匹配路径绕过（登录、注册、token 刷新等）
 */

// 生成 CSRF token（使用随机数，避免可预测性）
function generateCsrfToken(): string {
  // 32字节随机数 + 时间戳混合，确保唯一性和不可预测性
  const random = crypto.randomBytes(32).toString('hex')
  const timestamp = Date.now().toString(36)
  return `${random}.${timestamp}`
}

// CSRF 中间件 - 生成 token 并设置到 cookie
export function csrfGenerate(req: Request, res: Response, next: NextFunction) {
  try {
    // 生成 CSRF token（随机生成，无需 sessionId 参与）
    const token = generateCsrfToken()

    // 将 token 存储在 cookie 中（httpOnly: false, 安全）
    res.cookie('csrfToken', token, {
      httpOnly: false, // 前端 JS 需要读取这个 token
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24小时
    })

    // 同时设置到响应本地变量，供视图使用
    res.locals.csrfToken = token

    // 将 token 附加到 request 对象，方便后续中间件使用
    ;(req as any).csrfToken = token

    next()
  } catch (error) {
    logger.error('[CSRF] Failed to generate token:', { error: error instanceof Error ? error.message : String(error) })
    next()
  }
}

// CSRF 验证中间件
export function csrfVerify(req: Request, res: Response, next: NextFunction) {
  // 只验证非 GET 请求
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next()
  }

  // 允许绕过 CSRF 的关键接口（仅精确匹配）
  // 仅包含：未登录态可访问的接口 + token 刷新/登出接口（登录态可能已过期）
  const bypassPaths = [
    // 管理员登录和短信验证码
    '/api/admin/login',
    '/api/admin/sms/send',
    '/api/admin/sms/login',

    // 经理登录和短信验证码
    '/api/manager/login',
    '/api/manager/sms/send',
    '/api/manager/sms/login',
    '/api/managers/login',
    '/api/managers/sms/send',
    '/api/managers/sms/login',

    // 用户注册、登录和短信验证码
    '/api/user/login',
    '/api/user/sms/send',
    '/api/user/sms/login',
    '/api/user/register',
    '/api/users/login',
    '/api/users/sms/send',
    '/api/users/sms/login',
    '/api/users/register',

    // 员工登录
    '/api/employees/login',

    // Token 刷新和登出（登录态可能已过期，无法通过 CSRF 验证）
    '/api/auth/refresh',
    '/api/auth/logout',
    '/api/users/refresh',
    '/api/users/logout',

    // 密码重置（通过短信验证码，无需登录态）
    '/api/managers/password/set',
    '/api/users/password/set',

    // CSRF token 接口本身
    '/api/csrf-token'
  ]

  if (bypassPaths.some(path => req.path === path)) {
    logger.info('[CSRF] Bypassing CSRF for safe path', {
      path: req.path,
      method: req.method
    })
    return next()
  }

  // 获取请求中的 token
  const bodyToken = req.body?._csrf || req.body?.csrfToken
  const headerToken = req.headers['x-csrf-token'] as string
  const cookieToken = req.cookies?.csrfToken

  const requestToken = bodyToken || headerToken

  // 验证 token：必须同时存在 requestToken 和 cookieToken，且两者必须匹配
  // 修复：之前的逻辑在 cookieToken 为空时会跳过验证，导致绕过漏洞
  if (!requestToken) {
    logger.warn('[CSRF] Missing token in request', {
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      hasCookieToken: !!cookieToken
    })
    return res.status(403).json({
      code: 403,
      message: 'CSRF token missing',
      data: null
    })
  }

  // 强制要求 cookieToken 存在且与 requestToken 匹配
  // 修复：改为严格要求，防止攻击者清除 cookie 绕过验证
  if (!cookieToken || requestToken !== cookieToken) {
    logger.warn('[CSRF] Token mismatch or missing cookie token', {
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      hasCookieToken: !!cookieToken
    })
    return res.status(403).json({
      code: 403,
      message: 'Invalid CSRF token',
      data: null
    })
  }

  // Token 验证通过
  logger.debug('[CSRF] Token verified', {
    ip: req.ip,
    method: req.method,
    url: req.originalUrl
  })
  next()
}

// 获取 CSRF token 的接口
export function getCsrfToken(_req: Request, res: Response) {
  const token = generateCsrfToken()

  // 设置到 cookie
  res.cookie('csrfToken', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
  })

  res.json({
    code: 0,
    message: '获取成功',
    data: { csrfToken: token }
  })
}
