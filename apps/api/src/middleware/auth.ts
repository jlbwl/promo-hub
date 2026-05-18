import { Request, Response, NextFunction, RequestHandler } from 'express'
import session, { Session } from 'express-session'
import MongoStore from 'connect-mongo'

const SESSION_SECRET = process.env.SESSION_SECRET || 'promo-hub-secret-key-change-in-production'

export interface AuthUser {
  id: string
  phone: string
  role: 'admin' | 'manager' | 'user' | 'employee'
  nickname?: string
  teamName?: string
  userId?: string
}

declare module 'express-session' {
  interface SessionData {
    user?: AuthUser
    isAuthenticated?: boolean
  }
}

export const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || `mongodb://localhost:27017/promo-hub-sessions`,
    ttl: 7 * 24 * 60 * 60,
    touchAfter: 24 * 60 * 60,
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  },
})

export const authMiddleware = (allowedRoles?: Array<'admin' | 'manager' | 'user' | 'employee'>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session || !req.session.isAuthenticated || !req.session.user) {
      res.status(401).json({
        code: 401,
        message: '未登录或会话已过期，请重新登录',
        data: null
      })
      return
    }

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

    next()
  }
}

export const login = (req: Request, user: AuthUser) => {
  req.session.user = user
  req.session.isAuthenticated = true
  req.session.save((err) => {
    if (err) {
      console.error('[Session] 保存会话失败:', err)
    } else {
      console.log(`[Session] 用户 ${user.id} (${user.role}) 登录成功`)
    }
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

export const requireAuth = authMiddleware()

export const requireAdmin = authMiddleware(['admin'])

export const requireManager = authMiddleware(['admin', 'manager'])

export const requireUser = authMiddleware(['admin', 'user'])

export const requireEmployee = authMiddleware(['admin', 'user', 'employee'])
