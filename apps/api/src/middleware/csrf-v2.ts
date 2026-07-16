import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import logger from '../utils/logger.js'

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.SESSION_SECRET || 'csrf-default-secret-change-in-production'

// 生成 CSRF token
function generateCsrfToken(secret: string, sessionId: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(sessionId + Date.now().toString())
    .digest('hex')
}

// CSRF 中间件 - 生成 token 并设置到 cookie
export function csrfGenerate(req: Request, res: Response, next: NextFunction) {
  try {
    // 生成 CSRF token
    const sessionId = req.sessionID || 'anonymous'
    const token = generateCsrfToken(CSRF_SECRET, sessionId)
    
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
  
  // 允许绕过 CSRF 的关键接口
  const bypassPaths = [
    // 登录和认证相关
    '/api/admin/login',
    '/api/manager/login',
    '/api/manager/sms/send',
    '/api/manager/sms/login',
    '/api/user/login',
    '/api/user/sms/send',
    '/api/user/sms/login',
    '/api/user/register',
    '/api/auth/refresh',

    // CSRF token 接口本身
    '/api/csrf-token'
  ]
  
  // 检查路径是否需要绕过
  if (bypassPaths.some(path => req.path === path || req.path.startsWith(path + '/'))) {
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
  
  // 验证 token
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
  
  // 如果有 cookie token，进行 Double Submit 验证
  if (cookieToken && requestToken !== cookieToken) {
    logger.warn('[CSRF] Token mismatch', {
      ip: req.ip,
      method: req.method,
      url: req.originalUrl
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
  const sessionId = req.sessionID || 'anonymous'
  const token = generateCsrfToken(CSRF_SECRET, sessionId)
  
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
