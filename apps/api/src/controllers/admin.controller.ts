import logger from '../utils/logger.js'
import { Request, Response } from 'express'
import { getErrorMessage } from '@promo/shared'
import { sendSuccess, sendError } from '../utils/response.js'
import { parsePage, parsePageSize } from '../utils/pagination.js'
import {
  readAdminByPhone,
  updateAdmin,
  readOperationLogs,
  readOperationLogAdmins,
  updateProduct,
} from '../data/index.js'
import { queryOne } from '../db.js'
import { getCacheService, CacheKeys } from '../services/cache/index.js'
import { login as sessionLogin, generateTokens } from '../middleware/auth.js'
import { generateSmsCode, saveSmsCode, verifySmsCode, deleteSmsCode } from '../utils/sms.js'
import { sendSmsCode } from '../utils/sms.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { logAdminOperation } from '../utils/auditLog.js'
import { buildAuditDetail, maskPhone } from '../utils/auditDetail.js'
import { parseOperationLogFilters } from '../utils/operationLogQuery.js'

/** 产品状态展示文案 */
const productStatusLabel = (status?: string): string => {
  if (status === 'published') return '已上架'
  if (status === 'offline') return '已下线'
  if (status === 'admin_offline') return '已被管理员下架'
  return status || '-'
}

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

  const result = await sendSmsCode(phone, code)
  if (!result.success) {
    logger.error('Admin SMS code send failed', { phone, reason: result.message })
    deleteSmsCode(phone)
    return sendError(res, '验证码发送失败，请稍后重试', 500)
  }
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
  const tokens = await generateTokens(user)
  await sessionLogin(req, { ...user, token: tokens.token })

  sendSuccess(res, {
    token: tokens.token,
    refreshToken: tokens.refreshToken,
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

  const admin = await readAdminByPhone(phone)
  if (!admin) {
    return sendError(res, '该手机号未注册', 404)
  }

  const user = { id: admin.id, phone: admin.phone, role: 'admin' as const, nickname: admin.name }
  const tokens = await generateTokens(user)
  await sessionLogin(req, { ...user, token: tokens.token })

  sendSuccess(res, {
    token: tokens.token,
    refreshToken: tokens.refreshToken,
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

  // M25：Session 中间件已移除，兼容 JWT 身份（req.user）
  const user = req.session?.user || req.user
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

  const hashedPassword = await hashPassword(newPassword)
  await updateAdmin(admin.id, { password: hashedPassword })

  // 只记录改密事件本身，不记录旧密码、新密码、口令片段或哈希
  await logAdminOperation(req, {
    operationType: 'update',
    targetType: 'admin',
    targetId: admin.id,
    targetName: admin.name || admin.phone,
    detail: buildAuditDetail({
      summary: '管理员修改了密码（旧密码校验）',
      meta: {
        管理员ID: admin.id,
        手机号: maskPhone(admin.phone),
        校验方式: '旧密码校验',
      },
    }),
  })

  sendSuccess(res, null, '密码修改成功')
}

/**
 * 管理员密码更新（支持短信验证码，无需旧密码）
 */
export const adminPasswordUpdate = async (req: Request, res: Response): Promise<void> => {
  const { phone, code, oldPassword, newPassword } = req.body
  
  // 验证必填参数
  if (!newPassword) {
    return sendError(res, '请输入新密码', 400)
  }
  if (newPassword.length < 6) {
    return sendError(res, '新密码长度不能少于6位', 400)
  }
  if (newPassword.length > 32) {
    return sendError(res, '新密码长度不能超过32位', 400)
  }

  const user = req.session?.user || req.user
  if (!user) {
    return sendError(res, '未登录或会话已过期', 401)
  }

  // 获取管理员信息
  const adminPhone = phone || user.phone
  if (phone && phone !== user.phone) {
    return sendError(res, '无权修改其他管理员密码', 403)
  }
  const admin = await readAdminByPhone(adminPhone)
  if (!admin) {
    return sendError(res, '管理员不存在', 404)
  }

  // 模式1：验证码模式（不需要旧密码）
  if (code) {
    const valid = verifySmsCode(adminPhone, code)
    if (!valid) {
      return sendError(res, '验证码错误或已过期', 400)
    }
  } 
  // 模式2：旧密码模式
  else if (oldPassword) {
    const oldPasswordValid = await verifyPassword(oldPassword, admin.password)
    if (!oldPasswordValid) {
      return sendError(res, '旧密码错误', 400)
    }
  } else {
    return sendError(res, '请提供验证码或旧密码', 400)
  }

  // 更新密码
  const hashedPassword = await hashPassword(newPassword)
  await updateAdmin(admin.id, { password: hashedPassword })

  // 只记录改密事件本身，不记录任何密码内容或哈希
  await logAdminOperation(req, {
    operationType: 'update',
    targetType: 'admin',
    targetId: admin.id,
    targetName: admin.name || admin.phone,
    detail: buildAuditDetail({
      summary: `管理员修改了密码（${code ? '短信验证码' : '旧密码'}校验）`,
      meta: {
        管理员ID: admin.id,
        手机号: maskPhone(admin.phone),
        校验方式: code ? '短信验证码' : '旧密码校验',
      },
    }),
  })

  sendSuccess(res, null, '密码修改成功，请重新登录')
}

/**
 * 管理员下架产品
 * 将产品状态置为 admin_offline，记录下架理由与时间，并写入操作日志
 */
export const adminOfflineProduct = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string
  try {
    const reason = String(req.body?.reason || '').trim()
    if (!reason) {
      return sendError(res, '请输入下架理由', 400)
    }

    const product = await queryOne<{ id: string; title: string; status: string }>(
      'SELECT id, title, status FROM products WHERE id = ?',
      [id]
    )
    if (!product) {
      return sendError(res, '产品不存在', 404)
    }
    if (product.status === 'admin_offline') {
      return sendError(res, '该产品已被下架', 400)
    }

    await updateProduct(id, {
      status: 'admin_offline',
      offlineReason: reason,
      offlineAt: new Date().toISOString(),
    })

    // 清除产品相关缓存，保证用户端/经理端列表立即生效
    try {
      const cache = getCacheService()
      await cache.delete(CacheKeys.PRODUCT_DETAIL(id))
      await cache.deletePattern('product:list:*')
    } catch (cacheError) {
      logger.warn('[管理员下架产品] 缓存清理失败:', { error: getErrorMessage(cacheError) })
    }

    // 记录操作日志（写入失败由 logAdminOperation 兜底，不影响已成功的下架操作）
    const beforeStatusLabel = productStatusLabel(product.status)
    await logAdminOperation(req, {
      operationType: 'offline',
      targetType: 'product',
      targetId: id,
      targetName: product.title,
      reason,
      detail: buildAuditDetail({
        summary: `产品「${product.title}」下架：${beforeStatusLabel} → 已被管理员下架`,
        meta: {
          产品ID: id,
          下架理由: reason,
        },
        changes: [
          { field: 'status', label: '状态', from: beforeStatusLabel, to: '已被管理员下架' },
        ],
      }),
    })

    sendSuccess(res, null, '已下架')
  } catch (error) {
    logger.error('[管理员下架产品] 错误:', { productId: id, error: getErrorMessage(error) })
    sendError(res, getErrorMessage(error, '下架失败'), 500)
  }
}

// 仪表盘统计行：SQL 聚合列（COUNT/SUM）在 mysql2 中可能返回 string | number
type AdminStatsRow = {
  managerCount?: number | string
  userCount?: number | string
  publishedProductCount?: number | string
  totalCommission?: number | string
}

/**
 * 获取管理员仪表盘统计数据
 */
export const getAdminStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const sql = `
      SELECT
        (SELECT COUNT(*) FROM managers WHERE status = 'active') as managerCount,
        (SELECT COUNT(*) FROM users WHERE status = 'active') as userCount,
        (SELECT COUNT(*) FROM products WHERE status = 'published') as publishedProductCount,
        (SELECT COALESCE(SUM(amount), 0) FROM commissions WHERE status = 'paid') as totalCommission
    `
    const result = await queryOne<AdminStatsRow>(sql)

    sendSuccess(res, {
      managerCount: Number(result?.managerCount) || 0,
      userCount: Number(result?.userCount) || 0,
      publishedProductCount: Number(result?.publishedProductCount) || 0,
      totalCommission: Math.round((Number(result?.totalCommission) || 0) * 100) / 100,
    })
  } catch (error) {
    logger.error('[管理员统计] 错误:', { error: getErrorMessage(error) })
    // 统计失败必须显式返回错误，避免前端把 0 误认为真实业务数据
    sendError(res, '获取统计数据失败，请稍后重试', 500)
  }
}

/**
 * 获取操作日志列表
 */
export const getOperationLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parsePage(req.query.page)
    const pageSize = parsePageSize(req.query.pageSize)
    // 列表与导出共用同一套筛选解析，保证导出结果与页面一致
    const filters = parseOperationLogFilters(req.query)

    const result = await readOperationLogs({
      ...filters,
      page,
      pageSize,
    })

    sendSuccess(res, result)
  } catch (error) {
    logger.error('[获取操作日志] 错误:', { error: getErrorMessage(error) })
    sendError(res, getErrorMessage(error, '获取失败'), 500)
  }
}

/**
 * 获取操作日志的操作人筛选项
 * 只返回日志中实际出现过的管理员，不作为管理员名单泄露入口
 */
export const getOperationLogAdmins = async (_req: Request, res: Response): Promise<void> => {
  try {
    const admins = await readOperationLogAdmins()
    sendSuccess(res, admins)
  } catch (error) {
    logger.error('[获取操作人选项] 错误:', { error: getErrorMessage(error) })
    sendError(res, getErrorMessage(error, '获取失败'), 500)
  }
}
