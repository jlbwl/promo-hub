/**
 * Services - 业务逻辑层
 * 统一导出所有Service模块
 */
export { productService, initializeCache, closeCache, type ProductService, ProductServiceImpl } from './ProductService.js'
export { orderService, type OrderService, OrderServiceImpl } from './OrderService.js'
export { userService, UserServiceImpl, type UserService } from './UserService.js'
export { managerService, type ManagerService, ManagerServiceImpl } from './ManagerService.js'
export { CacheService, CacheKeys, CacheTTL } from './cache/index.js'
export { ConfigService, type AppConfig } from './ConfigService.js'
export { DatabaseService } from './DatabaseService.js'

// 注意：DI 相关工具（resolve, initContainer）请从 ./container.js 导入
