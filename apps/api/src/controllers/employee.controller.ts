import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { sendSuccess, sendError } from '../utils/response.js'
import {
  readEmployeeByPhone,
  readEmployeeById,
  readEmployeesByUserId,
  insertEmployee,
  deleteEmployee,
  updateEmployee,
  readUser,
} from '../data/index.js'
import { login as sessionLogin, generateTokens } from '../middleware/auth.js'

const SALT_ROUNDS = 12

// ============================================
// 辅助函数
// ============================================

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS)
}

async function validateEmployeePassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}

// ============================================
// 员工子账户管理
// ============================================

/**
 * 创建员工子账户
 */
export const createEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, phone, password, nickname, expiresHours } = req.body
    
    if (!userId) {
      return sendError(res, '缺少用户ID', 1)
    }
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return sendError(res, '手机号格式不正确', 1)
    }
    if (!password || password.length < 6) {
      return sendError(res, '密码至少6位', 1)
    }
    if (!expiresHours || expiresHours < 1) {
      return sendError(res, '有效期至少1小时', 1)
    }
    
    const existing = await readEmployeeByPhone(phone)
    if (existing) {
      return sendError(res, '该手机号已被注册为员工', 1)
    }
    
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + expiresHours)
    
    const hashedPassword = await hashPassword(password)
    const employee = {
      id: `emp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      phone,
      password: hashedPassword,
      nickname: nickname || `员工${phone.slice(-4)}`,
      expiresAt: expiresAt.toISOString().slice(0, 19).replace('T', ' '),
      status: 'active',
    }
    
    await insertEmployee(employee)
    
    sendSuccess(res, { ...employee, password: '******' }, '创建成功')
  } catch (err: any) {
    sendError(res, err.message || '创建失败', 1)
  }
}

/**
 * 获取当前用户的员工列表
 */
export const getEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.query
    
    if (!userId) {
      return sendError(res, '缺少用户ID', 1)
    }
    
    const employees = await readEmployeesByUserId(userId as string)
    sendSuccess(res, employees, 'success')
  } catch (err: any) {
    sendError(res, err.message || '获取失败', 1)
  }
}

/**
 * 获取员工详情
 */
export const getEmployeeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string
    const employee = await readEmployeeById(id)
    if (!employee) {
      return sendError(res, '员工不存在', 1)
    }
    sendSuccess(res, employee, 'success')
  } catch (err: any) {
    sendError(res, err.message || '获取失败', 1)
  }
}

/**
 * 删除员工
 */
export const deleteEmployeeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string
    await deleteEmployee(id)
    sendSuccess(res, null, '删除成功')
  } catch (err: any) {
    sendError(res, err.message || '删除失败', 1)
  }
}

/**
 * 更新员工子账户（手机号不允许修改）
 */
export const updateEmployeeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string
    const { password, nickname, expiresHours } = req.body
    
    const employee = await readEmployeeById(id)
    if (!employee) {
      return sendError(res, '员工不存在', 1)
    }
    
    const updateFields: Record<string, any> = {}
    
    if (password && password.length >= 6) {
      updateFields.password = await hashPassword(password)
    }
    
    if (nickname) {
      updateFields.nickname = nickname
    }
    
    if (expiresHours && expiresHours >= 1) {
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + expiresHours)
      updateFields.expiresAt = expiresAt.toISOString().slice(0, 19).replace('T', ' ')
    }
    
    if (Object.keys(updateFields).length === 0) {
      return sendError(res, '没有需要更新的字段', 1)
    }
    
    await updateEmployee(id, updateFields)
    
    const updated = await readEmployeeById(id)
    sendSuccess(res, { ...updated, password: '******' }, '更新成功')
  } catch (err: any) {
    sendError(res, err.message || '更新失败', 1)
  }
}

// ============================================
// 员工登录验证
// ============================================

/**
 * 员工登录验证
 */
export const employeeLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, password } = req.body
    
    if (!phone || !password) {
      return sendError(res, '请输入手机号和密码', 1)
    }
    
    const employee = await readEmployeeByPhone(phone)
    
    if (!employee) {
      return sendError(res, '手机号、密码错误或账户已过期', 1)
    }
    
    const passwordValid = await validateEmployeePassword(password, employee.password)
    if (!passwordValid) {
      return sendError(res, '手机号、密码错误或账户已过期', 1)
    }
    
    const now = new Date()
    const expiresAt = new Date(employee.expiresAt)
    if (expiresAt < now || employee.status !== 'active') {
      return sendError(res, '手机号、密码错误或账户已过期', 1)
    }
    
    const user = await readUser(employee.userId)
    const authUser = { 
      id: employee.id, 
      phone: employee.phone, 
      role: 'employee' as const, 
      nickname: employee.nickname,
      userId: employee.userId
    }
    const tokens = generateTokens(authUser)
    sessionLogin(req, { ...authUser, token: tokens.token })
    
    sendSuccess(res, {
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      employee: { ...employee, password: '******' },
      user: user ? { id: user.id, phone: user.phone, nickname: user.nickname } : null
    }, '登录成功')
  } catch (err: any) {
    sendError(res, err.message || '登录失败', 1)
  }
}

/**
 * 检查员工账户是否有效
 */
export const validateEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId } = req.body
    
    if (!employeeId) {
      return sendError(res, '缺少员工ID', 1)
    }
    
    const employee = await readEmployeeById(employeeId)
    if (!employee || employee.status !== 'active') {
      return sendError(res, '账户不存在或已被禁用', 1)
    }
    
    const now = new Date()
    const expiresAt = new Date(employee.expiresAt)
    
    if (expiresAt < now) {
      return sendError(res, '账户已过期', 1)
    }
    
    sendSuccess(res, { expiresAt: employee.expiresAt }, '账户有效')
  } catch (err: any) {
    sendError(res, err.message || '验证失败', 1)
  }
}
