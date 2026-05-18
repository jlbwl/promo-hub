# 前端代码组织优化文档

## 概述

本文档记录了前端代码组织的优化方案，包括组件模块化、代码注释规范等内容。

## 目录结构优化

```
apps/user/src/
├── components/          # 可复用组件
│   ├── ProductCard.vue    # 产品卡片组件
│   ├── CategoryList.vue   # 分类列表组件
│   └── CartItem.vue       # 购物车项组件
├── composables/         # 通用逻辑 composables
│   ├── useLocalStorage.ts # 本地存储操作
│   └── useProductCategories.ts # 产品分类管理
├── views/              # 页面组件
│   ├── HomeView.vue       # 首页（已重构）
│   └── CartView.vue       # 购物车页（已重构）
└── ...
```

## 可复用组件

### 1. ProductCard - 产品卡片组件

#### 功能
- 显示产品封面、标题、价格、销量
- 显示分类标签
- 支持加入收藏/已收藏状态
- 点击跳转到产品详情

#### Props
```typescript
interface ProductCardProps {
  product: ProductItem    // 产品数据
  categoryName?: string   // 分类名称
  showActions?: boolean   // 是否显示操作按钮
}
```

#### Events
- `click` - 点击产品卡片
- `add-to-cart` - 点击加入收藏按钮

### 2. CategoryList - 分类列表组件

#### 功能
- 横向滚动展示产品分类
- 支持选择分类并高亮当前选中项

#### Props
```typescript
interface CategoryListProps {
  categories: CategoryItem[]   // 分类数据
  activeCategory: number       // 当前激活的分类ID
}
```

#### Events
- `update:activeCategory` - 更新选中的分类（支持 v-model）
- `select` - 分类选择事件

### 3. CartItem - 购物车项组件

#### 功能
- 显示购物车项的产品信息
- 支持移除操作（主账户）
- 显示员工账户提示

#### Props
```typescript
interface CartItemProps {
  item: CartItemData       // 购物车项数据
  isEmployee?: boolean     // 是否为员工账户
}
```

#### Events
- `click` - 点击购物车项
- `remove` - 移除购物车项

## Composables

### 1. useLocalStorage - 本地存储操作

```typescript
import { useLocalStorage, useUser } from '../composables/useLocalStorage'

// 基本使用
const { get, set, remove } = useLocalStorage('key', defaultValue)

// 用户信息相关
const { getUserId, getManagerId, isEmployee } = useUser()
```

### 2. useProductCategories - 产品分类管理

```typescript
import { useProductCategories } from '../composables/useProductCategories'

const { categories, getCategoryName } = useProductCategories()
```

## 代码注释规范

### 组件文件头部
```typescript
/**
 * 组件名称
 * 组件功能简述
 */
```

### 接口和类型
```typescript
/**
 * 接口描述
 */
interface InterfaceName {
  // 属性描述
  property: Type
}
```

### 函数和方法
```typescript
/**
 * 函数功能描述
 * @param paramName - 参数描述
 * @returns 返回值描述
 */
function functionName(param: Type): ReturnType {
  // 实现
}
```

### 关键逻辑注释
```typescript
// 简短说明这段代码做什么
// 复杂逻辑需要解释原因和实现思路
```

## 重构指南

### 页面组件改造步骤
1. 识别可提取的 UI 元素
2. 创建独立的可复用组件
3. 提取通用逻辑到 composables
4. 重构页面，使用新组件
5. 添加详细注释
6. 测试验证

### 示例重构
- [HomeView.vue](file:///Users/sunkai/Documents/projects/self-promotion/apps/user/src/views/HomeView.vue) - 使用 ProductCard 和 CategoryList
- [CartView.vue](file:///Users/sunkai/Documents/projects/self-promotion/apps/user/src/views/CartView.vue) - 使用 CartItem

## 后续优化建议

1. **更多可复用组件**
   - 产品详情页组件
   - 订单卡片组件
   - 用户信息组件

2. **Composables 扩展**
   - useProducts - 产品列表管理
   - useCart - 购物车管理
   - useAuth - 认证管理（与 shared 包整合）

3. **管理端优化**
   - 创建 manager 端的可复用组件
   - 统一管理端 UI 风格

4. **TypeScript 类型完善**
   - 完善组件 props 类型
   - 添加 API 响应类型定义
