# DDD 架构迁移指南

## 概述

本文档描述了如何将当前项目逐步迁移到领域驱动设计 (DDD) 架构。

## 为什么需要 DDD？

1. **业务逻辑内聚** - 将业务规则集中在领域层，避免散落在各处
2. **更好的可测试性** - 值对象和聚合根可以独立测试
3. **清晰的边界** - 限界上下文明确分离不同业务领域
4. **向后兼容** - 可以与现有架构共存，逐步迁移

## 架构分层

```
┌─────────────────────────────────────────────────────────┐
│                    Interface Layer                       │
│  (Controllers, Routes, Presenters, DTOs for API)        │
├─────────────────────────────────────────────────────────┤
│                  Application Layer                       │
│  (Application Services, Command/Query Handlers)         │
├─────────────────────────────────────────────────────────┤
│                    Domain Layer                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Entities, Value Objects, Aggregates              │  │
│  │  Domain Services, Domain Events                   │  │
│  │  Repository Interfaces                            │  │
│  └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                Infrastructure Layer                     │
│  (Repository Impl, Database, Cache, External Services)  │
└─────────────────────────────────────────────────────────┘
```

## 已完成的工作

### 1. 领域共享内核 (Domain Shared Kernel)
- ✅ `Entity.ts` - 实体基类
- ✅ `ValueObject.ts` - 值对象基类
- ✅ `AggregateRoot.ts` - 聚合根基类
- ✅ `DomainEvent.ts` - 领域事件基类
- ✅ `Repository.ts` - 仓储接口基类
- ✅ `DomainError.ts` - 领域错误类型

### 2. 用户上下文 (User Context)
- ✅ 值对象：`Phone`, `Password`, `UserRole/UserStatus`
- ✅ 实体/聚合根：`User`
- ✅ 领域事件：`UserRegistered`
- ✅ 仓储接口：`IUserRepository`
- ✅ 应用服务：`UserApplicationService`
- ✅ 仓储实现：`UserRepositoryImpl`

### 3. 产品上下文 (Product Context)
- ✅ 值对象：`Price`

## 迁移策略

### 阶段一：基础设施准备 (已完成)
- [x] 引入 tsyringe 依赖注入容器
- [x] 配置 TypeScript 装饰器支持
- [x] 创建领域共享内核
- [x] 实现测试环境的 reflect-metadata

### 阶段二：逐个上下文迁移 (进行中)
- [ ] 用户上下文完整迁移
- [ ] 产品上下文完整迁移
- [ ] 订单上下文完整迁移
- [ ] 佣金上下文完整迁移

### 阶段三：应用层改造
- [ ] 创建应用服务编排用例
- [ ] 定义 DTO 和 CQRS 模式
- [ ] 更新控制器使用应用服务

### 阶段四：全面切换
- [ ] 逐步弃用旧的 Service 层
- [ ] 更新所有路由控制器
- [ ] 完善领域事件处理

## 如何使用新架构

### 示例：创建用户 (使用 DDD 方式)

```typescript
import { UserApplicationService } from '../application/services/UserApplicationService'
import { CreateUserDTO } from '../application/dtos/CreateUserDTO'

// 在控制器中使用
class UserController {
  constructor(
    private userAppService: UserApplicationService
  ) {}

  async register(req: Request, res: Response) {
    try {
      const dto: CreateUserDTO = req.body
      const user = await this.userAppService.registerUser(dto)
      
      // 转换为响应 DTO（Presenter 模式）
      res.json({
        id: user.id,
        name: user.name,
        phone: user.phone.mask(),
        role: user.role,
      })
    } catch (error) {
      // 处理领域错误
      if (error instanceof DomainError) {
        res.status(400).json({
          code: error.code,
          message: error.message
        })
      }
    }
  }
}
```

## 新旧架构共存策略

### 保持向后兼容

现有代码可以继续使用，新代码使用 DDD 架构：

```typescript
// 旧方式（仍可用）
import { userService } from '../services/UserService'

// 新方式（推荐使用）
import { UserApplicationService } from '../application/services/UserApplicationService'
```

### 防腐层 (Anticorruption Layer)

在新旧系统间建立适配器：

```typescript
// 将旧数据转换为新的领域对象
class UserAdapter {
  static toDomain(oldUser: any): User {
    return User.fromPersistence(...)
  }
}
```

## 最佳实践

### 1. 聚合根设计原则
- 每个聚合有一个根实体
- 通过根访问聚合内的其他实体
- 保持聚合小而聚焦

### 2. 值对象原则
- 不可变（Immutable）
- 通过属性值判断相等性
- 无身份标识

### 3. 仓储原则
- 每个聚合根对应一个仓储
- 只在仓储中进行持久化操作
- 不在仓储中放置业务逻辑

### 4. 领域事件
- 代表业务中发生的重要事件
- 用于松耦合的跨聚合通信
- 最终一致性的基础

## 下一步工作

1. **产品上下文完整实现**
   - 产品聚合根
   - 分类实体
   - 库存值对象
   - 产品仓储

2. **订单上下文**
   - 订单聚合根
   - 订单项值对象
   - 订单状态机

3. **佣金上下文**
   - 佣金计算规则
   - 佣金结算策略

4. **基础设施增强**
   - 事件总线实现
   - 工作单元 (Unit of Work)
   - 缓存策略集成

## 测试策略

### 单元测试
```typescript
describe('User', () => {
  it('should register new user', () => {
    const user = User.register(
      'test-id',
      'Test User',
      '13800138000',
      'password123'
    )
    expect(user.name).toBe('Test User')
  })
  
  it('should validate phone format', () => {
    expect(() => {
      User.register('id', 'name', 'invalid-phone', 'pass')
    }).toThrow(ValidationError)
  })
})
```

### 集成测试
测试应用服务与仓储的协作。

## 参考资料

- [领域驱动设计 (Eric Evans)](https://book.douban.com/subject/5344973/)
- [实现领域驱动设计 (Vaughn Vernon)](https://book.douban.com/subject/25844633/)
- [Domain-Driven Design Reference](https://domainlanguage.com/ddd/reference/)
