import { Request, Response } from 'express'
import { getErrorMessage, type Manager } from '@promo/shared'
import { sendSuccess, sendError } from '../utils/response.js'
import { withTransaction, query, queryOne } from '../db.js'
import {
  readManagers,
  readManager,
  readUsers,
  insertManager,
  updateManager,
  type UserRow,
} from '../data/index.js'
import { generateTokens, revokeAllRefreshTokens } from '../middleware/auth.js'
import { sendSmsCode } from '../utils/sms.js'
import { generateSmsCode, saveSmsCode, verifySmsCode, deleteSmsCode } from '../utils/sms.js'
import { logAdminOperation } from '../utils/auditLog.js'
import { buildAuditDetail, maskPhone } from '../utils/auditDetail.js'
import logger from '../utils/logger.js'
import { hashPassword, verifyPassword } from '../utils/password.js'

/** 经理状态展示文案 */
const managerStatusLabel = (status?: string): string => (status === 'active' ? '启用' : status ? '禁用' : '-')

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
  // 剔除密码哈希后再返回
  const safeManagers = managers.map(({ password: _pw, ...m }: Manager) => m)
  sendSuccess(res, safeManagers, 'success')
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
  const manager = managers.find((m: Manager) => m.id === managerId)
  
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
    logger.info('[createManager] Starting manager creation', { teamName: req.body.teamName, phone: maskPhone(req.body.phone) })

    const managers = await readManagers()
    const { teamName, password, phone } = req.body

    if (!teamName || !password) {
      logger.warn('[createManager] Missing required fields', { teamName: !!teamName, password: !!password })
      return sendError(res, '渠道名称和密码不能为空', 400)
    }

    if (managers.find((m: Manager) => m.teamName === teamName)) {
      logger.warn('[createManager] Manager teamName already exists', { teamName })
      return sendError(res, '该渠道名称已存在', 409)
    }

    let users: UserRow[] = []
    try {
      users = await readUsers()
    } catch (err) {
      logger.warn('[createManager] Failed to read users, skipping duplicate check', { error: err })
      // 如果读取用户失败，跳过这个检查
    }

    if (users.length > 0 && users.find((u: UserRow) => u.teamName === teamName)) {
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

    // 创建经理与删除经理保持对称审计；不记录密码或哈希
    await logAdminOperation(req, {
      operationType: 'create',
      targetType: 'manager',
      targetId: manager.id,
      targetName: teamName,
      detail: buildAuditDetail({
        summary: `创建渠道经理「${teamName}」`,
        meta: {
          经理ID: manager.id,
          渠道名称: teamName,
          手机号: maskPhone(manager.phone),
          初始角色: '渠道经理',
          初始状态: '启用',
        },
      }),
    })

    const { password: _, ...safeManager } = manager
    sendSuccess(res, safeManager, '添加成功')
  } catch (error) {
    logger.error('[createManager] Failed to create manager', { error: getErrorMessage(error), stack: error instanceof Error ? error.stack : undefined })
    sendError(res, '添加渠道失败: ' + getErrorMessage(error), 500)
  }
}

/**
 * 删除经理（同时下架其所有产品，转移佣金数据给管理后台）
 */
export const deleteManagerWithCascade = async (req: Request, res: Response): Promise<void> => {
  // 验证码从请求体读取：URL 会进入访问日志与代理日志，一次性凭据不能出现在 query 中
  const smsCode = (req.body as { smsCode?: string } | undefined)?.smsCode
  
  const adminInfo = req.user
  if (!adminInfo?.phone) {
    return sendError(res, '未登录', 401)
  }
  
  if (!smsCode || !verifySmsCode(adminInfo.phone, smsCode)) {
    return sendError(res, '验证码错误或已过期', 400)
  }
  
  const managerId = req.params.id as string
  const manager = await readManager(managerId)
  if (!manager) {
    return sendError(res, '经理不存在', 404)
  }
  const managerName = manager.name || ''
  
  // 时间字段统一由数据库 NOW() 生成，避免 ISO 字符串写入 DATETIME 报错
  await withTransaction(async (conn) => {
    await conn.execute('DELETE FROM managers WHERE id = ?', [managerId])

    const [productResult] = await conn.execute(
      'UPDATE products SET status = ?, updatedAt = NOW() WHERE managerId = ? AND status = ?',
      ['offline', managerId, 'published']
    )
    const offlineCount = (productResult as { affectedRows?: number }).affectedRows || 0

    const [orderResult] = await conn.execute(
      'UPDATE orders SET transferredFromManager = ?, transferredAt = NOW(), managedBy = ? WHERE managerId = ? AND status IN (?, ?, ?)',
      [managerName, 'admin', managerId, 'pending', 'approved', 'pending_payment']
    )
    const transferredOrders = (orderResult as { affectedRows?: number }).affectedRows || 0
    
    return { offlineCount, transferredOrders }
  })
  
  await logAdminOperation(req, {
    operationType: 'delete',
    targetType: 'manager',
    targetId: managerId,
    targetName: managerName || managerId,
    reason: '管理员删除渠道经理',
    detail: '已删除经理账号、下架其产品并转移相关订单'
  })

  sendSuccess(res, null, `删除成功，已下架 ${(manager as { productCount?: number }).productCount || 0} 个产品，转移订单至管理后台`)
}

/**
 * 更新经理（启用/禁用时联动产品状态）
 */
export const updateManagerById = async (req: Request, res: Response): Promise<void> => {
  // H14：单行读取/更新，避免全表回写
  const managerId = req.params.id as string
  const existing = await readManager(managerId)
  if (!existing) {
    return sendError(res, '经理不存在', 404)
  }

  const now = new Date().toISOString()
  // 白名单更新：仅允许修改状态，防止 mass assignment 覆盖密码等凭证字段
  const newStatus = req.body?.status
  if (newStatus !== 'active' && newStatus !== 'inactive') {
    return sendError(res, '无效的状态值', 400)
  }
  const oldStatus = existing.status
  const updatedManager = {
    ...existing,
    status: newStatus,
    id: existing.id,
    updatedAt: now,
  }

  await updateManager(managerId, { status: newStatus })

  if (newStatus === 'inactive') {
    // 禁用经理时联动下架其上架产品（单条 UPDATE，避免全表回写）
    await query(
      "UPDATE products SET status = 'offline', updatedAt = NOW() WHERE managerId = ? AND status = 'published'",
      [managerId]
    )
  }

  const { password: _, ...safeManager } = updatedManager
  const oldStatusLabel = managerStatusLabel(oldStatus)
  const newStatusLabel = managerStatusLabel(newStatus)
  await logAdminOperation(req, {
    operationType: 'update',
    targetType: 'manager',
    targetId: updatedManager.id,
    targetName: updatedManager.name || updatedManager.teamName || updatedManager.id,
    detail: buildAuditDetail({
      summary: `状态更新：${oldStatusLabel} → ${newStatusLabel}${newStatus === 'inactive' ? '（并下架其已上架产品）' : ''}`,
      changes: [
        { field: 'status', label: '状态', from: oldStatusLabel, to: newStatusLabel },
      ],
    }),
  })
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

    // H14：单行读取经理 + 单行更新，避免全表回写
    const existingManager = await readManager(managerId)
    if (!existingManager) {
      return sendError(res, '经理不存在', 404)
    }

    // 检查渠道名称是否重复
    const duplicate = await queryOne<{ id: string }>(
      'SELECT id FROM managers WHERE teamName = ? AND id <> ? LIMIT 1',
      [finalTeamName, managerId]
    )
    if (duplicate) {
      return sendError(res, '该渠道名称已存在', 409)
    }

    const oldTeamName = existingManager.teamName || ''

    // M16：经理信息与团队成员名称必须同事务更新，避免中途失败造成团队名不一致
    let updatedUsers = 0
    await withTransaction(async (conn) => {
      await conn.query(
        'UPDATE managers SET teamName = ?, name = ?, username = ?, updatedAt = NOW() WHERE id = ?',
        [finalTeamName, finalTeamName, finalTeamName, managerId]
      )
      if (oldTeamName) {
        const [result] = await conn.query(
          'UPDATE users SET teamName = ?, updatedAt = NOW() WHERE teamName = ?',
          [finalTeamName, oldTeamName]
        )
        updatedUsers = (result as { affectedRows?: number }).affectedRows || 0
      }
    })

    // 返回更新后的经理信息
    const { password: _, ...safeManager } = {
      ...existingManager,
      teamName: finalTeamName,
      name: finalTeamName,
    }
    logger.info('[updateManagerTeamName] Update successful', { managerId, finalTeamName, updatedUsers })
    await logAdminOperation(req, {
      operationType: 'update',
      targetType: 'manager',
      targetId: managerId,
      targetName: safeManager.name || finalTeamName,
      detail: buildAuditDetail({
        summary: `团队名称：${oldTeamName || '-'} → ${finalTeamName}`,
        changes: [
          { field: 'teamName', label: '团队名称', from: oldTeamName, to: finalTeamName },
        ],
      }),
    })
    sendSuccess(res, safeManager, '更新成功')
  } catch (error) {
    logger.error('[updateManagerTeamName] Failed to update team name', { error: getErrorMessage(error) })
    sendError(res, '更新失败: ' + getErrorMessage(error), 500)
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
    (m: Manager) => m.phone === phone && m.status === 'active'
  )
  if (!manager) {
    return sendError(res, '手机号或密码错误，或账号已被禁用', 401)
  }

  const passwordValid = await verifyPassword(password, manager.password as string)
  if (!passwordValid) {
    return sendError(res, '手机号或密码错误，或账号已被禁用', 401)
  }
  
  const user = { id: manager.id, phone: manager.phone, role: 'manager' as const, nickname: manager.name, teamName: manager.teamName }
  const tokens = await generateTokens(user)
  
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

  const managers = await readManagers()
  const manager = managers.find((m: Manager) => m.phone === phone && m.status === 'active')
  if (!manager) {
    // 防枚举：号码是否属于经理不可区分。内部静默丢弃，不向该号码发送短信
    sendSuccess(res, null, '验证码已发送')
    return
  }

  const code = generateSmsCode()
  saveSmsCode(phone, code)

  const result = await sendSmsCode(phone, code)
  if (!result.success) {
    logger.error('Manager SMS code send failed', { phone: maskPhone(phone), reason: result.message })
    deleteSmsCode(phone)
    return sendError(res, '验证码发送失败，请稍后重试', 500)
  }
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

  const managers = await readManagers()
  const manager = managers.find((m: Manager) => m.phone === phone && m.status === 'active')
  if (!manager) {
    // 防枚举：与"验证码错误"返回完全一致，不暴露号码是否属于经理
    return sendError(res, '验证码错误或已过期', 400)
  }
  
  const user = { id: manager.id, phone: manager.phone, role: 'manager' as const, nickname: manager.name, teamName: manager.teamName }
  const tokens = await generateTokens(user)
  
  const { password: _, ...safeManager } = manager
  sendSuccess(res, { token: tokens.token, refreshToken: tokens.refreshToken, manager: safeManager }, '登录成功')
}

/**
 * 通过经理ID验证身份
 */
export const verifyManagerById = async (req: Request, res: Response): Promise<void> => {
  const managers = await readManagers()
  const manager = managers.find((m: Manager) => m.id === req.params.id)
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

  // H14：按手机号单行查询 + 单行更新密码
  const existing = await queryOne<Manager>(
    'SELECT * FROM managers WHERE phone = ? LIMIT 1',
    [phone]
  )
  if (!existing) {
    return sendError(res, '经理不存在', 404)
  }

  const hashedPassword = await hashPassword(password)
  await updateManager(existing.id, { password: hashedPassword })

  // 改密后吊销该账号已签发的全部 refresh token（旧会话最长保留 1 小时 access token 有效期）
  await revokeAllRefreshTokens('manager', existing.id)

  sendSuccess(res, null, '密码修改成功')
}
