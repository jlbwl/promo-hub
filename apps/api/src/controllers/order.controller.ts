import { Request, Response } from 'express'
import { sendSuccess, sendError, sendPagination } from '../utils/response.js'
import {
  readProducts,
  readProduct,
  updateProduct,
  readUsers,
  readEmployeeById,
  readUser,
  readOrders,
  insertOrder,
  deleteOrder,
  readOrder,
  readDeletedOrders,
  restoreOrder,
  updateOrder,
  insertOperationLog,
} from '../data.js'

/**
 * 做单（创建订单）
 */
export const createOrder = async (req: Request, res: Response): Promise<void> => {
  console.log('[做单] 收到请求:', JSON.stringify(req.body))
  try {
    const { productId, userId, employeeId, optionLabel, redirectUrl, userName, userPhone } = req.body
    if (!productId) {
      console.log('[做单] 缺少productId')
      return sendError(res, '缺少产品ID', 400)
    }

    const products = await readProducts()
    const index = products.findIndex((p: any) => p.id === productId)
    if (index === -1) {
      console.log('[做单] 产品不存在:', productId)
      return sendError(res, '产品不存在', 404)
    }

    const product = products[index]
    console.log('[做单] 产品信息:', { title: product.title, options: product.options, managerId: product.managerId })

    if (product.status !== 'published') {
      console.log('[做单] 产品未发布:', product.status)
      return sendError(res, '该产品已下架', 400)
    }

    if (product.stock && product.stock > 0) {
      if (product.stock < 1) {
        console.log('[做单] 库存不足')
        return sendError(res, '库存不足', 400)
      }
      console.log('[做单] 扣减库存, 原库存:', product.stock, '新库存:', product.stock - 1)
      await updateProduct(product.id, { stock: product.stock - 1, updatedAt: new Date().toISOString() })
    }

    let finalUserId = userId || 'guest'
    if (employeeId) {
      console.log('[做单] 员工做单, employeeId:', employeeId)
      const employee = await readEmployeeById(employeeId)
      if (employee) {
        finalUserId = employee.userId
        console.log('[做单] 员工主账户ID:', finalUserId)
      }
    }

    let teamName = ''
    if (finalUserId !== 'guest') {
      const user = await readUser(finalUserId)
      if (user) {
        teamName = user.teamName || ''
      }
    }

    const cleanRedirectUrl = (redirectUrl || '').replace(/`/g, '')
    console.log('[做单] 原始redirectUrl:', redirectUrl, '清理后:', cleanRedirectUrl)

    const order = {
      id: `o_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      productId,
      userId: finalUserId,
      managerId: product.managerId,
      productName: product.title,
      productPrice: product.price,
      optionLabel: optionLabel || '',
      redirectUrl: cleanRedirectUrl,
      userName: userName || '',
      userPhone: userPhone || '',
      teamName,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    console.log('[做单] 创建订单:', JSON.stringify(order))
    await insertOrder(order)
    console.log('[做单] 订单已保存成功, ID:', order.id)

    const remainingStock = product.stock && product.stock > 0 ? product.stock - 1 : (product.stock || -1)
    console.log('[做单] 返回成功响应')
    sendSuccess(res, { order, remainingStock }, '做单成功')
  } catch (error: any) {
    console.error('[做单] 错误:', error)
    sendError(res, error.message || '做单失败', 500)
  }
}

/**
 * 获取订单列表
 */
export const getOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, managerId, status, page = '1', pageSize = '20' } = req.query
    let orders = await readOrders()

    if (userId) {
      orders = orders.filter((o: any) => o.userId === userId)
    }
    if (managerId) {
      orders = orders.filter((o: any) => o.managerId === managerId)
    }
    if (status) {
      orders = orders.filter((o: any) => o.status === status)
    }
    if (req.query.managedBy) {
      orders = orders.filter((o: any) => o.managedBy === req.query.managedBy)
    }

    orders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const users = await readUsers()

    const total = orders.length
    const pageNum = parseInt(page as string, 10)
    const pageSizeNum = parseInt(pageSize as string, 10)
    const start = (pageNum - 1) * pageSizeNum
    const list = orders.slice(start, start + pageSizeNum).map(order => {
      let currentTeamName = order.teamName || ''
      if (order.userId && order.userId !== 'guest') {
        const user = users.find((u: any) => u.id === order.userId)
        if (user && user.teamName) {
          currentTeamName = user.teamName
        }
      }
      return {
        ...order,
        teamName: currentTeamName
      }
    })

    sendPagination(res, list, total, pageNum, pageSizeNum)
  } catch (error: any) {
    sendError(res, error.message || '获取失败', 500)
  }
}

/**
 * 管理后台删除订单
 */
export const adminDeleteOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = req.params.id as string
    const { reason, adminId, adminPhone, adminName } = req.body

    const order = await readOrder(orderId)
    if (!order) {
      return sendError(res, '订单不存在', 404)
    }

    await deleteOrder(orderId)

    await insertOperationLog({
      adminId: adminId || '',
      adminPhone: adminPhone || '',
      adminName: adminName || '未知管理员',
      operationType: 'delete',
      targetType: 'order',
      targetId: orderId,
      targetName: order.productName || '订单',
      reason: reason || '',
      detail: JSON.stringify(order),
    })

    sendSuccess(res, null, '删除成功')
  } catch (error: any) {
    console.error('[订单删除] 错误:', error)
    sendError(res, error.message || '删除失败', 500)
  }
}

/**
 * 用户端删除订单（软删除）
 */
export const deleteUserOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string
    const { userId } = req.body

    const order = await readOrder(id)
    if (!order) {
      return sendError(res, '订单不存在', 404)
    }

    if (order.userId !== userId) {
      return sendError(res, '无权操作此订单', 403)
    }

    await deleteOrder(id)

    sendSuccess(res, null, '已移至回收站')
  } catch (error: any) {
    console.error('[用户删除订单] 错误:', error)
    sendError(res, error.message || '删除失败', 500)
  }
}

/**
 * 获取用户已删除的订单（回收站）
 */
export const getDeletedOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.query
    const orders = await readDeletedOrders(userId as string)
    sendSuccess(res, orders)
  } catch (error: any) {
    console.error('[获取已删除订单] 错误:', error)
    sendError(res, error.message || '获取失败', 500)
  }
}

/**
 * 恢复订单（从回收站找回）
 */
export const restoreUserOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string
    const { userId } = req.body

    const orders = await readDeletedOrders(userId)
    const order = orders.find((o: any) => o.id === id)

    if (!order) {
      return sendError(res, '订单不存在或不在回收站', 404)
    }

    if (order.userId !== userId) {
      return sendError(res, '无权操作此订单', 403)
    }

    await restoreOrder(id)

    sendSuccess(res, null, '恢复成功')
  } catch (error: any) {
    console.error('[恢复订单] 错误:', error)
    sendError(res, error.message || '恢复失败', 500)
  }
}

/**
 * 提交资金号
 */
export const submitFundAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, orderId, fundAccount } = req.body

    if (!userId || !orderId || !fundAccount) {
      return sendError(res, '缺少必要参数', 400)
    }

    const order = await readOrder(orderId)
    if (!order) {
      return sendError(res, '订单不存在', 404)
    }

    if (order.userId !== userId) {
      return sendError(res, '无权操作此订单', 403)
    }

    await updateOrder(orderId, { fundAccount })

    sendSuccess(res, null, '提交成功')
  } catch (error: any) {
    console.error('[提交资金号] 错误:', error)
    sendError(res, error.message || '提交失败', 500)
  }
}
