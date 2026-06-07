# 完整 DDD 架构迁移指南

## 🎉 迁移方案已完成

我们已经创建了完整的渐进式 DDD 架构迁移方案，包括：

1. ✅ 完整的四层架构实现
2. ✅ Adapter 层保持向后兼容
3. ✅ 充血模型的 User 聚合根
4. ✅ CQRS 模式的 Command/Query
5. ✅ Repository/Mapper 模式
6. ✅ 领域事件支持

## 📁 项目结构

```
apps/api/src/migration/ddd/
├── domain/                          # 领域层（纯业务逻辑）
│   ├── shared/                      # 共享内核
│   │   ├── Entity.ts
│   │   ├── ValueObject.ts
│   │   ├── AggregateRoot.ts
│   │   ├── DomainEvent.ts
│   │   └── errors/
│   │       └── DomainError.ts
│   └── user/                        # 用户限界上下文
│       ├── entities/
│       │   └── User.ts             # 聚合根（充血模型）
│       ├── value-objects/
│       │   ├── Phone.ts            # 手机号值对象
│       │   ├── Password.ts         # 密码值对象
│       │   └── UserRole.ts         # 角色枚举
│       ├── events/
│       │   └── UserRegistered.ts   # 领域事件
│       └── repositories/
│           └── UserRepository.ts   # 仓储接口
├── application/                     # 应用层（用例编排）
│   ├── commands/
│   │   └── UserCommands.ts         # 命令定义
│   ├── queries/
│   │   └── UserQueries.ts          # 查询定义
│   ├── command-handlers/
│   │   └── UserCommandHandlers.ts  # 命令处理器
│   └── query-handlers/
│       └── UserQueryHandlers.ts    # 查询处理器
├── infrastructure/                  # 基础设施层（技术实现）
│   └── persistence/
│       ├── mappers/
│       │   └── UserMapper.ts       # 数据映射器
│       └── repositories/
│           └── UserRepositoryImpl.ts # 仓储实现
└── adapters/                        # 适配器层（向后兼容）
    └── UserServiceAdapter.ts       # 旧接口适配器
```

## 🔄 迁移步骤

### 阶段 1：准备（已完成）

我们已经创建了完整的 DDD 架构代码，放在 `apps/api/src/migration/ddd/` 目录下。

### 阶段 2：逐步替换 UserService

**第一步：更新容器配置**

在 `apps/api/src/container.ts` 中添加：

```typescript
import { IUserRepository } from './migration/ddd/domain/user/repositories/UserRepository.js'
import { UserRepositoryImpl } from './migration/ddd/infrastructure/persistence/repositories/UserRepositoryImpl.js'
import { UserCommandHandlers } from './migration/ddd/application/command-handlers/UserCommandHandlers.js'
import { UserQueryHandlers } from './migration/ddd/application/query-handlers/UserQueryHandlers.js'
import { UserServiceAdapter } from './migration/ddd/adapters/UserServiceAdapter.js'

export function initContainer(): void {
  // ... 现有的注册代码
  
  // 注册 DDD 相关依赖
  container.registerSingleton('IUserRepository', UserRepositoryImpl)
  container.registerSingleton(UserCommandHandlers, UserCommandHandlers)
  container.registerSingleton(UserQueryHandlers, UserQueryHandlers)
  container.registerSingleton(UserServiceAdapter, UserServiceAdapter)
  
  // 可选：用新的适配器替换旧的 UserService
  // container.registerSingleton('UserService', UserServiceAdapter)
}
```

**第二步：创建切换开关（功能开关）**

创建环境变量或配置：

```typescript
// config.ts
export const useDDDUserService = process.env.USE_DDD_USER_SERVICE === 'true'
```

**第三步：在需要的地方使用新架构**

```typescript
// 在 controller 或其他地方
import { resolve } from './container.js'
import { UserCommandHandlers } from './migration/ddd/application/command-handlers/UserCommandHandlers.js'
import { UserQueryHandlers } from './migration/ddd/application/query-handlers/UserQueryHandlers.js'

// 使用新的 Command Handler
const commandHandlers = resolve(UserCommandHandlers)
const user = await commandHandlers.handleRegisterUser({
  phone: '13800138000',
  password: 'password123',
  nickname: 'Test User',
})

// 使用新的 Query Handler
const queryHandlers = resolve(UserQueryHandlers)
const result = await queryHandlers.handleList({
  page: 1,
  pageSize: 20,
})
```

### 阶段 3：完全替换（可选）

当新架构运行稳定后，可以：

1. 用 `UserServiceAdapter` 完全替换旧的 `UserService`
2. 逐步改造控制器直接使用 Command/Query Handlers
3. 引入 Presenter 模式处理视图层转换

## 🎯 关键架构原则

### 1. 领域层保持纯净

- ❌ 没有技术依赖（数据库、框架等）
- ✅ 包含所有业务逻辑
- ✅ 定义仓储接口（不实现）

### 2. 应用层只做编排

- ✅ 调用领域模型和仓储
- ✅ 事务边界管理
- ❌ 不包含业务逻辑

### 3. 基础设施层技术隔离

- ✅ 实现仓储接口
- ✅ Mapper 负责数据映射
- ✅ 防腐层隔离外部系统

### 4. Adapter 层保证兼容

- ✅ 实现旧接口
- ✅ 委托给新架构
- ✅ 错误格式转换

## 💡 使用示例

### 使用旧接口（兼容模式）

```typescript
import { UserServiceAdapter } from './migration/ddd/adapters/UserServiceAdapter.js'

const adapter = resolve(UserServiceAdapter)
const user = await adapter.registerUser({
  phone: '13800138000',
  password: 'password123',
  nickname: 'Test User',
})
```

### 使用新架构（推荐）

```typescript
import { UserCommandHandlers, UserQueryHandlers } from './migration/ddd/application/index.js'
import { User } from './migration/ddd/domain/user/entities/User.js'

// 创建用户
const commandHandlers = resolve(UserCommandHandlers)
const user = await commandHandlers.handleRegisterUser({
  phone: '13800138000',
  password: 'password123',
})

// 查询用户
const queryHandlers = resolve(UserQueryHandlers)
const users = await queryHandlers.handleList({ page: 1, pageSize: 20 })
```

### 直接使用领域模型

```typescript
import { User } from './migration/ddd/domain/user/entities/User.js'
import { Phone } from './migration/ddd/domain/user/value-objects/Phone.js'
import { Password } from './migration/ddd/domain/user/value-objects/Password.js'

// 创建值对象
const phone = Phone.create('13800138000')
const password = Password.createSync('password123')

// 使用聚合根
const user = User.register(
  'user_123',
  'Test User',
  '13800138000',
  'password123',
)

// 执行业务操作
user.updateNickname('New Name')
await user.changePassword('oldPass', 'newPass')
```

## 🧪 测试

### 领域层单元测试（独立）

```typescript
import { User } from './migration/ddd/domain/user/entities/User.js'
import { ValidationError } from './migration/ddd/domain/shared/errors/DomainError.js'

describe('User', () => {
  it('should validate phone format', () => {
    expect(() => {
      User.register('id', 'Name', 'invalid-phone', 'password')
    }).toThrow(ValidationError)
  })

  it('should change password', async () => {
    const user = User.register('id', 'Name', '13800138000', 'oldpass')
    await user.changePassword('oldpass', 'newpass')
    const isValid = await user.password.verifyAsync('newpass')
    expect(isValid).toBe(true)
  })
})
```

## 📊 迁移检查清单

- [ ] 更新 DI 容器配置
- [ ] 添加功能开关
- [ ] 部署到测试环境
- [ ] 运行集成测试
- [ ] 灰度发布（5% 流量）
- [ ] 完整灰度发布
- [ ] 完全切换
- [ ] 清理旧代码（可选）

## 🚀 下一步

### 1. 扩展其他服务

按照相同的模式，逐步迁移：
- ProductService → Product 聚合根
- OrderService → Order 聚合根
- ManagerService → Manager 聚合根

### 2. 完善领域事件

引入事件总线，处理跨聚合的逻辑：
```typescript
class UserRegisteredHandler {
  async handle(event: UserRegistered) {
    // 发送欢迎邮件
    // 创建默认产品
    // 等等
  }
}
```

### 3. 引入 CQRS 读写分离

- 读：直接查询优化
- 写：通过聚合根

## ⚠️ 注意事项

1. **保持数据兼容性**：新代码要能读写旧数据
2. **逐步迁移**：不要一次性全部替换
3. **完善测试**：重点测试领域模型
4. **监控日志**：对比新旧架构的行为

## 📞 总结

这个迁移方案的核心优势：

✅ **零风险**：新旧架构可以共存
✅ **渐进式**：可以按服务逐个迁移
✅ **可回滚**：随时可以切回旧实现
✅ **可扩展**：架构整洁，易于添加新功能
✅ **易测试**：领域模型可以独立测试

按照这个方案，您可以在不影响现有业务的情况下，将项目逐步迁移到优雅的 DDD 架构！
