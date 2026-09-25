import csurf from 'csurf'
import { Request, Response, NextFunction, RequestHandler } from 'express'
import logger from '../utils/logger.js'

// 配置CSRF保护
const csrfProtection: RequestHandler = csurf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  }
})

// 安全获取CSRF token的中间件
export function csrfTokenMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // 提供 csrfToken 方法（类型由 @types/csurf 的 Express.Request 扩展提供）
    res.locals.csrfToken = () => req.csrfToken()
    next()
  } catch (error) {
    next(error)
  }
}

// CSRF错误处理中间件
export function csrfErrorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if ((err as { code?: string }).code !== 'EBADCSRFTOKEN') {
    return next(err)
  }

  logger.warn('[CSRF] Invalid CSRF token', {
    ip: req.ip,
    method: req.method,
    url: req.originalUrl
  })

  res.status(403).json({
    code: 403,
    message: '无效的CSRF令牌，请刷新页面重试',
    data: null
  })
}

export { csrfProtection }
