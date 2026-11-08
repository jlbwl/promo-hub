import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import { getErrorMessage } from '@promo/shared'
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
    // O1：已有 cookie 时复用原 token，避免并发请求/静态资源导致 token 频繁轮换
    const existing = req.cookies?.csrfToken
    const token = typeof existing === 'string' && existing ? existing : generateCsrfToken()

    if (!existing) {
      // 仅在首次无 token 时下发 cookie
      res.cookie('csrfToken', token, {
        httpOnly: false, // 前端 JS 需要读取这个 token
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24小时
      })
    }

    // 同时设置到响应本地变量，供视图使用
    res.locals.csrfToken = token

    // 将 token 附加到 request 对象，方便后续中间件使用
    // （@types/csurf 将 req.csrfToken 声明为函数，此中间件运行时存的是字符串值，需断言收窄）
    ;(req as unknown as { csrfToken?: string }).csrfToken = token

    next()
  } catch (error) {
    logger.error('[CSRF] Failed to generate token:', { error: getErrorMessage(error) })
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
  // 注意：nginx/vite 代理会剥掉 /api 前缀，req.path 实际为 /admin/login 等，
  // 因此列表不写 /api 前缀，匹配前统一归一化
  const bypassPaths = [
    // 管理员登录和短信验证码
    '/admin/login',
    '/admin/sms/send',
    '/admin/sms/login',

    // 经理登录和短信验证码
    '/manager/login',
    '/manager/sms/send',
    '/manager/sms/login',
    '/managers/login',
    '/managers/sms/send',
    '/managers/sms/login',

    // 用户注册、登录和短信验证码
    '/user/login',
    '/user/sms/send',
    '/user/sms/login',
    '/user/register',
    '/users/login',
    '/users/sms/send',
    '/users/sms/login',
    '/users/register',

    // 员工登录
    '/employees/login',

    // Token 刷新（access token 可能已过期）；登出仍需校验 CSRF，前端会带 X-CSRF-Token
    '/auth/refresh',
    '/users/refresh',

    // 密码重置（通过短信验证码，无需登录态）
    '/managers/password/set',
    '/users/password/set',

    // CSRF token 接口本身
    '/csrf-token'
  ]

  // 兼容带 /api 前缀与不带前缀两种请求形态
  const normalizedPath = req.path.replace(/^\/api(?=\/)/, '')

  if (bypassPaths.some(path => normalizedPath === path)) {
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
export function getCsrfToken(req: Request, res: Response) {
  // O1：复用已有 cookie token，避免每次获取都轮换导致并发请求 403
  const existing = req.cookies?.csrfToken
  const token = typeof existing === 'string' && existing ? existing : generateCsrfToken()

  if (!existing) {
    res.cookie('csrfToken', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    })
  }

  res.json({
    code: 0,
    message: '获取成功',
    data: { csrfToken: token }
  })
}
