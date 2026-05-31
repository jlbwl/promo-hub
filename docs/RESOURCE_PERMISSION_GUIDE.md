# 资源级权限验证系统使用指南

## 概述

本系统提供了一个统一的资源级权限验证框架，支持对产品、用户、经理、订单、分类等资源进行细粒度的权限控制。

## 核心概念

### 资源类型 (ResourceType)
- `product` - 产品
- `manager` - 经理
- `user` - 用户
- `order` - 订单
- `category` - 分类

### 操作类型 (ActionType)
- `read` - 读取
- `create` - 创建
- `update` - 更新
- `delete` - 删除
- `list` - 列表

### 权限规则

#### 产品权限
- **管理员**: 可以进行所有操作
- **经理**: 
  - 可以创建产品
  - 可以查看、编辑、删除自己的产品
  - 可以查看自己团队相关的订单
- **用户**:
  - 可以查看已发布的产品
  - 可以查看自己的订单

#### 用户权限
- **管理员**: 可以进行所有用户操作
- **经理**: 
  - 可以查看自己团队的用户
  - 可以编辑自己团队的用户信息
- **用户**:
  - 只能查看和编辑自己的信息

#### 订单权限
- **管理员**: 可以查看和管理所有订单
- **经理**: 可以查看自己团队相关的订单
- **用户**: 只能查看自己的订单

## 使用方法

### 1. 作为路由中间件使用

```typescript
import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { resourcePermission } from '../middleware/resourcePermission.js'
import { getProductById, updateProductById } from '../controllers/product.controller.js'

const router = Router()

// 获取产品详情 - 使用资源级权限验证
router.get(
  '/products/:id',
  requireAuth, // 先验证是否登录
  resourcePermission({
    resourceType: 'product',
    action: 'read',
    adminOverride: true // 管理员可以跳过资源验证
  }),
  getProductById
)

// 更新产品
router.put(
  '/products/:id',
  requireAuth,
  resourcePermission({
    resourceType: 'product',
    action: 'update',
    adminOverride: true
  }),
  updateProductById
)
```

### 2. 在服务层直接使用检查器

```typescript
import { ResourcePermissionChecker } from '../middleware/resourcePermission.js'

async function someServiceFunction(userId: string, userRole: string, productId: string) {
  // 检查产品权限
  const check = await ResourcePermissionChecker.checkProduct(
    userId,
    userRole,
    productId,
    'update' // 操作类型
  )

  if (!check.allowed) {
    throw new Error(check.message || '无权操作')
  }

  // 继续业务逻辑
  const product = check.product
  // ...
}
```

## 配置选项

### ResourcePermissionConfig

```typescript
interface ResourcePermissionConfig {
  resourceType: ResourceType        // 资源类型
  resourceIdParam?: string          // URL参数中的资源ID字段名，默认'id'
  action: ActionType                // 操作类型
  getOwnerId?: (resource: any) => string | null  // 自定义获取资源所有者的函数
  adminOverride?: boolean           // 管理员是否可以跳过检查，默认true
  allowPublic?: boolean             // 是否允许公开访问
}
```

## 权限流程

### 路由中间件流程
1. 用户登录认证 (requireAuth)
2. 资源权限验证 (resourcePermission)
   - 提取用户信息
   - 检查是否是管理员（adminOverride）
   - 根据资源类型和操作类型执行验证
   - 通过则继续，否则返回403
3. 执行业务逻辑

### 服务层检查流程
1. 调用检查器函数
2. 根据用户角色和资源归属判断
3. 返回检查结果（包含资源数据）

## 现有实现

### 已应用权限验证的路由

1. **产品路由** (`/api/products`)
   - GET /products - 列表（已认证）
   - GET /products/:id - 查看详情（资源级权限）
   - POST /products - 创建（仅经理）
   - PUT /products/:id - 更新（资源级权限）
   - DELETE /products/:id - 删除（资源级权限）

2. **用户路由** (`/api/users`)
   - GET /users - 列表（已认证）
   - GET /users/:id - 查看详情（资源级权限）
   - DELETE /users/:id - 删除（资源级权限）
   - PUT /users/:id/team-name - 更新团队名称（资源级权限）

### 待实现

- **订单路由** - 订单资源权限验证
- **分类路由** - 分类资源权限验证
- **经理路由** - 经理资源权限验证

## 扩展方法

### 添加新的资源类型

1. 在 `ResourceType` 类型中添加新类型
2. 在 `checkResourcePermission` 函数中添加新的 case
3. 实现对应的检查函数（如 `checkNewResourcePermission`）
4. 在 `ResourcePermissionChecker` 对象中添加对应的检查方法

示例：

```typescript
// 1. 更新类型
export type ResourceType = 'product' | 'manager' | 'user' | 'order' | 'category' | 'newResource'

// 2. 添加 case
case 'newResource':
  return await checkNewResourcePermission(user, resourceId, config.action)

// 3. 实现检查函数
async function checkNewResourcePermission(...) { ... }

// 4. 添加检查方法
ResourcePermissionChecker = {
  // ...
  async checkNewResource(...) { ... }
}
```

## 最佳实践

1. **分层验证**: 路由层使用中间件进行前置验证，服务层进行二次验证（可选）
2. **日志记录**: 所有权限检查都有日志记录，便于审计和调试
3. **管理员绕过**: 使用 `adminOverride` 选项让管理员可以绕过资源验证
4. **参数安全**: 从用户认证信息中提取关键参数（如managerId），不要依赖客户端传入
5. **错误信息**: 返回清晰的错误信息，帮助前端正确处理权限问题

## 测试建议

1. 测试不同角色对同一资源的操作权限
2. 测试边界情况（如资源不存在、ID无效等）
3. 测试管理员绕过功能是否正常
4. 验证日志记录是否完整
