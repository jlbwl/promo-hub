import { Request, Response, NextFunction } from 'express'
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
  readUsersPaged,
  writeUsers,
  readManagers,
  writeManagers,
  readProducts,
  writeProducts,
  query,
  queryOne,
  deserialize,
  insertUser,
  updateUser,
  withTransaction,
} from '../data/index.js'
import { login as sessionLogin, loginSync as sessionLoginSync, generateAuthToken, logout as sessionLogout, generateTokens, refreshAuthToken } from '../middleware/auth.js'
import { sendSmsCode } from '../utils/sms.js'
import { generateSmsCode, saveSmsCode, verifySmsCode, deleteSmsCode } from '../utils/sms.js'
import { hashPassword, verifyPassword } from '../utils/password.js'

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
    const tokens = await generateTokens(authUser)
    await sessionLogin(req, { ...authUser, token: tokens.token })

    logger.info('User logged in', { userId: user.id, method: 'password' })
    const { password: _, ...safeUser } = user
    sendSuccess(res, { token: tokens.token, refreshToken: tokens.refreshToken, user: safeUser }, '登录成功')
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

    let user: any = null
    let isNewUser = false

    try {
      // 查询用户
      logger.debug('Querying user by phone', { phone })
      user = await queryOne('SELECT * FROM users WHERE phone = ?', [phone])
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
        const loginMethods = deserialize(user.loginMethods)
        const newLoginMethods = Array.isArray(loginMethods) ? loginMethods : ['sms']
        if (!newLoginMethods.includes('sms')) {
          newLoginMethods.push('sms')
        }
        // 只更新必要字段
        await updateUser(user.id, {
          loginMethods: newLoginMethods,
          updatedAt: new Date().toISOString(),
        })
        // 重新获取最新的用户数据
        user = await queryOne('SELECT * FROM users WHERE id = ?', [user.id]) as any
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
      } catch (sessionError: any) {
        logger.warn('Session save failed, continuing anyway', { 
          error: sessionError.message 
        })
        // 即使 session 保存失败，我们仍然可以返回成功，因为用户信息已经在响应中
      }

      logger.info('User logged in successfully', { userId: user.id, method: 'sms', isNewUser })
      
      // 生成 Token
      const authUser = { id: user.id, phone: user.phone, role: user.role || 'user' as const, nickname: user.nickname, teamName: user.teamName }
      const tokens = await generateTokens(authUser)
      
      const { password: _, ...safeUser } = user
      sendSuccess(res, { token: tokens.token, refreshToken: tokens.refreshToken, user: safeUser }, '登录成功')
    } catch (error: any) {
      logger.error('SMS login failed', { 
        phone, 
        error: error.message, 
        stack: error.stack 
      })
      // 如果是 AppError，重新抛出，否则包装成通用错误
      if (error instanceof AppError) {
        throw error
      }
      throw new AppError(
        `登录失败: ${error.message}`, 
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
// 用户登出
// ============================================

/**
 * 用户登出
 * 清除 Session 和 Token
 */
export const userLogout = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    logger.info('User logout', { userId: req.session?.user?.id || (req as any).user?.id })
    
    // 清除 Session
    sessionLogout(req)
    
    // 返回成功响应
    sendSuccess(res, null, '登出成功')
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
    const pageNum = parseInt(page as string, 10)
    const pageSizeNum = parseInt(pageSize as string, 10)

    const result = await readUsersPaged({
      role: role as string,
      status: status !== undefined && status !== '' ? Number(status) : undefined,
      keyword: keyword as string,
      teamName: teamName as string,
      page: pageNum,
      pageSize: pageSizeNum,
    })

    const list = result.list.map((u: any) => ({
      id: u.id,
      name: u.nickname,
      phone: u.phone,
      teamName: u.teamName || '',
      role: u.role,
      status: u.status === 'active' ? 1 : 0,
      createdAt: u.createdAt,
    }))

    sendSuccess(res, { list, total: result.total, page: pageNum, pageSize: pageSizeNum }, 'success')
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
    
    // 验证短信验证码（验证后自动失效，确保一次性使用）
    const valid = verifySmsCode(adminInfo.phone, smsCode)
    if (!valid) {
      throw new AppError('验证码错误、已过期或已被使用', ErrorCode.CODE_EXPIRED, HttpStatus.BAD_REQUEST)
    }
    // 注意：verifySmsCode 内部已自动删除验证码，无需再次调用 deleteSmsCode
    
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
      
      if (!status) {
        // P1-4: 禁用经理时需要同时下架其产品，使用事务保证一致性
        await withTransaction(async (conn) => {
          await conn.execute(
            'UPDATE managers SET status = ?, updatedAt = ? WHERE id = ?',
            ['disabled', managers[mgrIdx].updatedAt, userId]
          )
          await conn.execute(
            'UPDATE products SET status = ?, updatedAt = ? WHERE managerId = ? AND status = ?',
            ['offline', managers[mgrIdx].updatedAt, userId, 'published']
          )
        })
      } else {
        await writeManagers(managers)
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

    const now = new Date().toISOString()

    // P1-4: 更新团队名称时需要同时更新历史订单的 teamName，使用事务保证一致性
    await withTransaction(async (conn) => {
      if (usrIdx !== -1) {
        await conn.execute(
          'UPDATE users SET teamName = ?, updatedAt = ? WHERE id = ?',
          [teamName, now, userId]
        )
      } else {
        await conn.execute(
          'UPDATE managers SET teamName = ?, updatedAt = ? WHERE id = ?',
          [teamName, now, userId]
        )
      }
      // 更新该用户的所有历史订单的团队名称
      await conn.execute(
        'UPDATE orders SET teamName = ?, updatedAt = ? WHERE userId = ?',
        [teamName, now, userId]
      )
    })

    logger.info('User team name updated', { userId, teamName })
    sendSuccess(res, null, '更新成功')
  }
)
