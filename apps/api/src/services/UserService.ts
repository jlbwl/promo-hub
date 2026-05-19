/**
 * UserService - 用户业务逻辑层
 * 负责处理用户相关的所有业务逻辑，包括注册、登录、密码管理等
 */
import bcrypt from 'bcrypt'
import {
  readUsers,
  writeUsers,
  readProducts,
  writeProducts,
} from '../data.js'

const SALT_ROUNDS = 12

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
  }): Promise<any>

  /**
   * 密码登录
   */
  login(phone: string, password: string): Promise<any>

  /**
   * 获取用户信息
   */
  getUserById(userId: string): Promise<any>

  /**
   * 更新用户信息
   */
  updateUser(userId: string, updateData: any): Promise<any>
}

/**
 * 用户服务实现
 */
export const userService: UserService = {
  /**
   * 注册用户
   * 验证手机号格式和密码强度，检查手机号和团队名称唯一性
   * @param userData - 用户数据
   * @returns 新用户信息（不包含密码）
   * @throws 手机号格式不正确、密码太短、手机号已注册、团队名称已存在时抛出错误
   */
  async registerUser(userData) {
    const { phone, password, nickname, teamName } = userData

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      const error = new Error('手机号格式不正确')
      ;(error as any).code = 400
      ;(error as any).errorCode = 'INVALID_PHONE'
      throw error
    }

    // 验证密码长度
    if (password.length < 6) {
      const error = new Error('密码长度不能少于6位')
      ;(error as any).code = 400
      throw error
    }

    // 检查重复注册
    const users = await readUsers()
    const existingPhone = users.find((u: any) => u.phone === phone)
    if (existingPhone) {
      const error = new Error('该手机号已注册')
      ;(error as any).code = 409
      ;(error as any).errorCode = 'USER_ALREADY_EXISTS'
      throw error
    }

    // 检查团队名称
    if (teamName) {
      const existingTeam = users.find((u: any) => u.teamName === teamName)
      if (existingTeam) {
        const error = new Error('该团队名称已存在')
        ;(error as any).code = 409
        throw error
      }
    }

    // 创建用户
    const now = new Date().toISOString()
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)
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

    // 返回不包含密码的用户信息
    const { password: _, ...safeUser } = user
    return safeUser
  },

  /**
   * 密码登录
   * 验证手机号和密码，返回用户信息
   * @param phone - 手机号
   * @param password - 密码
   * @returns 登录用户信息（不包含密码）
   * @throws 手机号或密码错误时抛出错误
   */
  async login(phone, password) {
    const users = await readUsers()
    const user = users.find(
      (u: any) => u.phone === phone && u.status === 'active'
    )
    if (!user) {
      const error = new Error('手机号或密码错误，或账号已被禁用')
      ;(error as any).code = 401
      ;(error as any).errorCode = 'INVALID_CREDENTIALS'
      throw error
    }

    // 验证密码
    const passwordValid = await verifyPassword(password, user.password)
    if (!passwordValid) {
      const error = new Error('手机号或密码错误，或账号已被禁用')
      ;(error as any).code = 401
      ;(error as any).errorCode = 'INVALID_CREDENTIALS'
      throw error
    }

    // 返回不包含密码的用户信息
    const { password: _, ...safeUser } = user
    return safeUser
  },

  /**
   * 获取用户信息
   * @param userId - 用户ID
   * @returns 用户信息（不包含密码）
   * @throws 用户不存在时抛出错误
   */
  async getUserById(userId) {
    const users = await readUsers()
    const user = users.find((u: any) => u.id === userId)

    if (!user) {
      const error = new Error('用户不存在')
      ;(error as any).code = 404
      throw error
    }

    const { password: _, ...safeUser } = user
    return safeUser
  },

  /**
   * 更新用户信息
   * @param userId - 用户ID
   * @param updateData - 更新数据
   * @returns 更新后的用户信息
   * @throws 用户不存在时抛出错误
   */
  async updateUser(userId, updateData) {
    const users = await readUsers()
    const index = users.findIndex((u: any) => u.id === userId)

    if (index === -1) {
      const error = new Error('用户不存在')
      ;(error as any).code = 404
      throw error
    }

    // 如果更新了手机号，检查唯一性
    if (updateData.phone) {
      const existingPhone = users.find((u: any) => u.phone === updateData.phone && u.id !== userId)
      if (existingPhone) {
        const error = new Error('该手机号已被使用')
        ;(error as any).code = 409
        throw error
      }
    }

    // 如果更新了团队名称，检查唯一性
    if (updateData.teamName) {
      const existingTeam = users.find((u: any) => u.teamName === updateData.teamName && u.id !== userId)
      if (existingTeam) {
        const error = new Error('该团队名称已被使用')
        ;(error as any).code = 409
        throw error
      }
    }

    // 更新用户
    users[index] = {
      ...users[index],
      ...updateData,
      updatedAt: new Date().toISOString(),
    }
    await writeUsers(users)

    const { password: _, ...safeUser } = users[index]
    return safeUser
  },
}

/**
 * 验证密码
 * @param password - 明文密码
 * @param hash - 加密密码
 * @returns 是否匹配
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // 如果是明文密码，直接比较（用于兼容旧数据）
  if (password === hash) {
    return true
  }
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}
