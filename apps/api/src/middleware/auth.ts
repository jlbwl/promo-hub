import { Request, Response, NextFunction, RequestHandler } from 'express'
import session, { Session } from 'express-session'
import jwt from 'jsonwebtoken'

// 确保有默认值的环境变量
const SESSION_SECRET = process.env.SESSION_SECRET || 'default-session-secret-change-in-production-please'
const JWT_SECRET = process.env.JWT_SECRET || 'default-jwt-secret-change-in-production-please'

export interface AuthUser {
  id: string
  phone: string
  role: 'admin' | 'manager' | 'user' | 'employee'
  nickname?: string
  teamName?: string
  userId?: string
  token?: string
}

declare module 'express-session' {
  interface SessionData {
    user?: AuthUser
    isAuthenticated?: boolean
  }
}

// Token 存储（临时方案，生产环境应使用 Redis）
const tokenStore = new Map<string, AuthUser>()

// Refresh Token 存储（用于刷新 Token）
const refreshTokenStore = new Map<string, AuthUser>()

// 创建 session 中间件（支持 MongoDB 降级到内存存储）
export const sessionMiddleware: RequestHandler = (() => {
  let store: any = undefined
  
  if (process.env.MONGODB_URI) {
    try {
      const MongoStore = require('connect-mongo').default
      store = MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 7 * 24 * 60 * 60,
        touchAfter: 24 * 60 * 60,
      })
      console.log('[Session] 使用 MongoDB 存储')
    } catch (err) {
      console.warn('[Session] MongoDB 连接失败，降级到内存存储:', err)
    }
  } else {
    console.log('[Session] 未配置 MongoDB，使用内存存储')
  }
  
  return session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    },
  })
})()

// 生成 JWT Token（Access Token - 短期有效）
export function generateAuthToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, phone: user.phone, role: user.role, type: 'access' },
    JWT_SECRET,
    { expiresIn: '1h' } // Access Token 有效期 1 小时
  )
}

// 生成 Refresh Token（长期有效）
export function generateRefreshToken(user: AuthUser): string {
  const refreshToken = jwt.sign(
    { id: user.id, phone: user.phone, role: user.role, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '7d' } // Refresh Token 有效期 7 天
  )
  
  // 存储 Refresh Token
  refreshTokenStore.set(refreshToken, user)
  
  return refreshToken
}

// 同时生成 Access Token 和 Refresh Token
export function generateTokens(user: AuthUser): { token: string; refreshToken: string } {
  const token = generateAuthToken(user)
  const refreshToken = generateRefreshToken(user)
  return { token, refreshToken }
}

// 验证 JWT Token
function verifyAuthToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    return {
      id: decoded.id,
      phone: decoded.phone,
      role: decoded.role,
      token
    }
  } catch {
    return null
  }
}

export const authMiddleware = (allowedRoles?: Array<'admin' | 'manager' | 'user' | 'employee'>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    // 1. 优先检查 Session
    if (req.session && req.session.isAuthenticated && req.session.user) {
      if (allowedRoles && allowedRoles.length > 0) {
        const userRole = req.session.user.role
        if (!allowedRoles.includes(userRole)) {
          res.status(403).json({
            code: 403,
            message: '您没有权限执行此操作',
            data: null
          })
          return
        }
      }
      // 将用户信息附加到 request
      ;(req as any).user = req.session.user
      next()
      return
    }

    // 2. 检查 Bearer Token（JWT）
    if (bearerToken) {
      const user = verifyAuthToken(bearerToken)
      if (user) {
        if (allowedRoles && allowedRoles.length > 0) {
          if (!allowedRoles.includes(user.role)) {
            res.status(403).json({
              code: 403,
              message: '您没有权限执行此操作',
              data: null
            })
            return
          }
        }
        // 将用户信息附加到 request
        ;(req as any).user = user
        next()
        return
      }
    }

    res.status(401).json({
      code: 401,
      message: '未登录或会话已过期，请重新登录',
      data: null
    })
  }
}

export const login = (req: Request, user: AuthUser): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      req.session.user = user
      req.session.isAuthenticated = true
      req.session.save((err) => {
        if (err) {
          console.error('[Session] 保存会话失败:', err)
          reject(err)
        } else {
          console.log(`[Session] 用户 ${user.id} (${user.role}) 登录成功`)
          resolve()
        }
      })
    } catch (error) {
      console.error('[Session] 设置会话失败:', error)
      reject(error)
    }
  })
}

// 兼容旧的调用方式（不等待的版本）
export const loginSync = (req: Request, user: AuthUser) => {
  login(req, user).catch(err => {
    console.error('[Session] 会话保存出错（但不影响请求）:', err)
  })
}

export const logout = (req: Request) => {
  const userId = req.session?.user?.id
  req.session.destroy((err) => {
    if (err) {
      console.error('[Session] 销毁会话失败:', err)
    } else {
      console.log(`[Session] 用户 ${userId} 已登出`)
    }
  })
}

// 刷新 Token
export function refreshAuthToken(refreshToken: string): { token: string; refreshToken: string } | null {
  try {
    // 验证 Refresh Token
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as any
    
    if (decoded.type !== 'refresh') {
      console.warn('[Auth] 无效的 Refresh Token 类型')
      return null
    }
    
    // 检查 Refresh Token 是否在存储中
    const user = refreshTokenStore.get(refreshToken)
    if (!user) {
      console.warn('[Auth] Refresh Token 不存在或已失效')
      return null
    }
    
    // 生成新的 Access Token 和 Refresh Token
    const authUser: AuthUser = {
      id: decoded.id,
      phone: decoded.phone,
      role: decoded.role
    }
    
    // 删除旧的 Refresh Token
    refreshTokenStore.delete(refreshToken)
    
    // 生成新的 Token 对
    return generateTokens(authUser)
  } catch (error) {
    console.error('[Auth] 刷新 Token 失败:', error)
    return null
  }
}

// 使 Refresh Token 失效（用于登出）
export function revokeRefreshToken(refreshToken: string): boolean {
  return refreshTokenStore.delete(refreshToken)
}

export const requireAuth = authMiddleware()

export const requireAdmin = authMiddleware(['admin'])

export const requireManager = authMiddleware(['admin', 'manager'])

export const requireUser = authMiddleware(['admin', 'user'])

export const requireEmployee = authMiddleware(['admin', 'user', 'employee'])
