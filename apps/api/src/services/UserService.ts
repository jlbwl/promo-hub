/**
 * UserService - 用户业务逻辑层
 * 负责处理用户相关的所有业务逻辑，包括注册、登录、密码管理等
 */
import { ErrorCode, throwBadRequest, throwNotFound, throwConflict, throwUnauthorized, getErrorMessage } from '@promo/shared'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { verifySmsCode } from '../utils/sms.js'
import { readUsers, writeUsers, type UserRow, queryOne, insertUser, updateUser as updateUserData, touchUserLastLogin, deserialize } from '../data/index.js'
import logger from '../utils/logger.js'

/** 对外返回的安全用户信息（不包含密码），形状与 data 层 UserRow 一致 */
export interface SafeUser {
  id: string
  phone?: string
  nickname?: string
  teamName?: string
  role?: string
  status?: string
  alipayUserId?: string
  wechatOpenId?: string
  createdAt?: string
  updatedAt?: string
  [key: string]: unknown
}

/** 用户信息更新数据 */
export interface UserUpdateData {
  phone?: string
  nickname?: string
  teamName?: string
  [key: string]: unknown
}

/**
 * 用户服务接口
 */
export interface UserService {
  /**
   * 注册用户
   */
  registerUser(userData: {
    phone: string
    password: string
    nickname?: string
    teamName?: string
  }): Promise<SafeUser>

  /**
   * 密码登录
   */
  login(phone: string, password: string): Promise<SafeUser>

  /**
   * 获取用户信息
   */
  getUserById(userId: string): Promise<SafeUser>

  /**
   * 更新用户信息
   */
  updateUser(userId: string, updateData: UserUpdateData): Promise<SafeUser>

  /**
   * 短信验证码登录/注册
   * 验证短信验证码，新用户自动注册，老用户直接登录
   * @returns 用户信息（不包含密码）和是否为新用户
   */
  smsLogin(phone: string, code: string, teamName?: string): Promise<{ user: SafeUser; isNewUser: boolean }>
}

export const userService: UserService = {
  async registerUser(userData) {
    const { phone, password, nickname, teamName } = userData

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      throwBadRequest('手机号格式不正确', ErrorCode.INVALID_PHONE)
    }

    if (password.length < 6) {
      throwBadRequest('密码长度不能少于6位')
    }

    const users: UserRow[] = await readUsers()
    const existingPhone = users.find((u) => u.phone === phone)
    if (existingPhone) {
      throwConflict('该手机号已注册', ErrorCode.USER_ALREADY_EXISTS)
    }

    if (teamName) {
      const existingTeam = users.find((u) => u.teamName === teamName)
      if (existingTeam) {
        throwConflict('该团队名称已存在')
      }
    }

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

    const { password: _, ...safeUser } = user
    return safeUser
  },

  async login(phone: string, password: string) {
    const users = await readUsers()
    const user = users.find(
      (u) => u.phone === phone && u.status === 'active'
    )
    if (!user) {
      throwUnauthorized('手机号或密码错误，或账号已被禁用', ErrorCode.INVALID_CREDENTIALS)
    }

    const passwordValid = await verifyPassword(password, user.password)
    if (!passwordValid) {
      throwUnauthorized('手机号或密码错误，或账号已被禁用', ErrorCode.INVALID_CREDENTIALS)
    }

    const { password: _, ...safeUser } = user
    return safeUser
  },

  async getUserById(userId: string) {
    const users = await readUsers()
    const user = users.find((u) => u.id === userId)

    if (!user) {
      throwNotFound('用户不存在', ErrorCode.USER_NOT_FOUND)
    }

    const { password: _, ...safeUser } = user
    return safeUser
  },

  async updateUser(userId, updateData) {
    const users = await readUsers()
    const index = users.findIndex((u) => u.id === userId)

    if (index === -1) {
      throwNotFound('用户不存在', ErrorCode.USER_NOT_FOUND)
    }

    if (updateData.phone) {
      const existingPhone = users.find((u) => u.phone === updateData.phone && u.id !== userId)
      if (existingPhone) {
        throwConflict('该手机号已被使用')
      }
    }

    if (updateData.teamName) {
      const existingTeam = users.find((u) => u.teamName === updateData.teamName && u.id !== userId)
      if (existingTeam) {
        throwConflict('该团队名称已被使用')
      }
    }

    users[index] = {
      ...users[index],
      ...updateData,
      updatedAt: new Date().toISOString(),
    }
    await writeUsers(users)

    const { password: _, ...safeUser } = users[index]
    return safeUser
  },

  async smsLogin(phone: string, code: string, teamName?: string) {
    const valid = verifySmsCode(phone, code)
    if (!valid) {
      throwBadRequest('验证码错误或已过期', ErrorCode.CODE_EXPIRED)
    }

    let user = await queryOne<UserRow>('SELECT * FROM users WHERE phone = ?', [phone])
    let isNewUser = false

    if (!user) {
      isNewUser = true
      logger.info('Creating new user via SMS', { phone })

      if (teamName) {
        const existingTeamUser = await queryOne('SELECT id FROM users WHERE teamName = ?', [teamName])
        if (existingTeamUser) {
          throwConflict('该团队名称已存在')
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
      } as UserRow
      await insertUser(user)
      logger.info('New user created via SMS', { userId: user.id })
    } else {
      logger.debug('Updating existing user loginMethods', { userId: user.id })
      const loginMethods = deserialize<string>(user.loginMethods)
      const newLoginMethods = Array.isArray(loginMethods) ? loginMethods : ['sms']
      if (!newLoginMethods.includes('sms')) {
        newLoginMethods.push('sms')
      }
      await updateUserData(user.id, { loginMethods: newLoginMethods })
      const refreshed = await queryOne<UserRow>('SELECT * FROM users WHERE id = ?', [user.id])
      if (!refreshed) {
        throwNotFound('用户不存在', ErrorCode.USER_NOT_FOUND)
      }
      user = refreshed
      user.loginMethods = newLoginMethods
      logger.info('User loginMethods updated', { userId: user.id })
    }

    const finalUser = user!
    try {
      await touchUserLastLogin(finalUser.id)
    } catch (e) {
      logger.warn('Update lastLoginAt failed', { userId: finalUser.id, error: getErrorMessage(e) })
    }

    const { password: _, ...safeUser } = finalUser
    return { user: safeUser, isNewUser }
  },
}


