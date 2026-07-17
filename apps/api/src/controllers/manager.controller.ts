import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { sendSuccess, sendError } from '../utils/response.js'
import {
  readManagers,
  readUsers,
  insertManager,
  updateManager,
  deleteManager,
  readProducts,
  readOrders,
  writeProducts,
  writeOrders,
  writeManagers,
  updateUser,
} from '../data/index.js'
import { login as sessionLogin, generateTokens } from '../middleware/auth.js'
import { sendSmsCode } from '../utils/sms.js'
import { generateSmsCode, saveSmsCode, verifySmsCode, deleteSmsCode } from '../utils/sms.js'
import logger from '../utils/logger.js'

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
  try {
    logger.info('[createManager] Starting manager creation', { teamName: req.body.teamName, phone: req.body.phone })

    const managers = await readManagers()
    const { teamName, password, phone } = req.body

    if (!teamName || !password) {
      logger.warn('[createManager] Missing required fields', { teamName: !!teamName, password: !!password })
      return sendError(res, '渠道名称和密码不能为空', 400)
    }

    if (managers.find((m: any) => m.teamName === teamName)) {
      logger.warn('[createManager] Manager teamName already exists', { teamName })
      return sendError(res, '该渠道名称已存在', 409)
    }

    let users: any[] = []
    try {
      users = await readUsers()
    } catch (err) {
      logger.warn('[createManager] Failed to read users, skipping duplicate check', { error: err })
      // 如果读取用户失败，跳过这个检查
    }

    if (users.length > 0 && users.find((u: any) => u.teamName === teamName)) {
      logger.warn('[createManager] User teamName already exists', { teamName })
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

    logger.info('[createManager] Inserting manager into database', { managerId: manager.id, teamName })
    await insertManager(manager)
    logger.info('[createManager] Manager inserted successfully', { managerId: manager.id })

    const { password: _, ...safeManager } = manager
    sendSuccess(res, safeManager, '添加成功')
  } catch (error: any) {
    logger.error('[createManager] Failed to create manager', { error: error.message, stack: error.stack })
    sendError(res, '添加渠道失败: ' + error.message, 500)
  }
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

/**
 * 更新经理团队名称
 * 同时更新该经理下所有用户的团队名称
 */
export const updateManagerTeamName = async (req: Request, res: Response): Promise<void> => {
  try {
    const managerId = req.params.id as string
    const { teamName, newTeamName } = req.body
    const finalTeamName = teamName || newTeamName

    logger.info('[updateManagerTeamName] Starting update', { managerId, teamName, newTeamName, finalTeamName })

    if (!finalTeamName) {
      return sendError(res, '渠道名称不能为空', 400)
    }

    // 获取经理列表
    const managers = await readManagers()
    const managerIndex = managers.findIndex((m: any) => m.id === managerId)
    if (managerIndex === -1) {
      return sendError(res, '经理不存在', 404)
    }

    // 检查渠道名称是否重复
    const existingManager = managers.find((m: any) => 
      m.teamName === finalTeamName && m.id !== managerId
    )
    if (existingManager) {
      return sendError(res, '该渠道名称已存在', 409)
    }

    const oldTeamName = managers[managerIndex].teamName
    managers[managerIndex].teamName = finalTeamName
    managers[managerIndex].name = finalTeamName
    managers[managerIndex].username = finalTeamName

    // 更新经理信息
    await writeManagers(managers)

    // 同时更新该经理下所有用户的团队名称
    // 只更新 teamName 字段，避免修改其他字段
    const users = await readUsers()
    const usersToUpdate = users.filter((u: any) => u.teamName === oldTeamName)
    
    for (const user of usersToUpdate) {
      await updateUser(user.id, { teamName: finalTeamName })
    }

    // 返回更新后的经理信息
    const { password: _, ...safeManager } = managers[managerIndex]
    logger.info('[updateManagerTeamName] Update successful', { managerId, finalTeamName, updatedUsers: usersToUpdate.length })
    sendSuccess(res, safeManager, '更新成功')
  } catch (error: any) {
    logger.error('[updateManagerTeamName] Failed to update team name', { error: error.message })
    sendError(res, '更新失败: ' + error.message, 500)
  }
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
  
  const user = { id: manager.id, phone: manager.phone, role: 'manager' as const, nickname: manager.name, teamName: manager.teamName }
  const tokens = await generateTokens(user)
  sessionLogin(req, { ...user, token: tokens.token })
  
  const { password: _, ...safeManager } = manager
  sendSuccess(res, { token: tokens.token, refreshToken: tokens.refreshToken, manager: safeManager }, '登录成功')
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
  
  const user = { id: manager.id, phone: manager.phone, role: 'manager' as const, nickname: manager.name, teamName: manager.teamName }
  const tokens = await generateTokens(user)
  sessionLogin(req, { ...user, token: tokens.token })
  
  const { password: _, ...safeManager } = manager
  sendSuccess(res, { token: tokens.token, refreshToken: tokens.refreshToken, manager: safeManager }, '登录成功')
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
