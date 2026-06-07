/**
 * ManagerService - 经理业务逻辑层
 * 负责处理渠道经理相关的所有业务逻辑，包括注册、登录、产品管理、订单审核等
 */
import bcrypt from 'bcryptjs'
import { injectable, inject } from 'tsyringe'
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
import { DatabaseService } from './DatabaseService.js'
import { ErrorCode, throwNotFound, throwBadRequest, throwForbidden, throwConflict, throwUnauthorized } from '@promo/shared'

const SALT_ROUNDS = 12

/**
 * 经理服务接口
 */
export interface ManagerService {
  /**
   * 获取经理列表
   */
  getManagers(): Promise<any[]>

  /**
   * 获取单个经理信息
   */
  getManagerById(managerId: string): Promise<any>

  /**
   * 创建经理
   */
  createManager(managerData: {
    teamName: string
    password: string
    phone?: string
    name?: string
  }): Promise<any>

  /**
   * 经理登录
   */
  login(teamName: string, password: string): Promise<any>

  /**
   * 更新经理信息
   */
  updateManager(managerId: string, updateData: any): Promise<any>

  /**
   * 删除经理
   */
  deleteManager(managerId: string): Promise<void>

  /**
   * 获取经理的产品列表
   */
  getManagerProducts(managerId: string): Promise<any[]>

  /**
   * 获取经理的订单统计
   */
  getManagerStats(managerId: string): Promise<any>
}

/**
 * 经理服务实现类（可注入版本）
 */
@injectable()
export class ManagerServiceImpl implements ManagerService {
  constructor(
    @inject(DatabaseService) private db: DatabaseService
  ) {}

  /**
   * 获取经理列表
   */
  async getManagers() {
    const managers = await this.db.readManagers()
    return managers.map((m: any) => {
      const { password: _, ...safeManager } = m
      return safeManager
    })
  }

  /**
   * 获取单个经理信息
   */
  async getManagerById(managerId) {
    const managers = await this.db.readManagers()
    const manager = managers.find((m: any) => m.id === managerId)

    if (!manager) {
      throwNotFound('经理不存在')
    }

    const { password: _, ...safeManager } = manager
    return safeManager
  }

  /**
   * 创建经理
   */
  async createManager(managerData) {
    const { teamName, password, phone, name } = managerData

    if (!teamName || !password) {
      throwBadRequest('渠道名称和密码不能为空')
    }

    const managers = await this.db.readManagers()

    if (managers.find((m: any) => m.teamName === teamName)) {
      throwConflict('该渠道名称已存在')
    }

    try {
      const { readUsers } = await import('../data.js')
      const users = await readUsers()
      if (users.find((u: any) => u.teamName === teamName)) {
        throwConflict('该团队名称已存在')
      }
    } catch {
    }

    const now = new Date().toISOString()
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)
    const manager = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      username: teamName,
      password: hashedPassword,
      name: name || teamName,
      teamName,
      phone: phone || '',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }
    await insertManager(manager)

    const { password: _, ...safeManager } = manager
    return safeManager
  }

  /**
   * 经理登录
   */
  async login(teamName, password) {
    const managers = await this.db.readManagers()
    const manager = managers.find(
      (m: any) => m.teamName === teamName && m.status === 'active'
    )

    if (!manager) {
      throwUnauthorized('渠道名称或密码错误')
    }

    const passwordValid = await bcrypt.compare(password, manager.password)
    if (!passwordValid) {
      throwUnauthorized('渠道名称或密码错误')
    }

    const { password: _, ...safeManager } = manager
    return safeManager
  }

  /**
   * 更新经理信息
   */
  async updateManager(managerId, updateData) {
    const managers = await this.db.readManagers()
    const index = managers.findIndex((m: any) => m.id === managerId)

    if (index === -1) {
      throwNotFound('经理不存在')
    }

    if (updateData.teamName) {
      const existing = managers.find((m: any) => m.teamName === updateData.teamName && m.id !== managerId)
      if (existing) {
        throwConflict('该渠道名称已存在')
      }
    }

    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, SALT_ROUNDS)
    }

    await updateManager(managerId, updateData)
    return await this.getManagerById(managerId)
  }

  /**
   * 删除经理
   */
  async deleteManager(managerId) {
    const managers = await this.db.readManagers()
    const manager = managers.find((m: any) => m.id === managerId)

    if (!manager) {
      throwNotFound('经理不存在')
    }

    await deleteManager(managerId)
    console.log('[ManagerService] 删除经理:', managerId)
  }

  /**
   * 获取经理的产品列表
   */
  async getManagerProducts(managerId) {
    const products = await this.db.readProducts()
    return products.filter((p: any) => p.managerId === managerId)
  }

  /**
   * 获取经理的订单统计
   */
  async getManagerStats(managerId) {
    const orders = await this.db.readOrders()
    const managerOrders = orders.filter((o: any) => o.managerId === managerId)

    return {
      total: managerOrders.length,
      pending: managerOrders.filter((o: any) => o.status === 'pending').length,
      approved: managerOrders.filter((o: any) => o.status === 'approved').length,
      pendingPayment: managerOrders.filter((o: any) => o.status === 'pending_payment').length,
      settled: managerOrders.filter((o: any) => o.status === 'settled').length,
      rejected: managerOrders.filter((o: any) => o.status === 'rejected').length,
    }
  }
}

/**
 * 经理服务实现
 */
export const managerService: ManagerService = {
  /**
   * 获取经理列表
   * 返回所有渠道经理的基本信息（不包含密码）
   * @returns 经理列表
   */
  async getManagers() {
    const managers = await readManagers()
    // 返回不包含密码的经理信息
    return managers.map((m: any) => {
      const { password: _, ...safeManager } = m
      return safeManager
    })
  },

  /**
   * 获取单个经理信息
   * 根据经理ID查询详细信息（不包含密码）
   * @param managerId - 经理ID
   * @returns 经理详细信息
   * @throws 经理不存在时抛出错误
   */
  async getManagerById(managerId) {
    const managers = await readManagers()
    const manager = managers.find((m: any) => m.id === managerId)

    if (!manager) {
      throwNotFound('经理不存在')
    }

    const { password: _, ...safeManager } = manager
    return safeManager
  },

  /**
   * 创建经理
   * 验证渠道名称唯一性，加密密码，保存经理信息
   * @param managerData - 经理数据
   * @returns 新创建的经理信息
   * @throws 渠道名称为空、已存在、团队名称已被用户使用时抛出错误
   */
  async createManager(managerData) {
    const { teamName, password, phone, name } = managerData

    // 验证必填字段
    if (!teamName || !password) {
      throwBadRequest('渠道名称和密码不能为空')
    }

    const managers = await readManagers()

    // 检查渠道名称唯一性
    if (managers.find((m: any) => m.teamName === teamName)) {
      throwConflict('该渠道名称已存在')
    }

    // 检查团队名称是否已被用户使用
    try {
      const { readUsers } = await import('../data.js')
      const users = await readUsers()
      if (users.find((u: any) => u.teamName === teamName)) {
        throwConflict('该团队名称已存在')
      }
    } catch {
      // 如果无法导入用户模块，忽略检查
    }

    // 创建经理
    const now = new Date().toISOString()
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)
    const manager = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      username: teamName,
      password: hashedPassword,
      name: name || teamName,
      teamName,
      phone: phone || '',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }
    await insertManager(manager)

    const { password: _, ...safeManager } = manager
    return safeManager
  },

  /**
   * 经理登录
   * 验证渠道名称和密码
   * @param teamName - 渠道名称
   * @param password - 密码
   * @returns 登录经理信息（不包含密码）
   * @throws 渠道名称或密码错误时抛出错误
   */
  async login(teamName, password) {
    const managers = await readManagers()
    const manager = managers.find(
      (m: any) => m.teamName === teamName && m.status === 'active'
    )

    if (!manager) {
      throwUnauthorized('渠道名称或密码错误')
    }

    // 验证密码
    const passwordValid = await bcrypt.compare(password, manager.password)
    if (!passwordValid) {
      throwUnauthorized('渠道名称或密码错误')
    }

    const { password: _, ...safeManager } = manager
    return safeManager
  },

  /**
   * 更新经理信息
   * @param managerId - 经理ID
   * @param updateData - 更新数据
   * @returns 更新后的经理信息
   * @throws 经理不存在时抛出错误
   */
  async updateManager(managerId, updateData) {
    const managers = await readManagers()
    const index = managers.findIndex((m: any) => m.id === managerId)

    if (index === -1) {
      throwNotFound('经理不存在')
    }

    // 如果更新了渠道名称，检查唯一性
    if (updateData.teamName) {
      const existing = managers.find((m: any) => m.teamName === updateData.teamName && m.id !== managerId)
      if (existing) {
        throwConflict('该渠道名称已存在')
      }
    }

    // 如果更新了密码，进行加密
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, SALT_ROUNDS)
    }

    // 更新经理
    await updateManager(managerId, updateData)

    const updated = await this.getManagerById(managerId)
    return updated
  },

  /**
   * 删除经理
   * @param managerId - 经理ID
   * @throws 经理不存在时抛出错误
   */
  async deleteManager(managerId) {
    const managers = await readManagers()
    const manager = managers.find((m: any) => m.id === managerId)

    if (!manager) {
      throwNotFound('经理不存在')
    }

    await deleteManager(managerId)
    console.log('[ManagerService] 删除经理:', managerId)
  },

  /**
   * 获取经理的产品列表
   * @param managerId - 经理ID
   * @returns 该经理创建的产品列表
   */
  async getManagerProducts(managerId) {
    const products = await readProducts()
    return products.filter((p: any) => p.managerId === managerId)
  },

  /**
   * 获取经理的订单统计
   * @param managerId - 经理ID
   * @returns 订单统计数据
   */
  async getManagerStats(managerId) {
    const orders = await readOrders()
    const managerOrders = orders.filter((o: any) => o.managerId === managerId)

    return {
      total: managerOrders.length,
      pending: managerOrders.filter((o: any) => o.status === 'pending').length,
      approved: managerOrders.filter((o: any) => o.status === 'approved').length,
      pendingPayment: managerOrders.filter((o: any) => o.status === 'pending_payment').length,
      settled: managerOrders.filter((o: any) => o.status === 'settled').length,
      rejected: managerOrders.filter((o: any) => o.status === 'rejected').length,
    }
  },
}
