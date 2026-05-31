import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { sendSuccess, sendError } from '../utils/response.js'
import {
  readAdminByPhone,
  updateAdmin,
  readUsers,
  readManagers,
  readProducts,
  readCommissions,
} from '../data.js'
import { login as sessionLogin, generateAuthToken } from '../middleware/auth.js'
import { generateSmsCode, saveSmsCode, verifySmsCode, deleteSmsCode } from '../utils/sms.js'
import { sendSmsCode } from '../sms.js'

const SALT_ROUNDS = 12

/**
 * 管理员短信验证码发送
 */
export const sendAdminSmsCode = async (req: Request, res: Response): Promise<void> => {
  const { phone } = req.body
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return sendError(res, '请输入正确的手机号', 400)
  }

  const admin = await readAdminByPhone(phone)
  if (!admin) {
    return sendError(res, '该手机号未注册', 404)
  }

  const code = generateSmsCode()
  saveSmsCode(phone, code)
  
  await sendSmsCode(phone, code)
  sendSuccess(res, null, '验证码已发送')
}

/**
 * 管理员密码登录
 */
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  const { phone, password } = req.body
  if (!phone || !password) {
    return sendError(res, '手机号和密码不能为空', 400)
  }

  const admin = await readAdminByPhone(phone)
  if (!admin) {
    return sendError(res, '手机号或密码错误', 401)
  }

  const passwordValid = await verifyPassword(password, admin.password)
  if (!passwordValid) {
    return sendError(res, '手机号或密码错误', 401)
  }

  const user = { id: admin.id, phone: admin.phone, role: 'admin' as const, nickname: admin.name }
  const token = generateAuthToken(user)
  sessionLogin(req, { ...user, token })

  sendSuccess(res, {
    token,
    admin: { id: admin.id, phone: admin.phone, name: admin.name }
  }, '登录成功')
}

/**
 * 管理员短信登录
 */
export const adminSmsLogin = async (req: Request, res: Response): Promise<void> => {
  const { phone, code } = req.body
  if (!phone || !code) {
    return sendError(res, '手机号和验证码不能为空', 400)
  }

  const valid = verifySmsCode(phone, code)
  if (!valid) {
    return sendError(res, '验证码错误或已过期', 400)
  }
  deleteSmsCode(phone)

  const admin = await readAdminByPhone(phone)
  if (!admin) {
    return sendError(res, '该手机号未注册', 404)
  }

  const user = { id: admin.id, phone: admin.phone, role: 'admin' as const, nickname: admin.name }
  const token = generateAuthToken(user)
  sessionLogin(req, { ...user, token })

  sendSuccess(res, {
    token,
    admin: { id: admin.id, phone: admin.phone, name: admin.name }
  }, '登录成功')
}

/**
 * 管理员修改密码
 */
export const adminChangePassword = async (req: Request, res: Response): Promise<void> => {
  const { oldPassword, newPassword } = req.body
  if (!oldPassword || !newPassword) {
    return sendError(res, '请输入旧密码和新密码', 400)
  }
  if (newPassword.length < 6) {
    return sendError(res, '新密码长度不能少于6位', 400)
  }
  if (newPassword.length > 32) {
    return sendError(res, '新密码长度不能超过32位', 400)
  }

  const user = req.session?.user
  if (!user) {
    return sendError(res, '未登录', 401)
  }

  const admin = await readAdminByPhone(user.phone)
  if (!admin) {
    return sendError(res, '管理员不存在', 404)
  }

  const oldPasswordValid = await verifyPassword(oldPassword, admin.password)
  if (!oldPasswordValid) {
    return sendError(res, '旧密码错误', 400)
  }

  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS)
  await updateAdmin(admin.id, { password: hashedPassword })

  sendSuccess(res, null, '密码修改成功')
}

/**
 * 获取管理员仪表盘统计数据
 */
export const getAdminStats = async (req: Request, res: Response): Promise<void> => {
  try {
    let users: any[] = []
    let managers: any[] = []
    let products: any[] = []
    let commissions: any[] = []

    try {
      users = await readUsers()
      managers = await readManagers()
      products = await readProducts()
      commissions = await readCommissions()
    } catch (dbError: any) {
      console.warn('[管理员统计] 数据库查询失败，尝试降级到内存:', dbError)
      const { readUsers: memReadUsers, readManagers: memReadManagers, readProducts: memReadProducts, readCommissions: memReadCommissions } = await import('../data-memory.js')
      users = await memReadUsers()
      managers = await memReadManagers()
      products = await memReadProducts()
      commissions = await memReadCommissions()
    }

    const managerCount = managers.filter((m: any) => m.status === 'active').length
    const userCount = users.filter((u: any) => u.status === 'active').length
    const publishedProductCount = products.filter((p: any) => p.status === 'published').length
    const totalCommission = commissions
      .filter((c: any) => c.status === 'paid')
      .reduce((sum: number, c: any) => sum + (c.amount || 0), 0)

    sendSuccess(res, {
      managerCount,
      userCount,
      publishedProductCount,
      totalCommission: Math.round(totalCommission * 100) / 100,
    })
  } catch (error: any) {
    console.error('[管理员统计] 错误:', error)
    sendSuccess(res, {
      managerCount: 0,
      userCount: 0,
      publishedProductCount: 0,
      totalCommission: 0,
    })
  }
}

/**
 * 获取操作日志列表
 */
export const getOperationLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 10
    const operationType = req.query.operationType as string
    const targetType = req.query.targetType as string
    const adminId = req.query.adminId as string

    // 模拟操作日志数据（实际项目中应从数据库读取）
    const allLogs: any[] = []

    // 过滤日志
    let filteredLogs = allLogs
    if (operationType) {
      filteredLogs = filteredLogs.filter(log => log.operationType === operationType)
    }
    if (targetType) {
      filteredLogs = filteredLogs.filter(log => log.targetType === targetType)
    }
    if (adminId) {
      filteredLogs = filteredLogs.filter(log => log.adminId === adminId)
    }

    // 分页
    const total = filteredLogs.length
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const list = filteredLogs.slice(start, end)

    sendSuccess(res, { list, total })
  } catch (error: any) {
    console.error('[获取操作日志] 错误:', error)
    sendError(res, error.message || '获取失败', 500)
  }
}

// 密码验证辅助函数
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (password === hash) return true
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}
