import { Request, Response, NextFunction, RequestHandler } from 'express'
import session, { Session } from 'express-session'
import jwt from 'jsonwebtoken'
import { getCacheService } from '../services/cache/index.js'

// 安全验证：确保必需的密钥环境变量已设置
if (!process.env.JWT_SECRET || !process.env.SESSION_SECRET) {
  throw new Error('致命错误：JWT_SECRET 和 SESSION_SECRET 环境变量未设置')
}

const SESSION_SECRET = process.env.SESSION_SECRET
const JWT_SECRET = process.env.JWT_SECRET

// 验证 SESSION_SECRET 强度
if (SESSION_SECRET.length < 32) {
  console.warn('[Security] SESSION_SECRET 长度不足（建议至少32字符），当前长度:', SESSION_SECRET.length)
}

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

// Refresh Token 存储键前缀
const REFRESH_TOKEN_PREFIX = 'refresh_token:'
const ACCESS_TOKEN_PREFIX = 'access_token:'

// 获取缓存服务（使用 Redis）
function getTokenStore() {
  try {
    return getCacheService()
  } catch {
    console.warn('[Auth] CacheService 未初始化，降级到内存存储')
    return null
  }
}

// 创建 session 中间件（支持 MongoDB 降级到内存存储）
export const sessionMiddleware: RequestHandler = (() => {
  let store: any = undefined
  
  if (process.env.MONGODB_URI) {
    try {
      const MongoStore = require('connect-mongo').default
      store = MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 90 * 24 * 60 * 60,
        touchAfter: 24 * 60 * 60,
      })
      console.log('[Session] 使用 MongoDB 存储，有效期90天')
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
      maxAge: 90 * 24 * 60 * 60 * 1000,
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
export async function generateRefreshToken(user: AuthUser): Promise<string> {
  const refreshToken = jwt.sign(
    { id: user.id, phone: user.phone, role: user.role, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
  
  const cacheService = getTokenStore()
  if (cacheService) {
    await cacheService.set(REFRESH_TOKEN_PREFIX + refreshToken, JSON.stringify(user), 7 * 24 * 60 * 60)
  }
  
  return refreshToken
}

// 同时生成 Access Token 和 Refresh Token
export async function generateTokens(user: AuthUser): Promise<{ token: string; refreshToken: string }> {
  const token = generateAuthToken(user)
  const refreshToken = await generateRefreshToken(user)
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
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
      const refreshToken = req.headers['x-refresh-token'] as string | undefined

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
          ;(req as any).user = user
          next()
          return
        }
      }

      // 3. 尝试使用 Refresh Token 刷新 Access Token
      if (refreshToken) {
        const newTokens = await refreshAuthToken(refreshToken)
        if (newTokens) {
          try {
            const decoded = jwt.verify(newTokens.token, JWT_SECRET) as any
            const user: AuthUser = {
              id: decoded.id,
              phone: decoded.phone,
              role: decoded.role,
              token: newTokens.token
            }
            
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
            
            ;(req as any).user = user
            res.setHeader('X-New-Token', newTokens.token)
            res.setHeader('X-New-Refresh-Token', newTokens.refreshToken)
            next()
            return
          } catch {
            console.warn('[Auth] 刷新后的 Token 验证失败')
          }
        }
      }

      res.status(401).json({
        code: 401,
        message: '未登录或会话已过期，请重新登录',
        data: null
      })
    } catch (error: any) {
      console.error('[Auth] Middleware error:', error)
      res.status(500).json({ code: 500, message: '认证服务异常', data: null })
    }
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
export async function refreshAuthToken(refreshToken: string): Promise<{ token: string; refreshToken: string } | null> {
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as any
    
    if (decoded.type !== 'refresh') {
      return null
    }
    
    const cacheService = getTokenStore()
    let cachedUser: AuthUser | null = null
    
    if (cacheService) {
      cachedUser = await cacheService.get<AuthUser>(REFRESH_TOKEN_PREFIX + refreshToken)
    }
    
    if (!cachedUser) {
      return null
    }
    
    // 使用缓存的完整 user 对象，保留 userId/nickname/teamName 等字段
    // 修复：之前只使用 decoded 中的 id/phone/role，丢失了员工账户的 userId
    const authUser: AuthUser = {
      id: cachedUser.id,
      phone: cachedUser.phone,
      role: cachedUser.role,
      nickname: cachedUser.nickname,
      teamName: cachedUser.teamName,
      userId: cachedUser.userId  // 保留员工账户的关联用户ID
    }
    
    const newTokens = await generateTokens(authUser)
    
    if (cacheService) {
      await cacheService.delete(REFRESH_TOKEN_PREFIX + refreshToken)
    }
    
    return newTokens
  } catch {
    return null
  }
}

// 使 Refresh Token 失效（用于登出）
export async function revokeRefreshToken(refreshToken: string): Promise<boolean> {
  const cacheService = getTokenStore()
  if (cacheService) {
    await cacheService.delete(REFRESH_TOKEN_PREFIX + refreshToken)
    return true
  }
  return false
}

export const requireAuth = authMiddleware()

export const requireAdmin = authMiddleware(['admin'])

export const requireManager = authMiddleware(['admin', 'manager'])

export const requireUser = authMiddleware(['admin', 'user'])

export const requireEmployee = authMiddleware(['admin', 'user', 'employee'])
