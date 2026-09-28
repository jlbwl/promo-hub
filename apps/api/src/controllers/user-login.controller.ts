import { Request, Response, NextFunction } from 'express'
import { getErrorMessage } from '@promo/shared'
import { sendSuccess, AppError, ErrorCode, HttpStatus, asyncHandler } from '../utils/response.js'
import logger from '../utils/logger.js'
import {
  readUsers,
  writeUsers,
  type UserRow,
  type UserRecord,
  queryOne,
  deserialize,
  insertUser,
  updateUser,
} from '../data/index.js'
import { login as sessionLogin, logout as sessionLogout, generateTokens, type AuthUser } from '../middleware/auth.js'
import { verifySmsCode } from '../utils/sms.js'
import { hashPassword, verifyPassword } from '../utils/password.js'

// 短信登录场景的用户行：phone 必有（按手机号查询/新建），role 收窄为系统角色
type SmsLoginUser = UserRecord & {
  phone: string
  role: AuthUser['role']
}

/**
 * 用户密码登录
 * 验证手机号和密码，创建会话
 * @param req - HTTP请求对象，包含手机号和密码
 * @param res - HTTP响应对象
 * @returns 登录用户信息
 */
export const userLogin = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { phone, password } = req.body
    if (!phone || !password) {
      throw new AppError('手机号和密码不能为空', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
    }

    const users = await readUsers()
    const user = users.find(
      (u: UserRecord) => u.phone === phone && u.status === 'active'
    )
    if (!user) {
      throw new AppError(
        '手机号或密码错误，或账号已被禁用',
        ErrorCode.INVALID_CREDENTIALS,
        HttpStatus.UNAUTHORIZED
      )
    }

    const passwordValid = await verifyPassword(password, user.password)
    if (!passwordValid) {
      throw new AppError(
        '手机号或密码错误，或账号已被禁用',
        ErrorCode.INVALID_CREDENTIALS,
        HttpStatus.UNAUTHORIZED
      )
    }

    const authUser = { id: user.id, phone: user.phone as string, role: 'user' as const, nickname: user.nickname, teamName: user.teamName }
    const tokens = await generateTokens(authUser)
    await sessionLogin(req, { ...authUser, token: tokens.token })

    logger.info('User logged in', { userId: user.id, method: 'password' })
    const { password: _, ...safeUser } = user
    sendSuccess(res, { token: tokens.token, refreshToken: tokens.refreshToken, user: safeUser }, '登录成功')
  }
)

/**
 * 短信验证码登录/注册
 * 验证短信验证码，新用户自动注册，老用户直接登录
 * @param req - HTTP请求对象，包含手机号、验证码和团队名称
 * @param res - HTTP响应对象
 * @returns 用户信息
 */
export const userSmsLogin = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { phone, code, teamName } = req.body
    logger.info('SMS login attempt started', { phone, hasTeamName: !!teamName })

    if (!phone || !code) {
      throw new AppError('手机号和验证码不能为空', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
    }

    // 验证验证码
    logger.debug('Verifying SMS code', { phone })
    const valid = verifySmsCode(phone, code)
    if (!valid) {
      throw new AppError('验证码错误或已过期', ErrorCode.CODE_EXPIRED, HttpStatus.BAD_REQUEST)
    }

    let user: SmsLoginUser | null = null
    let isNewUser = false

    try {
      // 查询用户
      logger.debug('Querying user by phone', { phone })
      user = await queryOne<SmsLoginUser>('SELECT * FROM users WHERE phone = ?', [phone])
      logger.debug('Query result', { userFound: !!user })

      if (!user) {
        isNewUser = true
        logger.info('Creating new user', { phone })

        // 检查团队名称
        if (teamName) {
          const existingTeamUser = await queryOne('SELECT id FROM users WHERE teamName = ?', [teamName])
          if (existingTeamUser) {
            throw new AppError('该团队名称已存在', ErrorCode.BAD_REQUEST, HttpStatus.CONFLICT)
          }
        }

        const now = new Date().toISOString()
        user = {
          id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          phone,
          password: '',
          nickname: `用户${phone.slice(-4)}`,
          teamName: teamName || '',
          role: 'user',
          status: 'active',
          loginMethods: ['sms'],
          createdAt: now,
          updatedAt: now,
        }
        // 使用 insertUser 而不是 writeUsers
        logger.debug('Inserting new user', { userId: user.id })
        await insertUser(user)
        logger.info('New user created', { userId: user.id })
      } else {
        // 反序列化 loginMethods
        logger.debug('Updating existing user', { userId: user.id })
        const loginMethods = deserialize<string>(user.loginMethods)
        const newLoginMethods = Array.isArray(loginMethods) ? loginMethods : ['sms']
        if (!newLoginMethods.includes('sms')) {
          newLoginMethods.push('sms')
        }
        // 只更新必要字段
        // updatedAt 由 updateUser 内部的 NOW() 统一管理，不可传 ISO 字符串（MySQL DATETIME 不接受 Z 后缀）
        await updateUser(user.id, {
          loginMethods: newLoginMethods,
        })
        // 重新获取最新的用户数据
        user = await queryOne('SELECT * FROM users WHERE id = ?', [user.id]) as SmsLoginUser
        user.loginMethods = newLoginMethods
        logger.info('User updated', { userId: user.id })
      }

      // 处理 session - 非阻塞模式，即使保存失败也继续
      logger.debug('Setting up session', { userId: user.id })
      try {
        await sessionLogin(req, {
          id: user.id,
          phone: user.phone,
          role: user.role || 'user',
          nickname: user.nickname,
          teamName: user.teamName
        })
      } catch (sessionError) {
        logger.warn('Session save failed, continuing anyway', {
          error: getErrorMessage(sessionError)
        })
        // 即使 session 保存失败，我们仍然可以返回成功，因为用户信息已经在响应中
      }

      logger.info('User logged in successfully', { userId: user.id, method: 'sms', isNewUser })

      // 生成 Token
      const authUser = { id: user.id, phone: user.phone, role: user.role || 'user' as const, nickname: user.nickname, teamName: user.teamName }
      const tokens = await generateTokens(authUser)

      const { password: _, ...safeUser } = user
      sendSuccess(res, { token: tokens.token, refreshToken: tokens.refreshToken, user: safeUser }, '登录成功')
    } catch (error) {
      logger.error('SMS login failed', {
        phone,
        error: getErrorMessage(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      // 如果是 AppError，重新抛出，否则包装成通用错误
      if (error instanceof AppError) {
        throw error
      }
      throw new AppError(
        `登录失败: ${getErrorMessage(error)}`,
        ErrorCode.INTERNAL_SERVER_ERROR,
        HttpStatus.INTERNAL_SERVER_ERROR
      )
    }
  }
)

/**
 * 用户通过短信验证码设置/修改密码
 */
export const setUserPassword = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { phone, code, password } = req.body
    if (!phone || !code || !password) {
      throw new AppError('缺少参数', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
    }
    if (password.length < 6) {
      throw new AppError('密码长度至少6位', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
    }

    const valid = verifySmsCode(phone, code)
    if (!valid) {
      throw new AppError('验证码错误或已过期', ErrorCode.CODE_EXPIRED, HttpStatus.BAD_REQUEST)
    }

    let users = await readUsers()
    const index = users.findIndex((u: UserRow) => u.phone === phone)
    if (index === -1) {
      throw new AppError('用户不存在', ErrorCode.USER_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    const hashedPassword = await hashPassword(password)
    users[index].password = hashedPassword
    users[index].updatedAt = new Date().toISOString()
    await writeUsers(users)

    logger.info('User password updated', { userId: users[index].id })
    sendSuccess(res, null, '密码设置成功')
  }
)

/**
 * 用户登出
 * 清除 Session 和 Token
 */
export const userLogout = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    logger.info('User logout', { userId: req.session?.user?.id || req.user?.id })

    // 清除 Session
    sessionLogout(req)

    // 返回成功响应
    sendSuccess(res, null, '登出成功')
  }
)
