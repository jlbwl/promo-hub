import { Request, Response } from 'express'
import { getErrorMessage } from '@promo/shared'
import { sendSuccess, sendError } from '../utils/response.js'
import {
  readEmployeeByPhone,
  readEmployeeById,
  readEmployeesByUserId,
  insertEmployee,
  deleteEmployee,
  updateEmployee,
  readUser,
  type EmployeeInput,
} from '../data/index.js'
import { generateTokens } from '../middleware/auth.js'
import { hashPassword, verifyPassword } from '../utils/password.js'

// ============================================
// 员工子账户管理
// ============================================

/**
 * 从会话中解析可操作的 userId：
 * - user 角色：强制使用本人 id，忽略请求体中的 userId（防止越权创建/查看他人员工）
 * - admin 角色：允许使用请求体指定的 userId
 */
function resolveUserId(req: Request, bodyUserId?: string): string | null {
  if (req.user?.role === 'admin') {
    return bodyUserId || null
  }
  return req.user?.id || null
}

/**
 * 归属校验：user 角色只能操作自己名下的员工；admin 可操作任意
 */
function canManageEmployee(req: Request, employee: { userId: string }): boolean {
  if (req.user?.role === 'admin') return true
  return employee.userId === req.user?.id
}

/** 脱敏：剔除 password 字段 */
function maskEmployee<T extends { password?: string }>(e: T): Omit<T, 'password'> {
  const { password, ...rest } = e
  return rest
}

/**
 * 创建员工子账户
 */
export const createEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, password, nickname, expiresHours } = req.body
    const userId = resolveUserId(req, req.body.userId)

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

    // 过期时间 = 当前时刻 + N 小时，用 Date 对象直传
    // mysql2 写入/读取 DATETIME 均按连接时区（+08:00），避免本地运算+toISOString 双重时区偏移
    const expiresAt = new Date(Date.now() + expiresHours * 3600 * 1000)

    const hashedPassword = await hashPassword(password)
    const employee: EmployeeInput = {
      id: `emp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      phone,
      password: hashedPassword,
      nickname: nickname || `员工${phone.slice(-4)}`,
      expiresAt,
      status: 'active',
    }

    await insertEmployee(employee)

    sendSuccess(res, maskEmployee(employee), '创建成功')
  } catch (err) {
    sendError(res, getErrorMessage(err, '创建失败'), 1)
  }
}

/**
 * 获取当前用户的员工列表
 */
export const getEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = resolveUserId(req, req.query.userId as string | undefined)

    if (!userId) {
      return sendError(res, '缺少用户ID', 1)
    }

    const employees = await readEmployeesByUserId(userId)
    sendSuccess(res, employees.map(maskEmployee), 'success')
  } catch (err) {
    sendError(res, getErrorMessage(err, '获取失败'), 1)
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
    if (!canManageEmployee(req, employee)) {
      return sendError(res, '无权访问该员工', 403)
    }
    sendSuccess(res, maskEmployee(employee), 'success')
  } catch (err) {
    sendError(res, getErrorMessage(err, '获取失败'), 1)
  }
}

/**
 * 删除员工
 */
export const deleteEmployeeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string
    const employee = await readEmployeeById(id)
    if (!employee) {
      return sendError(res, '员工不存在', 1)
    }
    if (!canManageEmployee(req, employee)) {
      return sendError(res, '无权操作该员工', 403)
    }
    await deleteEmployee(id)
    sendSuccess(res, null, '删除成功')
  } catch (err) {
    sendError(res, getErrorMessage(err, '删除失败'), 1)
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
    if (!canManageEmployee(req, employee)) {
      return sendError(res, '无权操作该员工', 403)
    }

    const updateFields: Record<string, unknown> = {}

    if (password && password.length >= 6) {
      updateFields.password = await hashPassword(password)
    }

    if (nickname) {
      updateFields.nickname = nickname
    }

    if (expiresHours && expiresHours >= 1) {
      // 同创建逻辑：Date 对象直传，避免双重时区偏移
      updateFields.expiresAt = new Date(Date.now() + expiresHours * 3600 * 1000)
    }

    if (Object.keys(updateFields).length === 0) {
      return sendError(res, '没有需要更新的字段', 1)
    }

    await updateEmployee(id, updateFields)

    const updated = await readEmployeeById(id)
    sendSuccess(res, updated ? maskEmployee(updated) : null, '更新成功')
  } catch (err) {
    sendError(res, getErrorMessage(err, '更新失败'), 1)
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
    
    const passwordValid = await verifyPassword(password, employee.password)
    if (!passwordValid) {
      return sendError(res, '手机号、密码错误或账户已过期', 1)
    }
    
    const now = new Date()
    const expiresAt = new Date(employee.expiresAt as string)
    if (expiresAt < now || employee.status !== 'active') {
      return sendError(res, '手机号、密码错误或账户已过期', 1)
    }
    
    // 员工依赖主账户存在且启用：主账户被删除/禁用后不得继续登录
    const user = await readUser(employee.userId)
    if (!user || (user.status || 'active') !== 'active') {
      return sendError(res, '手机号、密码错误或账户已过期', 1)
    }

    const authUser = { 
      id: employee.id, 
      phone: employee.phone, 
      role: 'employee' as const, 
      nickname: employee.nickname,
      userId: employee.userId
    }
    const tokens = await generateTokens(authUser)
    
    sendSuccess(res, {
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      employee: { ...employee, password: '******' },
      user: { id: user.id, phone: user.phone, nickname: user.nickname }
    }, '登录成功')
  } catch (err) {
    sendError(res, getErrorMessage(err, '登录失败'), 1)
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

    // O12：仅允许本人、其所属账号或管理员查看，避免按 ID 枚举员工有效期
    const current = req.user
    const canView = !!current && (
      current.role === 'admin' ||
      current.id === employee.id ||
      current.id === employee.userId
    )
    if (!canView) {
      return sendError(res, '无权查看该员工', 1)
    }

    const now = new Date()
    const expiresAt = new Date(employee.expiresAt as string)
    
    if (expiresAt < now) {
      return sendError(res, '账户已过期', 1)
    }
    
    sendSuccess(res, { expiresAt: employee.expiresAt }, '账户有效')
  } catch (err) {
    sendError(res, getErrorMessage(err, '验证失败'), 1)
  }
}
