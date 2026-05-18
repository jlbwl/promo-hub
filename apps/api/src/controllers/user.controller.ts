import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import { sendSuccess, sendError } from '../utils/response.js'
import {
  readUsers,
  writeUsers,
  readManagers,
  writeManagers,
  readProducts,
  writeProducts,
} from '../data.js'
import { login as sessionLogin } from '../middleware/auth.js'
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
  if (password === hash) return true
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}

// ============================================
// 用户注册和登录
// ============================================

/**
 * 用户注册
 */
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  const { phone, password, nickname, teamName } = req.body

  if (!phone || !password) {
    return sendError(res, '手机号和密码不能为空', 400)
  }
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return sendError(res, '手机号格式不正确', 400)
  }
  if (password.length < 6) {
    return sendError(res, '密码长度不能少于6位', 400)
  }

  const users = await readUsers()
  if (users.find((u: any) => u.phone === phone)) {
    return sendError(res, '该手机号已注册', 409)
  }

  if (teamName) {
    if (users.find((u: any) => u.teamName === teamName)) {
      return sendError(res, '该团队名称已存在', 409)
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
  sendSuccess(res, { user: safeUser }, '注册成功')
}

/**
 * 用户密码登录
 */
export const userLogin = async (req: Request, res: Response): Promise<void> => {
  const { phone, password } = req.body
  if (!phone || !password) {
    return sendError(res, '手机号和密码不能为空', 400)
  }

  const users = await readUsers()
  const user = users.find(
    (u: any) => u.phone === phone && u.status === 'active'
  )
  if (!user) {
    return sendError(res, '手机号或密码错误，或账号已被禁用', 401)
  }

  const passwordValid = await verifyPassword(password, user.password)
  if (!passwordValid) {
    return sendError(res, '手机号或密码错误，或账号已被禁用', 401)
  }
  
  sessionLogin(req, { id: user.id, phone: user.phone, role: 'user', nickname: user.nickname, teamName: user.teamName })
  
  const { password: _, ...safeUser } = user
  sendSuccess(res, { user: safeUser }, '登录成功')
}

/**
 * 发送短信验证码
 */
export const sendUserSmsCode = async (req: Request, res: Response): Promise<void> => {
  const { phone } = req.body
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return sendError(res, '手机号格式不正确', 400)
  }

  const code = generateSmsCode()
  saveSmsCode(phone, code, 300)
  
  await sendSmsCode(phone, code)
  sendSuccess(res, { expiresIn: 300 }, '验证码已发送')
}

/**
 * 短信验证码登录/注册
 */
export const userSmsLogin = async (req: Request, res: Response): Promise<void> => {
  const { phone, code, teamName } = req.body
  if (!phone || !code) {
    return sendError(res, '手机号和验证码不能为空', 400)
  }

  const valid = verifySmsCode(phone, code)
  if (!valid) {
    return sendError(res, '验证码错误或已过期', 400)
  }
  deleteSmsCode(phone)

  let users = await readUsers()
  let user = users.find((u: any) => u.phone === phone)

  if (!user) {
    if (teamName) {
      if (users.find((u: any) => u.teamName === teamName)) {
        return sendError(res, '该团队名称已存在', 409)
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

  sessionLogin(req, { id: user.id, phone: user.phone, role: 'user', nickname: user.nickname, teamName: user.teamName })

  const { password: _, ...safeUser } = user
  sendSuccess(res, { user: safeUser }, '登录成功')
}

/**
 * 用户通过短信验证码设置/修改密码
 */
export const setUserPassword = async (req: Request, res: Response): Promise<void> => {
  const { phone, code, password } = req.body
  if (!phone || !code || !password) {
    return sendError(res, '缺少参数', 400)
  }
  if (password.length < 6) {
    return sendError(res, '密码长度至少6位', 400)
  }

  const valid = verifySmsCode(phone, code)
  if (!valid) {
    return sendError(res, '验证码错误或已过期', 400)
  }
  deleteSmsCode(phone)

  let users = await readUsers()
  const index = users.findIndex((u: any) => u.phone === phone)
  if (index === -1) {
    return sendError(res, '用户不存在', 404)
  }

  const hashedPassword = await hashPassword(password)
  users[index].password = hashedPassword
  users[index].updatedAt = new Date().toISOString()
  await writeUsers(users)

  sendSuccess(res, null, '密码设置成功')
}

// ============================================
// 管理后台用户管理
// ============================================

/**
 * 获取用户列表
 */
export const getUsers = async (req: Request, res: Response): Promise<void> => {
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

/**
 * 获取单个用户详情
 */
export const getUserById = async (req: Request, res: Response): Promise<void> => {
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

  return sendError(res, '用户不存在', 404)
}

/**
 * 删除用户
 */
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  const smsCode = req.query.smsCode as string
  
  if (!smsCode) {
    return sendError(res, '验证码不能为空', 400)
  }
  
  let users = await readUsers()
  const userId = req.params.id as string
  const index = users.findIndex((u: any) => u.id === userId)
  if (index === -1) {
    return sendError(res, '用户不存在', 404)
  }
  await deleteUserById(userId)
  
  sendSuccess(res, null, '删除成功')
}

async function deleteUserById(userId: string): Promise<void> {
  let users = await readUsers()
  users = users.filter((u: any) => u.id !== userId)
  await writeUsers(users)
}

/**
 * 切换用户状态
 */
export const updateUserStatus = async (req: Request, res: Response): Promise<void> => {
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
    return sendSuccess(res, null, '更新成功')
  }

  let users = await readUsers()
  const usrIdx = users.findIndex((u: any) => u.id === userId)
  if (usrIdx !== -1) {
    users[usrIdx].status = status ? 'active' : 'disabled'
    users[usrIdx].updatedAt = new Date().toISOString()
    await writeUsers(users)
    return sendSuccess(res, null, '更新成功')
  }

  return sendError(res, '用户不存在', 404)
}

/**
 * 切换用户角色
 */
export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  const { role } = req.body
  const userId = req.params.id as string

  let managers = await readManagers()
  const mgrIdx = managers.findIndex((m: any) => m.id === userId)
  if (mgrIdx !== -1) {
    managers[mgrIdx].role = role
    managers[mgrIdx].updatedAt = new Date().toISOString()
    await writeManagers(managers)
    return sendSuccess(res, null, '更新成功')
  }

  let users = await readUsers()
  const usrIdx = users.findIndex((u: any) => u.id === userId)
  if (usrIdx !== -1) {
    users[usrIdx].role = role
    users[usrIdx].updatedAt = new Date().toISOString()
    await writeUsers(users)
    return sendSuccess(res, null, '更新成功')
  }

  return sendError(res, '用户不存在', 404)
}

/**
 * 修改用户团队名称
 */
export const updateUserTeamName = async (req: Request, res: Response): Promise<void> => {
  const { teamName } = req.body
  const userId = req.params.id as string

  if (!teamName) {
    return sendError(res, '团队名称不能为空', 400)
  }

  let users = await readUsers()
  const usrIdx = users.findIndex((u: any) => u.id === userId)
  
  if (usrIdx !== -1) {
    const managers = await readManagers()
    if (users.find((u: any) => u.id !== userId && u.teamName === teamName) || 
        managers.find((m: any) => m.teamName === teamName)) {
      return sendError(res, '该团队名称已存在', 409)
    }

    users[usrIdx].teamName = teamName
    users[usrIdx].updatedAt = new Date().toISOString()
    await writeUsers(users)
    return sendSuccess(res, null, '更新成功')
  }

  let managers = await readManagers()
  const mgrIdx = managers.findIndex((m: any) => m.id === userId)
  
  if (mgrIdx === -1) {
    return sendError(res, '用户不存在', 404)
  }

  if (managers.find((m: any) => m.id !== userId && m.teamName === teamName) || 
      users.find((u: any) => u.teamName === teamName)) {
    return sendError(res, '该团队名称已存在', 409)
  }

  managers[mgrIdx].teamName = teamName
  managers[mgrIdx].updatedAt = new Date().toISOString()
  await writeManagers(managers)

  return sendSuccess(res, null, '更新成功')
}
