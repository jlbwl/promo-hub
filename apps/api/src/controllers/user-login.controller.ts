import { Request, Response, NextFunction } from 'express'
import { getErrorMessage } from '@promo/shared'
import { sendSuccess, AppError, ErrorCode, HttpStatus, asyncHandler } from '../utils/response.js'
import logger from '../utils/logger.js'
import { maskPhone } from '../utils/phone.js'
import {
  readUsers,
  queryOne,
  updateUser as updateUserData,
  type UserRow,
  type UserRecord,
  touchUserLastLogin,
} from '../data/index.js'
import { generateTokens, revokeRefreshToken, revokeAllRefreshTokens, blacklistAccessToken, type AuthUser } from '../middleware/auth.js'
import { verifySmsCode } from '../utils/sms.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { userService } from '../services/index.js'

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

    // 记录最近登录时间（失败不阻断登录）
    try {
      await touchUserLastLogin(user.id)
    } catch (e) {
      logger.warn('Update lastLoginAt failed', { userId: user.id, error: getErrorMessage(e) })
    }

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
    logger.info('SMS login attempt started', { phone: maskPhone(phone), hasTeamName: !!teamName })

    if (!phone || !code) {
      throw new AppError('手机号和验证码不能为空', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
    }

    const { user, isNewUser } = await userService.smsLogin(phone, code, teamName)

    logger.info('User logged in successfully', { userId: user.id, method: 'sms', isNewUser })

    const authUser = {
      id: user.id as string,
      phone: user.phone as string,
      role: (user.role || 'user') as AuthUser['role'],
      nickname: user.nickname as string,
      teamName: user.teamName as string,
    }
    const tokens = await generateTokens(authUser)

    sendSuccess(res, { token: tokens.token, refreshToken: tokens.refreshToken, user }, '登录成功')
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

    // H14：按手机号单行查询 + 单行更新，避免全表回写
    const targetUser = await queryOne<UserRow>(
      'SELECT id FROM users WHERE phone = ? LIMIT 1',
      [phone]
    )
    if (!targetUser) {
      throw new AppError('用户不存在', ErrorCode.USER_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    const hashedPassword = await hashPassword(password)
    await updateUserData(targetUser.id, { password: hashedPassword })

    // 改密后吊销该账号已签发的全部 refresh token（旧会话最长保留 1 小时 access token 有效期）
    await revokeAllRefreshTokens('user', targetUser.id)

    logger.info('User password updated', { userId: targetUser.id })
    sendSuccess(res, null, '密码设置成功')
  }
)

/**
 * 用户登出
 * 清除 Session，并吊销请求携带的 Refresh Token（X-Refresh-Token 头）
 */
export const userLogout = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    logger.info('User logout', { userId: req.user?.id })

    // 吊销 Refresh Token（请求层统一通过 X-Refresh-Token 头携带）
    const refreshToken = req.headers?.['x-refresh-token'] as string | undefined
    if (refreshToken) {
      await revokeRefreshToken(refreshToken)
    }

    // Plan C: 将当前 Access Token 加入黑名单，使其立即失效
    const authHeader = req.headers?.authorization
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (bearerToken) {
      await blacklistAccessToken(bearerToken)
    }

    // 返回成功响应
    sendSuccess(res, null, '登出成功')
  }
)
