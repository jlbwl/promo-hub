# DDD 架构落地实现指南

## 📋 概述

本文档基于之前的建议，完成了 DDD 架构的完整落地实现，包括：

- ✅ 领域层（Domain）- 纯净无技术依赖
- ✅ 应用层（Application）- 流程编排、CQRS
- ✅ 基础设施层（Infrastructure）- 技术隔离、Mapper、Repository
- ✅ 接口层（Interfaces）- 协议适配、Presenter

## 🏗️ 完整架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Interfaces Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Controllers  │  │  Presenters  │  │   DTOs (Request/Response) │  │
│  │  (HTTP API)  │  │   (VO)       │  │                          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                      Application Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   Commands   │  │   Queries    │  │  Command/Query Handlers  │  │
│  │  (Write)     │  │   (Read)     │  │   (Use Case Orchestration)│  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                        Domain Layer                                  │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  Aggregates    │  Value Objects  │  Domain Events  │          │ │
│  │  (User)        │  (Phone, Price) │  (UserRegistered)│          │ │
│  ├───────────────────────────────────────────────────────────────┤ │
│  │  Domain Services              │  Repository Interfaces         │ │
│  └───────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                              │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────────┐   │
│  │ Repositories   │  │     Mappers     │  │  External Systems   │   │
│  │  (Impl)        │  │ (DB ↔ Domain)   │  │  (Payment, SMS)     │   │
│  └────────────────┘  └─────────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## 📁 完整目录结构

```
apps/api/src/
├── domain/                             # 领域层（核心，纯净）
│   ├── shared/
│   │   ├── Entity.ts                   # 实体基类
│   │   ├── ValueObject.ts             # 值对象基类
│   │   ├── AggregateRoot.ts           # 聚合根基类
│   │   ├── DomainEvent.ts             # 领域事件基类
│   │   ├── Repository.ts              # 仓储接口基类
│   │   └── errors/
│   │       └── DomainError.ts         # 领域错误
│   └── user/                          # 用户限界上下文
│       ├── entities/
│       │   └── User.ts                # 用户聚合根（充血模型）
│       ├── value-objects/
│       │   ├── Phone.ts               # 手机号值对象
│       │   ├── Password.ts            # 密码值对象
│       │   └── UserRole.ts            # 角色枚举
│       ├── events/
│       │   └── UserRegistered.ts      # 用户注册事件
│       └── repositories/
│           └── UserRepository.ts      # 用户仓储接口
├── application/                       # 应用层（编排）
│   ├── commands/
│   │   └── CreateUserCommand.ts      # 创建用户命令
│   ├── queries/
│   │   └── UserQueries.ts            # 用户查询定义
│   ├── command-handlers/
│   │   └── CreateUserCommandHandler.ts # 命令处理器
│   ├── query-handlers/
│   │   └── UserQueryHandler.ts       # 查询处理器
│   ├── dtos/
│   │   └── CreateUserDTO.ts          # 数据传输对象
│   └── services/
│       └── UserApplicationService.ts # 应用服务（旧版，保留兼容）
├── infrastructure/                    # 基础设施层（技术实现）
│   └── persistence/
│       ├── mappers/
│       │   └── UserMapper.ts         # 数据库 ↔ 领域模型映射
│       └── repositories/
│           └── UserRepositoryImpl.ts # 用户仓储实现
└── interfaces/                        # 接口层（协议适配）
    ├── http/
    │   └── controllers/
    │       └── UserControllerDDD.ts  # DDD 版本控制器
    └── presenters/
        └── UserPresenter.ts          # 用户展示器（Domain → VO）
```

## 🎯 核心设计原则

### 1. 领域层（Domain Layer）- 纯净无技术依赖

**实现要点：**
- ✅ 聚合根包含业务逻辑（充血模型）
- ✅ 值对象封装校验逻辑
- ✅ 仓储接口定义在领域层
- ✅ 不引入任何数据库、框架依赖

**User 聚合根示例：**
```typescript
// User.ts - 业务逻辑都在聚合根内部
public updateName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new ValidationError('用户名称不能为空')
  }
  this.name = name.trim()
  this.updateTimestamp()
}

public ban(reason?: string): void {
  if (this.role === UserRole.ADMIN) {
    throw new BusinessRuleError('不能禁用管理员账户')
  }
  this.status = UserStatus.BANNED
  this.updateTimestamp()
}
```

### 2. 应用层（Application Layer）- 流程编排

**实现要点：**
- ✅ CQRS 分离：Commands（写）、Queries（读）
- ✅ 命令处理器负责事务边界
- ✅ 查询处理器可绕过领域层优化性能
- ✅ 不包含业务逻辑，只编排

**Command Handler 示例：**
```typescript
// CreateUserCommandHandler.ts - 一个用例一个事务
async handle(command: CreateUserCommand): Promise<User> {
  // 1. 前置校验
  const exists = await this.userRepository.existsByPhone(command.phone)
  if (exists) {
    throw new ConflictError('该手机号已被注册')
  }

  // 2. 创建聚合根（通过工厂方法）
  const user = User.register(userId, command.name, command.phone, ...)

  // 3. 保存
  await this.userRepository.save(user)

  // 4. 处理领域事件
  for (const event of user.domainEvents) {
    await this.eventBus.publish(event)
  }

  return user
}
```

**Query Handler 示例：**
```typescript
// UserQueryHandler.ts - 直接查询，不经过领域层
async handleList(query: ListUsersQuery): Promise<UserListDTO> {
  // 直接从数据库获取数据
  const users = await data.readUsers()
  
  // 过滤和分页
  const filtered = this.filter(users, query)
  const paginated = this.paginate(filtered, query)
  
  // 返回 DTO
  return {
    list: paginated.map(u => this.toDTO(u)),
    total: filtered.length,
    ...
  }
}
```

### 3. 基础设施层（Infrastructure Layer）- 技术隔离

**实现要点：**
- ✅ Repository 实现领域层定义的接口
- ✅ Mapper 负责数据库模型与领域模型转换
- ✅ 防腐层（ACL）隔离外部系统

**Mapper 示例：**
```typescript
// UserMapper.ts - 隔离数据库变更对领域的影响
static toDomain(dbModel: any): User {
  return User.fromPersistence(
    dbModel.id,
    dbModel.name,
    dbModel.phone,
    dbModel.password,
    dbModel.role as UserRole,
    // ...
  )
}

static toPersistence(domain: User): any {
  return {
    id: domain.id,
    name: domain.name,
    phone: domain.phone.value,
    password: domain.password.hashedValue,
    // ...
  }
}
```

### 4. 接口层（Interfaces Layer）- 纯粹的协议适配

**实现要点：**
- ✅ Controller 只负责 HTTP 协议处理
- ✅ Presenter 负责领域模型 → 视图模型转换
- ✅ 严禁在此层写业务逻辑

**Presenter 示例：**
```typescript
// UserPresenter.ts - 视图模型转换
static toPublicView(user: User): PublicUserVO {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone.mask(), // 脱敏
    role: user.role,
    status: user.status,
    avatar: user.avatar,
    // ... 只返回前端需要的字段
  }
}
```

## 🎨 实际开发流程

### 场景：用户注册流程

```
1. 请求进入 Controller
   ↓
2. Controller 接收 Request，构造 Command
   ↓
3. 调用 Command Handler
   ↓
4. Command Handler:
   - 校验手机号是否存在
   - 调用 User.register() 创建聚合根
   - 触发 UserRegistered 领域事件
   - 保存到 Repository
   ↓
5. 返回 User 聚合根
   ↓
6. Controller 通过 Presenter 转换为 VO
   ↓
7. 返回 Response
```

### 代码调用链路

```typescript
// 1. Controller
const command = { name: req.body.name, phone: req.body.phone, ... }
const user = await commandHandler.handle(command)
const view = UserPresenter.toPublicView(user)
res.json(view)

// 2. Command Handler
const user = User.register(...)
await repository.save(user)

// 3. Domain Model (User)
// - 内部完成所有业务校验
// - 发布领域事件

// 4. Repository
await repository.save(user) // 通过 Mapper 转换
```

## 🔧 关键组件说明

### 值对象（Value Object）

**特点：**
- 不可变（Immutable）
- 通过属性值判断相等
- 无唯一标识

**Phone 值对象示例：**
```typescript
export class Phone extends ValueObject {
  private constructor(private readonly value: string) {}

  public static create(value: string): Phone {
    const phone = value.trim()
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      throw new ValidationError('无效的手机号')
    }
    return new Phone(phone)
  }

  public mask(): string {
    return this.value.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
  }
}
```

### 聚合根（Aggregate Root）

**特点：**
- 一致性边界
- 通过根访问内部对象
- 包含领域事件

**User 聚合根关键方法：**
```typescript
// 工厂方法
public static register(...): User {
  const user = new User(...)
  user.addDomainEvent(new UserRegistered(...))
  return user
}

// 业务方法
public updateName(name: string): void
public changePassword(old: string, new: string): void
public ban(): void
public activate(): void
```

## 📊 新旧架构对比

| 方面 | 旧架构 | 新 DDD 架构 |
|------|--------|-------------|
| 业务逻辑位置 | Service 层 | 聚合根/值对象 |
| 数据验证 | 分散在各处 | 值对象内部 |
| 查询方式 | Service + ORM | CQRS 独立查询 |
| 数据转换 | 手动 map | Mapper/Presenter |
| 可测试性 | 依赖数据库 | 领域层可独立测试 |
| 演进性 | 修改困难 | 限界上下文独立演进 |

## 🚀 后续演进建议

### 短期（1-2 周）
1. 完善产品上下文的 DDD 实现
2. 实现领域事件总线（Event Bus）
3. 添加单元测试覆盖领域层

### 中期（1-2 月）
1. 实现订单上下文
2. 实现佣金上下文
3. 添加集成测试
4. 引入工作单元（Unit of Work）

### 长期（3-6 月）
1. 事件溯源（Event Sourcing）
2. Saga 模式处理分布式事务
3. 读写分离架构优化
4. 限界上下文间通过事件集成

## 💡 最佳实践回顾

1. **领域层保持纯净** - 无技术依赖，纯业务逻辑
2. **充血模型** - 业务逻辑放入实体和值对象
3. **CQRS 分离** - 读写不同路径，优化性能
4. **依赖倒置** - 仓储接口在领域层，实现在基础设施层
5. **防腐层隔离** - Mapper、ACL 防止外部污染
6. **事务边界** - 应用层控制事务，一个用例一个事务
7. **向后兼容** - 新旧架构共存，渐进式迁移
