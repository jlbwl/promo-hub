import logger from '../utils/logger.js'
import { Request, Response } from 'express'
import { getErrorMessage, type CartItem } from '@promo/shared'
import { sendSuccess, sendError } from '../utils/response.js'
import {
  readCartItems,
  readCartItem,
  readCartByManagerId,
  addToCart,
  removeFromCart,
  isInCart,
} from '../data/index.js'

/**
 * 购物车身份解析：user 角色强制使用会话身份（防传他人 userId 越权读写他人购物车），
 * employee 保持传入 userId（员工代主账户操作）
 */
function resolveCartUserId(req: Request, requested: unknown): string {
  if (req.user?.role === 'user') return req.user.id
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
    const userId = resolveCartUserId(req, req.query.userId)
    if (!userId) {
      return sendError(res, '缺少用户ID', 400)
    }

    let items: CartItem[] = []
    try {
      items = await readCartItems(userId as string)
    } catch (dbError) {
      logger.warn('[获取购物车] 数据库查询失败，尝试降级到内存存储:', { error: getErrorMessage(dbError) })
      const { readCartItems: memReadCart } = await import('../data-memory.js')
      items = await memReadCart(userId as string)
    }
    sendSuccess(res, items)
  } catch (error) {
    logger.error('[获取购物车] 最终错误:', { error: getErrorMessage(error) })
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
    const { managerId } = req.query
    if (!managerId) {
      return sendError(res, '缺少经理ID', 400)
    }

    let items: CartItem[] = []
    try {
      items = await readCartByManagerId(managerId as string)
    } catch (dbError) {
      logger.warn('[获取经理购物车] 数据库查询失败，尝试降级到内存存储:', { error: getErrorMessage(dbError) })
      const { readCartByManagerId: memReadCart } = await import('../data-memory.js')
      items = await memReadCart(managerId as string)
    }
    sendSuccess(res, items)
  } catch (error) {
    logger.error('[获取经理购物车] 最终错误:', { error: getErrorMessage(error) })
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
    const userId = resolveCartUserId(req, req.body.userId)
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
 * 检查产品是否在购物车
 */
export const checkProductInCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.query
    const userId = resolveCartUserId(req, req.query.userId)
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
