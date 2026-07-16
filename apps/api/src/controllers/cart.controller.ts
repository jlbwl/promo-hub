import { Request, Response } from 'express'
import { sendSuccess, sendError } from '../utils/response.js'
import {
  readCartItems,
  readCartByManagerId,
  addToCart,
  removeFromCart,
  isInCart,
} from '../data/index.js'

/**
 * 获取购物车列表
 * 查询指定用户的购物车项目列表
 * @param req - HTTP请求对象，包含用户ID（req.query.userId）
 * @param res - HTTP响应对象
 * @returns 购物车项目列表
 */
export const getCartItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.query
    if (!userId) {
      return sendError(res, '缺少用户ID', 400)
    }

    let items: any[] = []
    try {
      items = await readCartItems(userId as string)
    } catch (dbError: any) {
      console.warn('[获取购物车] 数据库查询失败，尝试降级到内存存储:', dbError)
      const { readCartItems: memReadCart } = await import('../data-memory.js')
      items = await memReadCart(userId as string)
    }
    sendSuccess(res, items)
  } catch (error: any) {
    console.error('[获取购物车] 最终错误:', error)
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

    let items: any[] = []
    try {
      items = await readCartByManagerId(managerId as string)
    } catch (dbError: any) {
      console.warn('[获取经理购物车] 数据库查询失败，尝试降级到内存存储:', dbError)
      const { readCartByManagerId: memReadCart } = await import('../data-memory.js')
      items = await memReadCart(managerId as string)
    }
    sendSuccess(res, items)
  } catch (error: any) {
    console.error('[获取经理购物车] 最终错误:', error)
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
    const { userId, managerId, productId, productName, productPrice, coverImage, optionLabel, redirectUrl } = req.body
    if (!userId || !productId) {
      return sendError(res, '缺少必要参数', 400)
    }

    try {
      const exists = await isInCart(userId, productId)
      if (exists) {
        return sendError(res, '该产品已在购物车中', 400)
      }
      await addToCart({ userId, managerId, productId, productName, productPrice, coverImage, optionLabel, redirectUrl })
    } catch (dbError: any) {
      console.warn('[添加购物车] 数据库失败，尝试降级到内存:', dbError)
      const { isInCart: memIsInCart, addToCart: memAddToCart } = await import('../data-memory.js')
      const exists = await memIsInCart(userId, productId)
      if (exists) {
        return sendError(res, '该产品已在购物车中', 400)
      }
      await memAddToCart({ userId, managerId, productId, productName, productPrice, coverImage, optionLabel, redirectUrl })
    }
    sendSuccess(res, null, '添加成功')
  } catch (error: any) {
    console.error('[添加购物车] 最终错误:', error)
    sendError(res, error.message || '添加失败', 500)
  }
}

/**
 * 从购物车移除
 */
export const removeItemFromCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string

    try {
      await removeFromCart(id)
    } catch (dbError: any) {
      console.warn('[移除购物车] 数据库失败，尝试降级到内存:', dbError)
      const { removeFromCart: memRemoveFromCart } = await import('../data-memory.js')
      await memRemoveFromCart(id)
    }
    sendSuccess(res, null, '移除成功')
  } catch (error: any) {
    console.error('[移除购物车] 最终错误:', error)
    sendError(res, error.message || '移除失败', 500)
  }
}

/**
 * 检查产品是否在购物车
 */
export const checkProductInCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, productId } = req.query
    if (!userId || !productId) {
      return sendError(res, '缺少必要参数', 400)
    }

    let exists = false
    try {
      exists = await isInCart(userId as string, productId as string)
    } catch (dbError: any) {
      console.warn('[检查购物车] 数据库失败，尝试降级到内存:', dbError)
      const { isInCart: memIsInCart } = await import('../data-memory.js')
      exists = await memIsInCart(userId as string, productId as string)
    }
    sendSuccess(res, { inCart: exists })
  } catch (error: any) {
    console.error('[检查购物车] 最终错误:', error)
    sendSuccess(res, { inCart: false })
  }
}
