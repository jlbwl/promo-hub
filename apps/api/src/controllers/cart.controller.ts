import logger from '../utils/logger.js'
import { Request, Response } from 'express'
import { getErrorMessage, type CartItem } from '@promo/shared'
import { sendSuccess, sendError } from '../utils/response.js'
import {
  readCartItems,
  readCartItem,
  readCartByManagerId,
  readUser,
  readManager,
  addToCart,
  removeFromCart,
  removeCartItems,
  isInCart,
} from '../data/index.js'

// H15：生产环境禁止把数据库失败静默降级为内存/本地文件
const allowMemoryFallback = process.env.NODE_ENV !== 'production'

/**
 * 购物车身份解析：
 * - user 角色：强制使用会话身份（防传他人 userId 越权）
 * - employee 角色：仅允许访问其主账户（req.user.userId）的购物车，忽略请求传入值
 * - manager 角色：仅允许访问本团队用户；跨团队返回空，按参数缺失处理
 */
async function resolveCartUserId(req: Request, requested: unknown): Promise<string> {
  if (req.user?.role === 'employee') {
    return req.user.userId || ''
  }
  if (req.user?.role === 'user') return req.user.id
  if (req.user?.role === 'manager') {
    const target = requested as string
    if (!target) return ''
    // M11：经理只能读取本团队用户的购物车
    const [manager, targetUser] = await Promise.all([
      readManager(req.user.id),
      readUser(target),
    ])
    if (!manager || !targetUser) return ''
    return targetUser.teamName === manager.teamName ? target : ''
  }
  return requested as string
}

/**
 * 获取购物车列表
 * 查询指定用户的购物车项目列表
 * @param req - HTTP请求对象，包含用户ID（req.query.userId）
 * @param res - HTTP响应对象
 * @returns 购物车项目列表
 */
export const getCartItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = await resolveCartUserId(req, req.query.userId)
    if (!userId) {
      return sendError(res, '缺少用户ID', 400)
    }

    let items: CartItem[] = []
    try {
      items = await readCartItems(userId as string)
    } catch (dbError) {
      if (!allowMemoryFallback) throw dbError
      logger.warn('[获取购物车] 数据库查询失败，尝试降级到内存存储:', { error: getErrorMessage(dbError) })
      const { readCartItems: memReadCart } = await import('../data-memory.js')
      items = await memReadCart(userId as string)
    }
    sendSuccess(res, items)
  } catch (error) {
    logger.error('[获取购物车] 最终错误:', { error: getErrorMessage(error) })
    if (!allowMemoryFallback) {
      sendError(res, '获取购物车失败', 500, 500)
      return
    }
    sendSuccess(res, [])
  }
}

/**
 * 获取经理下所有购物车
 * 查询指定经理下所有主账户的购物车项目
 * @param req - HTTP请求对象，包含经理ID（req.query.managerId）
 * @param res - HTTP响应对象
 * @returns 购物车项目列表
 */
export const getManagerCart = async (req: Request, res: Response): Promise<void> => {
  try {
    // M11：经理只能查看自己的购物车汇总，忽略前端传入的 managerId；管理员仍可指定
    const managerId = req.user?.role === 'manager' ? req.user.id : req.query.managerId
    if (!managerId) {
      return sendError(res, '缺少经理ID', 400)
    }

    let items: CartItem[] = []
    try {
      items = await readCartByManagerId(managerId as string)
    } catch (dbError) {
      if (!allowMemoryFallback) throw dbError
      logger.warn('[获取经理购物车] 数据库查询失败，尝试降级到内存存储:', { error: getErrorMessage(dbError) })
      const { readCartByManagerId: memReadCart } = await import('../data-memory.js')
      items = await memReadCart(managerId as string)
    }
    sendSuccess(res, items)
  } catch (error) {
    logger.error('[获取经理购物车] 最终错误:', { error: getErrorMessage(error) })
    if (!allowMemoryFallback) {
      sendError(res, '获取购物车失败', 500, 500)
      return
    }
    sendSuccess(res, [])
  }
}

/**
 * 添加到购物车
 * 检查产品是否已在购物车中，将产品添加到购物车
 * @param req - HTTP请求对象，包含用户ID、产品ID、产品信息等
 * @param res - HTTP响应对象
 * @returns 添加结果
 */
export const addItemToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { managerId, productId, productName, productPrice, coverImage, optionLabel, redirectUrl } = req.body
    const userId = await resolveCartUserId(req, req.body.userId)
    if (!userId || !productId) {
      return sendError(res, '缺少必要参数', 400)
    }

    try {
      const exists = await isInCart(userId, productId)
      if (exists) {
        return sendError(res, '该产品已在购物车中', 400)
      }
      await addToCart({ userId, managerId, productId, productName, productPrice, coverImage, optionLabel, redirectUrl })
    } catch (dbError) {
      if (!allowMemoryFallback) throw dbError
      logger.warn('[添加购物车] 数据库失败，尝试降级到内存:', { error: getErrorMessage(dbError) })
      const { isInCart: memIsInCart, addToCart: memAddToCart } = await import('../data-memory.js')
      const exists = await memIsInCart(userId, productId)
      if (exists) {
        return sendError(res, '该产品已在购物车中', 400)
      }
      await memAddToCart({ userId, managerId, productId, productName, productPrice, coverImage, optionLabel, redirectUrl })
    }
    sendSuccess(res, null, '添加成功')
  } catch (error) {
    logger.error('[添加购物车] 最终错误:', { error: getErrorMessage(error) })
    sendError(res, getErrorMessage(error, '添加失败'), 500)
  }
}

/**
 * 从购物车移除
 */
export const removeItemFromCart = async (req: Request, res: Response): Promise<void> => {
  try {
    // 子账户为只读角色，不允许移除收藏
    if (req.user?.role === 'employee') {
      return sendError(res, '子账户为只读角色，不能移除收藏', 403, 403)
    }

    const id = req.params.id as string

    // user 角色仅可移除自己名下的收藏条目
    if (req.user?.role === 'user') {
      const item = await readCartItem(id)
      if (!item || item.userId !== req.user.id) {
        return sendError(res, '条目不存在', 404)
      }
    }

    try {
      await removeFromCart(id)
    } catch (dbError) {
      logger.warn('[移除购物车] 数据库失败，尝试降级到内存:', { error: getErrorMessage(dbError) })
      const { removeFromCart: memRemoveFromCart } = await import('../data-memory.js')
      await memRemoveFromCart(id)
    }
    sendSuccess(res, null, '移除成功')
  } catch (error) {
    logger.error('[移除购物车] 最终错误:', { error: getErrorMessage(error) })
    sendError(res, getErrorMessage(error, '移除失败'), 500)
  }
}

/**
 * 批量移除收藏
 * 仅主账户可用；子账户为只读角色，直接拒绝
 */
export const removeItemsFromCart = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user?.role === 'employee') {
      return sendError(res, '子账户为只读角色，不能移除收藏', 403, 403)
    }

    const rawIds = (req.body as { ids?: unknown })?.ids
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return sendError(res, '缺少必要参数', 400)
    }
    const ids = Array.from(new Set(rawIds.filter((id): id is string => typeof id === 'string' && id.length > 0)))

    const userId = req.user?.role === 'user'
      ? req.user.id
      : (req.body as { userId?: string })?.userId
    if (!userId || ids.length === 0) {
      return sendError(res, '缺少必要参数', 400)
    }

    try {
      await removeCartItems(userId, ids)
    } catch (dbError) {
      if (!allowMemoryFallback) throw dbError
      logger.warn('[批量移除购物车] 数据库失败，尝试降级到内存:', { error: getErrorMessage(dbError) })
      const { removeCartItems: memRemoveCartItems } = await import('../data-memory.js')
      await memRemoveCartItems(userId, ids)
    }
    sendSuccess(res, { removed: ids.length }, '移除成功')
  } catch (error) {
    logger.error('[批量移除购物车] 最终错误:', { error: getErrorMessage(error) })
    sendError(res, getErrorMessage(error, '移除失败'), 500)
  }
}

/**
 * 检查产品是否在购物车
 */
export const checkProductInCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.query
    const userId = await resolveCartUserId(req, req.query.userId)
    if (!userId || !productId) {
      return sendError(res, '缺少必要参数', 400)
    }

    let exists = false
    try {
      exists = await isInCart(userId as string, productId as string)
    } catch (dbError) {
      logger.warn('[检查购物车] 数据库失败，尝试降级到内存:', { error: getErrorMessage(dbError) })
      const { isInCart: memIsInCart } = await import('../data-memory.js')
      exists = await memIsInCart(userId as string, productId as string)
    }
    sendSuccess(res, { inCart: exists })
  } catch (error) {
    logger.error('[检查购物车] 最终错误:', { error: getErrorMessage(error) })
    sendSuccess(res, { inCart: false })
  }
}
