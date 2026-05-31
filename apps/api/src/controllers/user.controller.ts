import { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import {
  sendSuccess,
  sendError,
  AppError,
  ErrorCode,
  HttpStatus,
  asyncHandler,
} from '../utils/response.js'
import logger from '../utils/logger.js'
import {
  readUsers,
  writeUsers,
  readManagers,
  writeManagers,
  readProducts,
  writeProducts,
  query,
} from '../data.js'
import { login as sessionLogin, generateAuthToken } from '../middleware/auth.js'
import { sendSmsCode } from '../sms.js'
import { generateSmsCode, saveSmsCode, verifySmsCode, deleteSmsCode } from '../utils/sms.js'

const SALT_ROUNDS = 12

// ============================================
// 辅助函数
// ============================================

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS)
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash)
  } catch (err) {
    logger.error('Password verification failed', { error: err })
    return false
  }
}

// ============================================
// 用户注册和登录
// ============================================

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
    const users = await readUsers()
    const existingPhone = users.find((u: any) => u.phone === phone)
    if (existingPhone) {
      throw new AppError('该手机号已注册', ErrorCode.USER_ALREADY_EXISTS, HttpStatus.CONFLICT)
    }

    // 检查团队名称
    if (teamName) {
      const existingTeam = users.find((u: any) => u.teamName === teamName)
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
      (u: any) => u.phone === phone && u.status === 'active'
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

    const authUser = { id: user.id, phone: user.phone, role: 'user' as const, nickname: user.nickname, teamName: user.teamName }
    const token = generateAuthToken(authUser)
    sessionLogin(req, { ...authUser, token })

    logger.info('User logged in', { userId: user.id, method: 'password' })
    const { password: _, ...safeUser } = user
    sendSuccess(res, { token, user: safeUser }, '登录成功')
  }
)

/**
 * 发送短信验证码
 * 验证手机号格式，生成6位验证码，有效期5分钟
 * @param req - HTTP请求对象，包含手机号
 * @param res - HTTP响应对象
 * @returns 验证码有效期
 */
export const sendUserSmsCode = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { phone } = req.body
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      throw new AppError('手机号格式不正确', ErrorCode.INVALID_PHONE, HttpStatus.BAD_REQUEST)
    }

    const code = generateSmsCode()
    saveSmsCode(phone, code, 300)
    
    logger.debug('SMS code sent', { phone })
    await sendSmsCode(phone, code)
    sendSuccess(res, { expiresIn: 300 }, '验证码已发送')
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
    if (!phone || !code) {
      throw new AppError('手机号和验证码不能为空', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
    }

    const valid = verifySmsCode(phone, code)
    if (!valid) {
      throw new AppError('验证码错误或已过期', ErrorCode.CODE_EXPIRED, HttpStatus.BAD_REQUEST)
    }
    deleteSmsCode(phone)

    let users = await readUsers()
    let user = users.find((u: any) => u.phone === phone)
    let isNewUser = false

    if (!user) {
      isNewUser = true
      // 检查团队名称
      if (teamName) {
        if (users.find((u: any) => u.teamName === teamName)) {
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
      users.push(user)
      await writeUsers(users)
    } else {
      if (!user.loginMethods) user.loginMethods = []
      if (!user.loginMethods.includes('sms')) user.loginMethods.push('sms')
      user.updatedAt = new Date().toISOString()
      users = users.map((u: any) => u.id === user!.id ? user : u)
      await writeUsers(users)
    }

    sessionLogin(req, { 
      id: user.id, 
      phone: user.phone, 
      role: 'user', 
      nickname: user.nickname, 
      teamName: user.teamName 
    })

    logger.info('User logged in', { userId: user.id, method: 'sms', isNewUser })
    const { password: _, ...safeUser } = user
    sendSuccess(res, { user: safeUser }, '登录成功')
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
    deleteSmsCode(phone)

    let users = await readUsers()
    const index = users.findIndex((u: any) => u.phone === phone)
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

// ============================================
// 管理后台用户管理
// ============================================

/**
 * 获取用户列表
 */
export const getUsers = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { page = '1', pageSize = '10', role, status, keyword, teamName } = req.query
    const users = await readUsers()

    const allUsers = users.map((u: any) => ({
      id: u.id,
      name: u.nickname,
      phone: u.phone,
      teamName: u.teamName || '',
      role: u.role,
      status: u.status === 'active' ? 1 : 0,
      createdAt: u.createdAt,
    }))

    let filtered = allUsers
    if (role) {
      filtered = filtered.filter((u: any) => u.role === role)
    }
    if (status !== undefined && status !== '') {
      const s = Number(status)
      filtered = filtered.filter((u: any) => u.status === s)
    }
    if (keyword) {
      const kw = String(keyword).toLowerCase()
      filtered = filtered.filter(
        (u: any) => 
          (u.name || '').toLowerCase().includes(kw) || 
          (u.phone || '').includes(kw) ||
          (u.teamName || '').toLowerCase().includes(kw)
      )
    }
    if (teamName) {
      const tn = String(teamName).toLowerCase()
      filtered = filtered.filter(
        (u: any) => (u.teamName || '').toLowerCase().includes(tn)
      )
    }

    filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const total = filtered.length
    const pageNum = parseInt(page as string, 10)
    const pageSizeNum = parseInt(pageSize as string, 10)
    const start = (pageNum - 1) * pageSizeNum
    const list = filtered.slice(start, start + pageSizeNum)

    sendSuccess(res, { list, total, page: pageNum, pageSize: pageSizeNum }, 'success')
  }
)

/**
 * 获取单个用户详情
 */
export const getUserById = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const userId = req.params.id

    const managers = await readManagers()
    const manager = managers.find((m: any) => m.id === userId)
    if (manager) {
      return sendSuccess(res, {
        id: manager.id,
        name: manager.name,
        phone: manager.phone,
        teamName: manager.teamName || '',
        role: 'manager',
        status: manager.status === 'active' ? 1 : 0,
        createdAt: manager.createdAt,
      }, 'success')
    }

    const users = await readUsers()
    const user = users.find((u: any) => u.id === userId)
    if (user) {
      return sendSuccess(res, {
        id: user.id,
        name: user.nickname,
        phone: user.phone,
        teamName: user.teamName || '',
        role: user.role,
        status: user.status === 'active' ? 1 : 0,
        createdAt: user.createdAt,
      }, 'success')
    }

    throw new AppError('用户不存在', ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND)
  }
)

/**
 * 删除用户
 */
export const deleteUser = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const smsCode = req.query.smsCode as string
    
    if (!smsCode) {
      throw new AppError('验证码不能为空', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
    }
    
    // 获取管理员信息（支持 session 和 JWT token）
    const adminInfo = req.session?.user || (req as any).user
    if (!adminInfo || !adminInfo.phone) {
      throw new AppError('未登录', ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED)
    }
    
    // 验证短信验证码
    const valid = verifySmsCode(adminInfo.phone, smsCode)
    if (!valid) {
      throw new AppError('验证码错误或已过期', ErrorCode.CODE_EXPIRED, HttpStatus.BAD_REQUEST)
    }
    deleteSmsCode(adminInfo.phone)
    
    // 检查用户是否存在
    const userId = req.params.id as string
    const users = await readUsers()
    const exists = users.some((u: any) => u.id === userId)
    if (!exists) {
      throw new AppError('用户不存在', ErrorCode.USER_NOT_FOUND, HttpStatus.NOT_FOUND)
    }
    
    // 执行删除
    await deleteUserById(userId)
    
    logger.info('User deleted', { userId, deletedBy: adminInfo.phone })
    sendSuccess(res, null, '删除成功')
  }
)

async function deleteUserById(userId: string): Promise<void> {
  // 直接从数据库删除用户
  await query('DELETE FROM users WHERE id = ?', [userId])
}

/**
 * 切换用户状态
 */
export const updateUserStatus = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { status } = req.body
    const userId = req.params.id as string

    let managers = await readManagers()
    const mgrIdx = managers.findIndex((m: any) => m.id === userId)
    if (mgrIdx !== -1) {
      managers[mgrIdx].status = status ? 'active' : 'disabled'
      managers[mgrIdx].updatedAt = new Date().toISOString()
      await writeManagers(managers)
      
      if (!status) {
        let products = await readProducts()
        products = products.map((p: any) =>
          p.managerId === userId && p.status === 'published'
            ? { ...p, status: 'offline', updatedAt: new Date().toISOString() }
            : p
        )
        await writeProducts(products)
      }
      logger.info('Manager status updated', { managerId: userId, status })
      return sendSuccess(res, null, '更新成功')
    }

    let users = await readUsers()
    const usrIdx = users.findIndex((u: any) => u.id === userId)
    if (usrIdx !== -1) {
      users[usrIdx].status = status ? 'active' : 'disabled'
      users[usrIdx].updatedAt = new Date().toISOString()
      await writeUsers(users)
      logger.info('User status updated', { userId, status })
      return sendSuccess(res, null, '更新成功')
    }

    throw new AppError('用户不存在', ErrorCode.USER_NOT_FOUND, HttpStatus.NOT_FOUND)
  }
)

/**
 * 切换用户角色
 */
export const updateUserRole = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { role } = req.body
    const userId = req.params.id as string

    let managers = await readManagers()
    const mgrIdx = managers.findIndex((m: any) => m.id === userId)
    if (mgrIdx !== -1) {
      managers[mgrIdx].role = role
      managers[mgrIdx].updatedAt = new Date().toISOString()
      await writeManagers(managers)
      logger.info('Manager role updated', { managerId: userId, role })
      return sendSuccess(res, null, '更新成功')
    }

    let users = await readUsers()
    const usrIdx = users.findIndex((u: any) => u.id === userId)
    if (usrIdx !== -1) {
      users[usrIdx].role = role
      users[usrIdx].updatedAt = new Date().toISOString()
      await writeUsers(users)
      logger.info('User role updated', { userId, role })
      return sendSuccess(res, null, '更新成功')
    }

    throw new AppError('用户不存在', ErrorCode.USER_NOT_FOUND, HttpStatus.NOT_FOUND)
  }
)

/**
 * 修改用户团队名称
 */
export const updateUserTeamName = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { teamName } = req.body
    const userId = req.params.id as string

    if (!teamName) {
      throw new AppError('团队名称不能为空', ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST)
    }

    let users = await readUsers()
    let managers = await readManagers()
    
    const usrIdx = users.findIndex((u: any) => u.id === userId)
    const mgrIdx = managers.findIndex((m: any) => m.id === userId)
    
    if (usrIdx === -1 && mgrIdx === -1) {
      throw new AppError('用户不存在', ErrorCode.USER_NOT_FOUND, HttpStatus.NOT_FOUND)
    }

    // 检查团队名称是否重复
    const isDuplicate = 
      users.find((u: any) => u.id !== userId && u.teamName === teamName) || 
      managers.find((m: any) => m.id !== userId && m.teamName === teamName)
    
    if (isDuplicate) {
      throw new AppError('该团队名称已存在', ErrorCode.BAD_REQUEST, HttpStatus.CONFLICT)
    }

    if (usrIdx !== -1) {
      users[usrIdx].teamName = teamName
      users[usrIdx].updatedAt = new Date().toISOString()
      await writeUsers(users)
    } else {
      managers[mgrIdx].teamName = teamName
      managers[mgrIdx].updatedAt = new Date().toISOString()
      await writeManagers(managers)
    }

    logger.info('User team name updated', { userId, teamName })
    sendSuccess(res, null, '更新成功')
  }
)
