/**
 * DI 容器配置文件
 * 提供依赖注入容器的初始化和访问功能
 */
import { container } from 'tsyringe'
import { ConfigService } from './services/ConfigService.js'
import { DatabaseService } from './services/DatabaseService.js'
import { UserServiceImpl } from './services/UserService.js'
import { ProductServiceImpl } from './services/ProductService.js'
import { OrderServiceImpl } from './services/OrderService.js'
import { ManagerServiceImpl } from './services/ManagerService.js'
import { CacheService } from './services/cache/index.js'

// 单例标志，防止重复初始化
let isInitialized = false

/**
 * 初始化 DI 容器
 * 注册所有服务到容器中
 */
export function initContainer(): void {
  if (isInitialized) {
    return
  }

  // 注册基础设施服务（单例）
  container.registerSingleton('ConfigService', ConfigService)
  container.registerSingleton(DatabaseService, DatabaseService)
  container.registerSingleton(CacheService, CacheService)

  // 注册业务服务（单例）- 旧版 Service 层（向后兼容）
  container.registerSingleton('UserService', UserServiceImpl)
  container.registerSingleton('ProductService', ProductServiceImpl)
  container.registerSingleton('OrderService', OrderServiceImpl)
  container.registerSingleton('ManagerService', ManagerServiceImpl)

  isInitialized = true
}

/**
 * 获取 DI 容器
 * @returns tsyringe 容器实例
 */
export function getContainer() {
  if (!isInitialized) {
    initContainer()
  }
  return container
}

/**
 * 从容器中解析服务
 * @param token 服务标识符（类、字符串或 Symbol）
 * @returns 服务实例
 */
export function resolve<T>(token: any): T {
  return getContainer().resolve<T>(token)
}
