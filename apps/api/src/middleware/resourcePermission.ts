import { Request, Response, NextFunction } from 'express'
import { queryOne } from '../data/index.js'
import logger from '../utils/logger.js'

// 资源类型定义
export type ResourceType = 'product' | 'manager' | 'user' | 'order' | 'category'

// 操作类型
export type ActionType = 'read' | 'create' | 'update' | 'delete' | 'list'

// 资源权限检查结果
export interface ResourcePermissionResult {
  hasPermission: boolean
  message?: string
  resourceOwnerId?: string
}

// 资源权限检查配置
export interface ResourcePermissionConfig {
  resourceType: ResourceType
  resourceIdParam?: string // URL参数中的资源ID字段名，如 'id'
  action: ActionType
  getOwnerId?: (resource: any) => string | null // 获取资源所有者ID的函数
  adminOverride?: boolean // 管理员是否可以跳过检查
  allowPublic?: boolean // 是否允许公开访问
}

/**
 * 资源级权限验证中间件
 * 验证当前用户是否有权限操作指定资源
 */
export const resourcePermission = (config: ResourcePermissionConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user
      
      if (!user) {
        res.status(401).json({
          code: 401,
          message: '未登录或会话已过期',
          data: null
        })
        return
      }

      // 管理员跳过权限检查（如果配置了）
      if (config.adminOverride && user.role === 'admin') {
        logger.info('[ResourcePermission] 管理员权限，跳过资源检查', {
          userId: user.id,
          role: user.role,
          resourceType: config.resourceType,
          action: config.action
        })
        next()
        return
      }

      // 获取资源ID
      const resourceId = config.resourceIdParam 
        ? (req.params as any)[config.resourceIdParam] 
        : (req.params as any).id
      
      // 如果是列表操作，直接跳过
      if (config.action === 'list') {
        next()
        return
      }
      
      // 其他操作需要资源ID
      if (!resourceId) {
        logger.warn('[ResourcePermission] 缺少资源ID', {
          userId: user.id,
          resourceType: config.resourceType,
          action: config.action
        })
        res.status(400).json({
          code: 400,
          message: '缺少资源ID参数',
          data: null
        })
        return
      }

      // 检查资源权限
      const result = await checkResourcePermission(user, resourceId, config)
      
      if (result.hasPermission) {
        // 将资源所有者ID附加到请求上，方便后续使用
        ;(req as any).resourceOwnerId = result.resourceOwnerId
        next()
      } else {
        logger.warn('[ResourcePermission] 资源权限验证失败', {
          userId: user.id,
          role: user.role,
          resourceType: config.resourceType,
          resourceId,
          action: config.action,
          reason: result.message
        })
        res.status(403).json({
          code: 403,
          message: result.message || '您没有权限操作此资源',
          data: null
        })
      }
    } catch (error: any) {
      logger.error('[ResourcePermission] 权限检查出错', {
        error: error.message,
        stack: error.stack
      })
      res.status(500).json({
        code: 500,
        message: '权限验证时出错',
        data: null
      })
    }
  }
}

/**
 * 检查用户是否有权限访问资源
 */
async function checkResourcePermission(
  user: any,
  resourceId: string,
  config: ResourcePermissionConfig
): Promise<ResourcePermissionResult> {
  // 管理员总是有权限
  if (user.role === 'admin') {
    return { hasPermission: true }
  }

  // 根据资源类型进行不同的权限检查
  switch (config.resourceType) {
    case 'product':
      return await checkProductPermission(user, resourceId, config.action)
    
    case 'manager':
      return await checkManagerPermission(user, resourceId, config.action)
    
    case 'user':
      return await checkUserPermission(user, resourceId, config.action)
    
    case 'order':
      return await checkOrderPermission(user, resourceId, config.action)
    
    case 'category':
      // 分类通常是公开的，只有管理员可以修改
      if (config.action === 'read' || config.action === 'list') {
        return { hasPermission: true }
      }
      return { hasPermission: user.role === 'admin', message: '只有管理员可以操作分类' }
    
    default:
      return { hasPermission: false, message: '未知的资源类型' }
  }
}

/**
 * 产品权限检查
 */
async function checkProductPermission(
  user: any,
  productId: string,
  action: ActionType
): Promise<ResourcePermissionResult> {
  if (!productId) {
    // 列表操作，manager只能看自己的，user可以看所有已发布的
    return { hasPermission: true }
  }

  // 获取产品信息
  const product = await queryOne('SELECT * FROM products WHERE id = ?', [productId])
  if (!product) {
    return { hasPermission: false, message: '产品不存在' }
  }

  // 读操作：manager可以看自己的，user可以看所有已发布的
  if (action === 'read') {
    if (user.role === 'manager' && product.managerId === user.id) {
      return { hasPermission: true, resourceOwnerId: product.managerId }
    }
    if (user.role === 'user' && product.status === 'published') {
      return { hasPermission: true, resourceOwnerId: product.managerId }
    }
    return { hasPermission: false, message: '您没有权限查看此产品' }
  }

  // 写操作：只有产品所有者（manager）可以操作
  if (user.role === 'manager' && product.managerId === user.id) {
    return { hasPermission: true, resourceOwnerId: product.managerId }
  }

  return { hasPermission: false, message: '您没有权限操作此产品' }
}

/**
 * 经理权限检查
 */
async function checkManagerPermission(
  user: any,
  managerId: string,
  action: ActionType
): Promise<ResourcePermissionResult> {
  // 只有管理员或经理自己可以操作
  if (user.role === 'admin') {
    return { hasPermission: true }
  }
  
  if (user.role === 'manager' && user.id === managerId) {
    return { hasPermission: true, resourceOwnerId: managerId }
  }

  return { hasPermission: false, message: '您没有权限操作此经理资源' }
}

/**
 * 用户权限检查
 */
async function checkUserPermission(
  user: any,
  userId: string,
  action: ActionType
): Promise<ResourcePermissionResult> {
  // 管理员可以操作所有用户
  if (user.role === 'admin') {
    return { hasPermission: true }
  }

  // 经理可以操作自己团队的用户
  if (user.role === 'manager') {
    const targetUser = await queryOne('SELECT * FROM users WHERE id = ?', [userId])
    if (targetUser && targetUser.teamName === user.teamName) {
      return { hasPermission: true, resourceOwnerId: user.id }
    }
    return { hasPermission: false, message: '您没有权限操作此用户' }
  }

  // 用户只能操作自己
  if (user.role === 'user' && user.id === userId) {
    return { hasPermission: true, resourceOwnerId: user.id }
  }

  return { hasPermission: false, message: '您没有权限操作此用户资源' }
}

/**
 * 订单权限检查
 */
async function checkOrderPermission(
  user: any,
  orderId: string,
  action: ActionType
): Promise<ResourcePermissionResult> {
  if (!orderId) {
    // 列表操作
    return { hasPermission: true }
  }

  const order = await queryOne('SELECT * FROM orders WHERE id = ?', [orderId])
  if (!order) {
    return { hasPermission: false, message: '订单不存在' }
  }

  // 管理员可以操作所有订单
  if (user.role === 'admin') {
    return { hasPermission: true }
  }

  // 经理可以操作自己团队的订单
  if (user.role === 'manager') {
    // 获取产品信息，检查是否属于该经理
    const product = await queryOne('SELECT managerId FROM products WHERE id = ?', [order.productId])
    if (product && product.managerId === user.id) {
      return { hasPermission: true, resourceOwnerId: user.id }
    }
    return { hasPermission: false, message: '您没有权限操作此订单' }
  }

  // 用户只能操作自己的订单
  if (user.role === 'user' && order.userId === user.id) {
    return { hasPermission: true, resourceOwnerId: user.id }
  }

  return { hasPermission: false, message: '您没有权限操作此订单' }
}

/**
 * 直接在服务层使用的资源权限检查函数
 * 不经过中间件时，可以在服务代码中直接调用
 */
export const ResourcePermissionChecker = {
  /**
   * 检查产品权限
   */
  async checkProduct(
    userId: string,
    userRole: string,
    productId: string,
    action: ActionType = 'read'
  ): Promise<{ allowed: boolean; message?: string; product?: any }> {
    if (userRole === 'admin') {
      return { allowed: true }
    }

    const product = await queryOne('SELECT * FROM products WHERE id = ?', [productId])
    if (!product) {
      return { allowed: false, message: '产品不存在' }
    }

    if (action === 'read') {
      if (userRole === 'manager' && product.managerId === userId) {
        return { allowed: true, product }
      }
      if (userRole === 'user' && product.status === 'published') {
        return { allowed: true, product }
      }
      return { allowed: false, message: '您没有权限查看此产品' }
    }

    // 写操作
    if (userRole === 'manager' && product.managerId === userId) {
      return { allowed: true, product }
    }

    return { allowed: false, message: '您没有权限操作此产品' }
  },

  /**
   * 检查用户权限
   */
  async checkUser(
    userId: string,
    userRole: string,
    targetUserId: string,
    action: ActionType = 'read'
  ): Promise<{ allowed: boolean; message?: string; user?: any }> {
    if (userRole === 'admin') {
      return { allowed: true }
    }

    if (userRole === 'manager') {
      const targetUser = await queryOne('SELECT * FROM users WHERE id = ?', [targetUserId])
      if (!targetUser) {
        return { allowed: false, message: '用户不存在' }
      }
      const manager = await queryOne('SELECT teamName FROM managers WHERE id = ?', [userId])
      if (manager && targetUser.teamName === manager.teamName) {
        return { allowed: true, user: targetUser }
      }
      return { allowed: false, message: '您没有权限操作此用户' }
    }

    if (userRole === 'user' && userId === targetUserId) {
      const targetUser = await queryOne('SELECT * FROM users WHERE id = ?', [targetUserId])
      return { allowed: true, user: targetUser }
    }

    return { allowed: false, message: '您没有权限操作此用户' }
  }
}
