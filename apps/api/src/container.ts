/**
 * DI 容器配置文件
 * 
 * 完整的依赖注入容器配置，支持：
 * - 基础设施层服务（Config、Database、Cache）
 * - 业务服务层（User、Product、Order、Manager Service）
 * - DDD 仓储层（Repository Pattern）
 * - 应用层处理器（Command/Query Handlers）
 * 
 * @module container
 */

import 'reflect-metadata'
import { container } from 'tsyringe'

// ============================================
// 基础设施层 (Infrastructure Layer)
// ============================================

// 配置服务 - 读取环境变量
import { ConfigService } from './services/ConfigService.js'
container.registerSingleton('ConfigService', ConfigService)

// 数据库服务 - MySQL 数据访问
import { DatabaseService } from './services/DatabaseService.js'
container.registerSingleton(DatabaseService, DatabaseService)

// 缓存服务 - Redis 缓存管理
import { CacheService } from './services/cache/index.js'
container.registerSingleton(CacheService, CacheService)

// ============================================
// 业务服务层 (Service Layer)
// ============================================

// 用户服务
import { UserServiceImpl } from './services/UserService.js'
container.registerSingleton('UserService', UserServiceImpl)

// 产品服务
import { ProductServiceImpl } from './services/ProductService.js'
container.registerSingleton('ProductService', ProductServiceImpl)

// 订单服务
import { OrderServiceImpl } from './services/OrderService.js'
container.registerSingleton('OrderService', OrderServiceImpl)

// 经理服务
import { ManagerServiceImpl } from './services/ManagerService.js'
container.registerSingleton('ManagerService', ManagerServiceImpl)

// ============================================
// 导出容器访问方法
// ============================================

/**
 * 从容器中解析服务实例
 * @param token 服务标识符（类构造函数、字符串名称或 Symbol）
 * @returns 服务实例
 * 
 * @example
 * // 解析配置服务
 * const config = resolve<ConfigService>('ConfigService')
 * 
 * // 解析用户服务
 * const userService = resolve<UserService>('UserService')
 * 
 * // 解析仓储
 * const userRepo = resolve<IUserRepository>('IUserRepository')
 */
export function resolve<T>(token: any): T {
  return container.resolve<T>(token)
}

/**
 * 检查服务是否已注册
 * @param token 服务标识符
 * @returns 是否已注册
 */
export function isRegistered(token: any): boolean {
  return container.isRegistered(token)
}

/**
 * 清除容器（主要用于测试）
 */
export function clearContainer(): void {
  container.clearInstances()
}

// 导出容器实例供高级用法
export { container }
