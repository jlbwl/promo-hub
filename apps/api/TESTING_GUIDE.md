# 测试隔离最佳实践指南

## 概述

本指南确保项目中的所有单元测试完全隔离，不依赖外部服务。

## 核心原则

### ✅ 单元测试必须
- 快速运行（毫秒级别）
- 离线可执行
- 不依赖数据库、网络、文件系统
- 可完全独立运行
- 可重复执行（结果一致）

### ❌ 单元测试绝不能
- 发起真实网络请求
- 读写真实文件系统
- 连接真实数据库
- 依赖外部API

## 当前测试隔离状态

### ✅ 领域层测试（已完全隔离）
- Phone.test.ts - 纯值对象测试，无外部依赖
- Password.test.ts - 纯值对象测试，无外部依赖
- User.test.ts - 聚合根测试，无外部依赖
- UserRole.test.ts - 枚举测试，无外部依赖
- UserRegistered.test.ts - 事件测试，无外部依赖

### ✅ 服务层测试（已部分Mock）
- ProductService.test.ts - 使用 vi.mock() 模拟数据模块
- OrderService.test.ts - 使用 vi.mock() 模拟数据模块
- UserService - 尚未测试

### ✅ 工具函数测试
- logger.test.ts - 纯工具测试
- response.test.ts - 纯工具测试
- sms.test.ts - 内存存储测试，无外部依赖

## 隔离策略

### 1. 使用 vi.mock() 模拟依赖

#### 模拟数据模块
```typescript
// 在测试文件顶部
vi.mock('../../data.js', () => ({
  readProducts: vi.fn(),
  readOrders: vi.fn(),
  queryOne: vi.fn(),
  insertProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn()
}))

// 导入被模拟的模块
import { readProducts, readOrders } from '../../data.js'

// 在测试中模拟返回值
vi.mocked(readProducts).mockResolvedValue([mockProduct])
```

#### 模拟缓存服务
```typescript
vi.mock('../cache/index.js', () => ({
  CacheService: class {
    get = vi.fn().mockResolvedValue(null)
    set = vi.fn().mockResolvedValue(undefined)
  }
}))
```

### 2. 依赖注入设计

确保领域层代码遵循依赖倒置原则，依赖抽象接口而不是具体实现。

#### ✅ 好的设计
```typescript
// 仓储接口
interface IUserRepository {
  findById(id: string): Promise<User | null>
  save(user: User): Promise<void>
}

// 依赖注入到命令处理器
@injectable()
export class CreateUserCommandHandler {
  constructor(
    @inject('IUserRepository') private userRepository: IUserRepository
  ) {}
}
```

#### ❌ 坏的设计
```typescript
// 直接依赖具体实现
export class CreateUserCommandHandler {
  private userRepository = new MysqlUserRepository() // 无法测试！
}
```

### 3. 测试时间控制

使用 vi.useFakeTimers() 来控制时间流逝，而不是等待真实时间。

```typescript
describe('sms code', () => {
  it('should reject expired code', () => {
    const now = Date.now()
    vi.setSystemTime(now)
    saveSmsCode(phone, code, 0)
    
    // 时间向前推进
    vi.setSystemTime(now + 1000)
    expect(verifySmsCode(phone, code)).toBe(false)
    
    vi.useRealTimers()
  })
})
```

## 后续工作

### 1. 完善 UserService 测试
- [ ] 创建 UserService.test.ts
- [ ] Mock DatabaseService
- [ ] Mock CacheService
- [ ] Mock ConfigService

### 2. 添加集成测试
创建单独的集成测试套件，明确标记为集成测试。

```
apps/api/src/
├── __tests__/
│   ├── unit/          # 单元测试（快速、隔离）
│   └── integration/   # 集成测试（需真实服务）
```

### 3. 测试配置
更新 vitest.config.ts，支持测试分组：

```typescript
export default defineConfig({
  test: {
    include: ['src/__tests__/unit/**/*.test.ts'],
    coverage: {
      include: ['src/migration/domain/**/*.ts']
    }
  }
})
```

## 检查清单

在添加新测试前，确保：

- [ ] 测试文件位于正确的目录
- [ ] 所有外部依赖已被 Mock
- [ ] 测试不依赖特定网络或环境
- [ ] 测试可独立运行（不依赖其他测试）
- [ ] 使用 beforeEach/afterEach 清理状态
- [ ] 使用 vi.clearAllMocks() 重置 Mock

## 运行测试

```bash
# 运行所有单元测试
npm run test

# 运行特定测试文件
npm run test -- User.test.ts

# 运行带覆盖率的测试
npm run test:coverage
```
