import { Request, Response, NextFunction } from 'express'
import { sendSuccess, AppError, ErrorCode, HttpStatus, asyncHandler } from '../utils/response.js'
import logger from '../utils/logger.js'
import { readUsers, writeUsers, type UserRow } from '../data/index.js'
import { hashPassword } from '../utils/password.js'

/**
 * 用户注册
 * 验证手机号格式和密码强度，检查手机号和团队名称唯一性
 * @param req - HTTP请求对象，包含手机号、密码、昵称、团队名称
 * @param res - HTTP响应对象
 * @returns 新用户信息
 */
export const registerUser = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { phone, password, nickname, teamName } = req.body

    // 输入验证
    if (!phone || !password) {
      throw new AppError('手机号和密码不能为空', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
    }

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      throw new AppError('手机号格式不正确', ErrorCode.INVALID_PHONE, HttpStatus.BAD_REQUEST)
    }

    if (password.length < 6) {
      throw new AppError('密码长度不能少于6位', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
    }

    // 检查重复注册
    const users: UserRow[] = await readUsers()
    const existingPhone = users.find((u: UserRow) => u.phone === phone)
    if (existingPhone) {
      throw new AppError('该手机号已注册', ErrorCode.USER_ALREADY_EXISTS, HttpStatus.CONFLICT)
    }

    // 检查团队名称
    if (teamName) {
      const existingTeam = users.find((u: UserRow) => u.teamName === teamName)
      if (existingTeam) {
        throw new AppError('该团队名称已存在', ErrorCode.BAD_REQUEST, HttpStatus.CONFLICT)
      }
    }

    // 创建用户
    const now = new Date().toISOString()
    const hashedPassword = await hashPassword(password)
    const user = {
      id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      phone,
      password: hashedPassword,
      nickname: nickname || `用户${phone.slice(-4)}`,
      teamName: teamName || '',
      role: 'user',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }
    users.push(user)
    await writeUsers(users)

    logger.info('New user registered', { userId: user.id, phone: user.phone })
    const { password: _, ...safeUser } = user
    sendSuccess(res, { user: safeUser }, '注册成功')
  }
)
