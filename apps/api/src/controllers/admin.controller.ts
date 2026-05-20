import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import { sendSuccess, sendError } from '../utils/response.js'
import {
  readAdminByPhone,
  updateAdmin,
  readUsers,
  readManagers,
  readProducts,
  readCommissions,
} from '../data.js'
import { login as sessionLogin } from '../middleware/auth.js'

const SALT_ROUNDS = 12

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

  sessionLogin(req, { id: admin.id, phone: admin.phone, role: 'admin', nickname: admin.name })

  sendSuccess(res, {
    admin: { id: admin.id, phone: admin.phone, name: admin.name }
  }, '登录成功')
}

/**
 * 管理员短信登录
 */
export const adminSmsLogin = async (req: Request, res: Response): Promise<void> => {
  // 待实现
  sendError(res, '功能开发中', 501)
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
    const users = await readUsers()
    const managers = await readManagers()
    const products = await readProducts()
    const commissions = await readCommissions()

    const managerCount = managers.length
    const userCount = users.length
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
