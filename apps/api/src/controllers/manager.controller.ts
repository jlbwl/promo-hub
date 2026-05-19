import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import { sendSuccess, sendError } from '../utils/response.js'
import {
  readManagers,
  insertManager,
  updateManager,
  deleteManager,
  readProducts,
  readOrders,
  writeProducts,
  writeOrders,
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
// 经理信息操作
// ============================================

/**
 * 获取经理列表
 * 返回所有渠道经理的基本信息（不包含密码）
 * @param _req - HTTP请求对象
 * @param res - HTTP响应对象
 * @returns 经理列表
 */
export const getManagers = async (_req: Request, res: Response): Promise<void> => {
  const managers = await readManagers()
  sendSuccess(res, managers, 'success')
}

/**
 * 获取单个经理信息
 * 根据经理ID查询详细信息（不包含密码）
 * @param req - HTTP请求对象，包含经理ID（req.params.id）
 * @param res - HTTP响应对象
 * @returns 经理详细信息
 */
export const getManagerById = async (req: Request, res: Response): Promise<void> => {
  const managerId = req.params.id
  const managers = await readManagers()
  const manager = managers.find((m: any) => m.id === managerId)
  
  if (!manager) {
    return sendError(res, '经理不存在', 404)
  }

  const { password: _, ...safeManager } = manager
  sendSuccess(res, safeManager, 'success')
}

/**
 * 添加经理（创建新渠道经理账号）
 * 验证渠道名称唯一性，加密密码，保存经理信息
 * @param req - HTTP请求对象，包含渠道名称、密码、手机号等信息
 * @param res - HTTP响应对象
 * @returns 新创建的经理信息
 */
export const createManager = async (req: Request, res: Response): Promise<void> => {
  const managers = await readManagers()
  const { teamName, password, phone } = req.body

  if (!teamName || !password) {
    return sendError(res, '渠道名称和密码不能为空', 400)
  }

  if (managers.find((m: any) => m.teamName === teamName)) {
    return sendError(res, '该渠道名称已存在', 409)
  }

  const users = await (async () => {
    try {
      const { readUsers } = await import('../data.js')
      return await readUsers()
    } catch {
      return []
    }
  })()
  if (users.find((u: any) => u.teamName === teamName)) {
    return sendError(res, '该团队名称已存在', 409)
  }

  const now = new Date().toISOString()
  const hashedPassword = await hashPassword(password)
  const manager = {
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    username: teamName,
    password: hashedPassword,
    name: teamName,
    teamName,
    phone: phone || '',
    role: 'manager',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
  
  await insertManager(manager)
  
  const { password: _, ...safeManager } = manager
  sendSuccess(res, safeManager, '添加成功')
}

/**
 * 删除经理（同时下架其所有产品，转移佣金数据给管理后台）
 */
export const deleteManagerWithCascade = async (req: Request, res: Response): Promise<void> => {
  const smsCode = req.query.smsCode as string
  
  if (!smsCode) {
    return sendError(res, '验证码不能为空', 400)
  }
  
  let managers = await readManagers()
  const managerId = req.params.id as string
  const index = managers.findIndex((m: any) => m.id === managerId)
  if (index === -1) {
    return sendError(res, '经理不存在', 404)
  }
  const managerName = managers[index].name || ''
  await deleteManager(managerId)

  let products = await readProducts()
  let offlineCount = 0
  const now = new Date().toISOString()
  const updatedProducts = products.map((p: any) => {
    if (p.managerId === managerId && p.status === 'published') {
      offlineCount++
      return { ...p, status: 'offline', updatedAt: now }
    }
    return p
  })
  await writeProducts(updatedProducts)

  let orders = await readOrders()
  let transferredOrders = 0
  const updatedOrders = orders.map((o: any) => {
    if (o.managerId === managerId && (o.status === 'pending' || o.status === 'approved' || o.status === 'pending_payment')) {
      transferredOrders++
      return {
        ...o,
        transferredFromManager: managerName,
        transferredAt: now,
        managedBy: 'admin',
      }
    }
    return o
  })
  await writeOrders(updatedOrders)

  sendSuccess(res, null, `删除成功，已下架 ${offlineCount} 个产品，转移 ${transferredOrders} 笔订单至管理后台`)
}

/**
 * 更新经理（启用/禁用时联动产品状态）
 */
export const updateManagerById = async (req: Request, res: Response): Promise<void> => {
  const managers = await readManagers()
  const index = managers.findIndex((m: any) => m.id === req.params.id)
  if (index === -1) {
    return sendError(res, '经理不存在', 404)
  }

  const now = new Date().toISOString()
  const newStatus = req.body.status
  const updatedManager = { 
    ...managers[index], 
    ...req.body, 
    id: managers[index].id, 
    updatedAt: now 
  }
  
  await updateManager(req.params.id as string, updatedManager)

  if (newStatus === 'disabled') {
    let products = await readProducts()
    let offlineCount = 0
    const updatedProducts = products.map((p: any) => {
      if (p.managerId === req.params.id && p.status === 'published') {
        offlineCount++
        return { ...p, status: 'offline', updatedAt: now }
      }
      return p
    })
    await writeProducts(updatedProducts)
  }

  const { password: _, ...safeManager } = updatedManager
  sendSuccess(res, safeManager, '更新成功')
}

// ============================================
// 登录相关
// ============================================

/**
 * 经理密码登录
 */
export const managerLogin = async (req: Request, res: Response): Promise<void> => {
  const { phone, password } = req.body
  if (!phone || !password) {
    return sendError(res, '手机号和密码不能为空', 400)
  }

  const managers = await readManagers()
  const manager = managers.find(
    (m: any) => m.phone === phone && m.status === 'active'
  )
  if (!manager) {
    return sendError(res, '手机号或密码错误，或账号已被禁用', 401)
  }

  const passwordValid = await verifyPassword(password, manager.password)
  if (!passwordValid) {
    return sendError(res, '手机号或密码错误，或账号已被禁用', 401)
  }
  
  sessionLogin(req, { id: manager.id, phone: manager.phone, role: 'manager', nickname: manager.name, teamName: manager.teamName })
  
  const { password: _, ...safeManager } = manager
  sendSuccess(res, { manager: safeManager }, '登录成功')
}

/**
 * 经理短信验证码发送
 */
export const sendManagerSmsCode = async (req: Request, res: Response): Promise<void> => {
  const { phone } = req.body
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return sendError(res, '请输入正确的手机号', 400)
  }

  const code = generateSmsCode()
  saveSmsCode(phone, code)
  
  await sendSmsCode(phone, code)
  sendSuccess(res, null, '验证码已发送')
}

/**
 * 经理短信验证码登录
 */
export const managerSmsLogin = async (req: Request, res: Response): Promise<void> => {
  const { phone, code } = req.body
  if (!phone || !code) {
    return sendError(res, '手机号和验证码不能为空', 400)
  }

  const valid = verifySmsCode(phone, code)
  if (!valid) {
    return sendError(res, '验证码错误或已过期', 400)
  }
  deleteSmsCode(phone)

  const managers = await readManagers()
  const manager = managers.find((m: any) => m.phone === phone && m.status === 'active')
  if (!manager) {
    return sendError(res, '该手机号未注册或已被禁用', 404)
  }
  
  sessionLogin(req, { id: manager.id, phone: manager.phone, role: 'manager', nickname: manager.name, teamName: manager.teamName })
  
  const { password: _, ...safeManager } = manager
  sendSuccess(res, { manager: safeManager }, '登录成功')
}

/**
 * 通过经理ID验证身份
 */
export const verifyManagerById = async (req: Request, res: Response): Promise<void> => {
  const managers = await readManagers()
  const manager = managers.find((m: any) => m.id === req.params.id)
  if (!manager) {
    return sendError(res, '账号已被删除', 401)
  }
  if (manager.status !== 'active') {
    return sendError(res, '账号已被禁用', 401)
  }
  sendSuccess(res, { valid: true }, 'ok')
}

/**
 * 经理：通过短信验证码修改密码
 */
export const setManagerPassword = async (req: Request, res: Response): Promise<void> => {
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

  let managers = await readManagers()
  const index = managers.findIndex((m: any) => m.phone === phone)
  if (index === -1) {
    return sendError(res, '经理不存在', 404)
  }

  const hashedPassword = await hashPassword(password)
  managers[index].password = hashedPassword
  managers[index].updatedAt = new Date().toISOString()
  await writeManagers(managers)

  sendSuccess(res, null, '密码修改成功')
}

// ============================================
// 内部辅助函数
// ============================================

async function writeManagers(managers: any[]): Promise<void> {
  const { writeManagers: write } = await import('../data.js')
  await write(managers)
}
