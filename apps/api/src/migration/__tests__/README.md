# 领域层测试指南

## 概述

本指南描述了项目中领域层的单元测试策略和最佳实践。

## 测试范围

领域层测试覆盖以下内容：

### 值对象 (Value Objects)
- `Phone` - 手机号验证和处理
- `Password` - 密码加密和验证
- `UserRole` / `UserStatus` - 枚举常量

### 实体和聚合根 (Entities / Aggregates)
- `User` - 用户聚合根的业务逻辑

### 领域事件 (Domain Events)
- `UserRegistered` - 用户注册事件

## 运行测试

### 基本命令

```bash
# 运行所有测试
npm run test

# 监听模式运行（自动重新运行）
npm run test:watch

# 生成测试覆盖率报告
npm run test:coverage
```

## 测试最佳实践

### 1. 值对象测试

值对象测试应该验证：
- 创建逻辑（包括验证）
- 相等性比较
- 业务方法
- 不可变性

**示例 - Phone 值对象测试：**
```typescript
describe('Phone 值对象', () => {
  it('应该成功创建有效的手机号', () => {
    const phone = Phone.create('13800138000')
    expect(phone).toBeInstanceOf(Phone)
    expect(phone.value).toBe('13800138000')
  })

  it('应该对无效的手机号格式抛出 ValidationError', () => {
    expect(() => Phone.create('invalid')).toThrow(ValidationError)
  })
})
```

### 2. 聚合根测试

聚合根测试应该验证：
- 工厂方法
- 业务规则执
- 领域事件发布
- 状态转换

**示例 - User 聚合根测试：**
```typescript
describe('User 聚合根', () => {
  it('应该成功创建并注册新用户', () => {
    const user = User.register(uuidv4(), '张三', '13800138000', 'password123')
    expect(user.name).toBe('张三')
  })

  it('应该发布 UserRegistered 领域事件', () => {
    const user = User.register(uuidv4(), '张三', '13800138000', 'password123')
    expect(user.domainEvents.length).toBe(1)
  })
})
```

### 3. 领域事件测试

领域事件测试应该验证：
- 事件属性正确性
- 事件继承关系
- 事件元数据（时间戳、ID）

## 测试文件位置

所有领域层测试文件位于：
```
apps/api/src/migration/__tests__/
├── Phone.test.ts
├── Password.test.ts
├── User.test.ts
├── UserRole.test.ts
└── UserRegistered.test.ts
```

## 测试覆盖率目标

- 值对象：100% 覆盖率
- 聚合根：90%+ 覆盖率
- 领域事件：100% 覆盖率

## 持续集成

这些测试会在每次提交时自动运行，确保领域层的核心业务逻辑保持正确。
