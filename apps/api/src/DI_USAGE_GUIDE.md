# 依赖注入（DI）容器使用指南

## 📦 概述

本项目使用 **tsyringe** 实现依赖注入，采用 **Singleton** 模式管理所有服务实例，确保在整个应用生命周期内只创建一个实例。

## 🎯 核心特性

- ✅ **自动初始化**：容器在导入时自动注册所有服务
- ✅ **类型安全**：支持接口注入和类型提示
- ✅ **单例模式**：所有服务注册为单例，优化性能
- ✅ **DDD 支持**：完整的仓储层和应用层服务注入

---

## 🚀 快速开始

### 基本使用

```typescript
import { resolve } from './container.js'

// 解析服务实例
const userService = resolve('UserService')
const configService = resolve('ConfigService')
```

### 类型安全的使用方式

```typescript
import { resolve } from './container.js'
import type { UserService } from './services/UserService.js'

// 使用类型断言获得完整的类型提示
const userService = resolve<UserService>('UserService')
```

---

## 📋 已注册的服务

### 基础设施层（Infrastructure）

| 服务名称 | 实现类 | 说明 |
|---------|--------|------|
| `ConfigService` | `ConfigService` | 环境变量配置管理 |
| `DatabaseService` | `DatabaseService` | MySQL 数据库访问 |
| `CacheService` | `CacheService` | Redis 缓存管理 |

### 业务服务层（Service Layer）

| 服务名称 | 实现类 | 说明 |
|---------|--------|------|
| `UserService` | `UserServiceImpl` | 用户相关业务逻辑 |
| `ProductService` | `ProductServiceImpl` | 产品相关业务逻辑 |
| `OrderService` | `OrderServiceImpl` | 订单相关业务逻辑 |
| `ManagerService` | `ManagerServiceImpl` | 经理相关业务逻辑 |

### DDD 仓储层（Repository Layer）

| 接口名称 | 实现类 | 说明 |
|---------|--------|------|
| `IUserRepository` | `UserRepositoryImpl` | 用户数据持久化 |

### DDD 应用层（Application Layer）

| 服务名称 | 实现类 | 说明 |
|---------|--------|------|
| `CreateUserCommandHandler` | `CreateUserCommandHandler` | 创建用户命令处理器 |
| `UserQueryHandler` | `UserQueryHandler` | 用户查询处理器 |
| `UserApplicationService` | `UserApplicationService` | 用户应用服务 |

---

## 💉 在服务中注入依赖

### 示例 1：基础服务依赖注入

```typescript
import { injectable, inject } from 'tsyringe'
import { DatabaseService } from './DatabaseService.js'

@injectable()
export class UserServiceImpl {
  constructor(
    @inject(DatabaseService) private db: DatabaseService
  ) {}

  async getUserById(id: string) {
    return await this.db.readUsers()
  }
}
```

### 示例 2：使用字符串 Token 注入

```typescript
import { injectable, inject } from 'tsyringe'

@injectable()
export class CreateUserCommandHandler {
  constructor(
    @inject('IUserRepository') private userRepository: IUserRepository
  ) {}

  async handle(command: CreateUserCommand) {
    const exists = await this.userRepository.existsByPhone(command.phone)
    if (exists) {
      throw new ConflictError('该手机号已被注册')
    }
    // ...
  }
}
```

### 示例 3：多层依赖注入

```typescript
// 仓储实现依赖于数据访问层
@injectable()
export class UserRepositoryImpl implements IUserRepository {
  constructor(
    @inject(DatabaseService) private databaseService: DatabaseService
  ) {}

  async findById(id: string): Promise<User | null> {
    const users = await this.databaseService.readUsers()
    // ...
  }
}

// 命令处理器依赖于仓储
@injectable()
export class CreateUserCommandHandler {
  constructor(
    @inject('IUserRepository') private userRepository: IUserRepository
  ) {}

  async handle(command: CreateUserCommand) {
    const exists = await this.userRepository.existsByPhone(command.phone)
    // ...
  }
}
```

---

## 🎨 在控制器中使用

### 示例：Express 控制器

```typescript
import { Request, Response } from 'express'
import { injectable } from 'tsyringe'
import { resolve } from '../../container.js'
import { CreateUserCommandHandler } from '../../application/command-handlers/CreateUserCommandHandler.js'

@injectable()
export class UserController {
  private commandHandler = resolve<CreateUserCommandHandler>('CreateUserCommandHandler')

  async registerUser(req: Request, res: Response) {
    try {
      const command = new CreateUserCommand(req.body)
      const user = await this.commandHandler.handle(command)
      
      res.json({
        code: 0,
        message: '注册成功',
        data: user
      })
    } catch (error) {
      res.status(400).json({
        code: 400,
        message: error.message,
        data: null
      })
    }
  }
}
```

---

## 🧪 在测试中使用

### Mock 依赖进行单元测试

```typescript
import { describe, it, expect, vi } from 'vitest'
import { container } from 'tsyringe'
import { UserServiceImpl } from '../services/UserService.js'

describe('UserService', () => {
  it('should register user successfully', async () => {
    // Mock DatabaseService
    const mockDb = {
      readUsers: vi.fn().mockResolvedValue([]),
      writeUsers: vi.fn().mockResolvedValue(undefined)
    }
    
    // 注册 Mock 服务
    container.registerSingleton('DatabaseService', mockDb)
    
    // 解析服务
    const userService = container.resolve(UserServiceImpl)
    
    // 执行测试
    const result = await userService.registerUser({
      phone: '13800138000',
      password: 'password123',
      nickname: 'Test User'
    })
    
    expect(result).toBeDefined()
    expect(result.phone).toBe('13800138000')
  })
})
```

---

## 🔧 容器工具函数

### resolve<T>(token)

从容器中解析服务实例。

```typescript
import { resolve } from './container.js'

// 基本用法
const service = resolve('UserService')

// 类型安全用法
const userService = resolve<UserService>('UserService')
```

### isRegistered(token)

检查服务是否已注册。

```typescript
import { isRegistered } from './container.js'

if (isRegistered('UserService')) {
  const service = resolve('UserService')
}
```

### clearContainer()

清除容器中的所有实例（主要用于测试）。

```typescript
import { clearContainer } from './container.js'

beforeEach(() => {
  clearContainer()
})
```

---

## 📝 最佳实践

### ✅ 推荐的做法

1. **始终使用 @injectable() 装饰器**
   ```typescript
   @injectable()
   export class MyService { }
   ```

2. **使用构造函数注入依赖**
   ```typescript
   constructor(
     @inject('IUserRepository') private userRepo: IUserRepository
   ) {}
   ```

3. **注册时使用接口作为 Token**
   ```typescript
   container.registerSingleton<IUserRepository>('IUserRepository', UserRepositoryImpl)
   ```

4. **在控制器中使用 resolve() 获取依赖**
   ```typescript
   private userService = resolve<UserService>('UserService')
   ```

### ❌ 不推荐的做法

1. **不要在服务内部直接导入具体实现**
   ```typescript
   // ❌ 不推荐
   import { DatabaseService } from './DatabaseService.js'
   
   // ✅ 推荐
   constructor(@inject(DatabaseService) private db: DatabaseService)
   ```

2. **不要使用 new 关键字创建依赖实例**
   ```typescript
   // ❌ 不推荐
   const service = new UserService()
   
   // ✅ 推荐
   const service = resolve<UserService>('UserService')
   ```

3. **不要在构造函数中执行复杂逻辑**
   ```typescript
   // ❌ 不推荐
   constructor(@inject('ConfigService') private config: ConfigService) {
     this.setup() // 不要在构造函数中执行
   }
   
   // ✅ 推荐
   async initialize() {
     await this.setup()
   }
   ```

---

## 🏗️ 架构层级

```
┌─────────────────────────────────────────────┐
│         接口层 (Interfaces Layer)            │
│    Controllers, HTTP Handlers, Gateways     │
└─────────────────────┬───────────────────────┘
                      │ 注入应用层服务
┌─────────────────────▼───────────────────────┐
│         应用层 (Application Layer)          │
│  Command Handlers, Query Handlers, DTOs    │
└─────────────────────┬───────────────────────┘
                      │ 注入领域服务
┌─────────────────────▼───────────────────────┐
│         领域层 (Domain Layer)                │
│    Aggregates, Entities, Value Objects     │
└─────────────────────┬───────────────────────┘
                      │ 注入仓储接口
┌─────────────────────▼───────────────────────┐
│      基础设施层 (Infrastructure Layer)       │
│  Repository Impl, Database Access, Cache   │
└─────────────────────────────────────────────┘
```

---

## 📚 相关文档

- [DDD 架构实现指南](../DDD_IMPLEMENTATION_GUIDE.md)
- [CQRS 模式说明](../DDD_PROGRESSIVE_MIGRATION_GUIDE.md)
- [仓储模式详解](../DDD_MIGRATION_GUIDE.md)

---

**版本**: 1.0.0  
**最后更新**: 2026-06-08  
**维护者**: Development Team
