# Promo Hub - 业务推广管理系统 Code Wiki

## 📋 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [整体架构](#3-整体架构)
4. [目录结构](#4-目录结构)
5. [模块详解](#5-模块详解)
6. [数据库设计](#6-数据库设计)
7. [API接口文档](#7-api接口文档)
8. [共享包说明](#8-共享包说明)
9. [部署指南](#9-部署指南)
10. [开发指南](#10-开发指南)

---

## 1. 项目概述

### 1.1 项目简介

Promo Hub 是一款基于 Vue 3 + TypeScript + Express 的现代化推广管理系统，采用 pnpm Monorepo 架构设计。系统面向三类用户群体：系统管理员、渠道经理、普通用户，提供完整的产品管理、订单处理、佣金结算等功能。

### 1.2 用户角色

| 角色 | 权限范围 | 访问入口 |
|------|----------|----------|
| **系统管理员 (Admin)** | 全局数据管理、经理管理、用户管理、操作日志 | `apps/admin` |
| **渠道经理 (Manager)** | 产品管理、订单审核、佣金查看、员工管理 | `apps/manager` |
| **普通用户 (User)** | 产品浏览、做单、佣金查看 | `apps/user` |

### 1.3 核心业务流程

```
产品发布（经理） → 用户做单 → 经理审核 → 佣金结算
                    ↓
              库存扣减
```

---

## 2. 技术栈

### 2.1 前端技术栈

| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 框架 | Vue | 3.5.x | 渐进式前端框架 |
| 语言 | TypeScript | 5.6.x | 类型安全 |
| 构建工具 | Vite | 6.4.x | 快速开发体验 |
| 路由 | Vue Router | 4.4.x | SPA路由管理 |
| 状态管理 | Pinia | 2.2.x | Vue状态管理 |
| UI框架(管理端) | Element Plus | 2.9.x | PC端组件库 |
| UI框架(用户端) | Vant | 4.9.x | 移动端组件库 |
| 样式 | Sass | - | CSS预处理器 |

### 2.2 后端技术栈

| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 框架 | Express | 4.21.x | Node.js Web框架 |
| 语言 | TypeScript | 5.7.x | 类型安全 |
| 数据库 | MySQL | 8.x | 关系型数据库（可选） |
| ORM | mysql2 | 3.22.x | MySQL驱动 |
| 文件存储 | 原生FS | - | 默认JSON文件存储 |
| 文件上传 | Multer | 1.4.5 | multipart/form-data处理 |
| 短信服务 | 第三方SDK | - | 验证码发送 |

### 2.3 工程化工具

| 类别 | 技术 | 说明 |
|------|------|------|
| 包管理 | pnpm | 高效的Monorepo包管理 |
| Monorepo | pnpm workspace | 工作空间管理 |
| 类型检查 | vue-tsc | Vue TypeScript检查 |
| 代码规范 | ESLint | 代码质量检查 |
| CI/CD | GitHub Actions | 自动化部署 |

---

## 3. 整体架构

### 3.1 Monorepo架构

```
promo-hub/
├── apps/                    # 应用程序
│   ├── admin/              # 系统管理员后台
│   ├── manager/            # 渠道经理后台
│   ├── user/               # 用户端
│   └── api/                # 后端API服务
├── packages/               # 共享包
│   └── shared/             # 类型、Store、工具函数
├── scripts/                # 部署脚本
└── .github/workflows/      # CI/CD配置
```

### 3.2 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        用户层                                │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Admin后台      │   Manager后台    │      User端             │
│  (Element Plus) │  (Element Plus) │    (Vant 4)            │
│  Port: 3001     │  Port: 3002     │    Port: 3003           │
└────────┬────────┴────────┬────────┴───────────┬─────────────┘
         │                │                    │
         └────────────────┼────────────────────┘
                          │ HTTP REST API
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                             │
│                    Express Server                            │
│                      Port: 3000                              │
│  ┌──────────────┬──────────────┬─────────────────────────┐  │
│  │  产品接口     │  用户接口    │   订单接口 / 佣金接口    │  │
│  └──────────────┴──────────────┴─────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         ▼                                   ▼
┌──────────────────┐              ┌──────────────────┐
│     MySQL         │              │   文件存储       │
│  (可选，配置启用)  │              │  (默认，JSON)    │
└──────────────────┘              └──────────────────┘
```

### 3.3 数据流向

```
用户操作 → Vue组件 → Pinia Store → HTTP请求 → Express API
                         ↓                            ↓
                   状态更新 ←───────────── 响应数据返回
```

---

## 4. 目录结构

### 4.1 项目根目录

```
promo-hub/
├── apps/                           # 应用程序目录
│   ├── admin/                      # 管理员后台
│   │   ├── src/
│   │   │   ├── layouts/           # 布局组件
│   │   │   ├── router/            # 路由配置
│   │   │   ├── views/             # 页面视图
│   │   │   │   ├── DashboardView.vue
│   │   │   │   ├── LoginView.vue
│   │   │   │   ├── SettingsView.vue
│   │   │   │   ├── OperationLogView.vue
│   │   │   │   ├── user/UserListView.vue
│   │   │   │   └── manager/ManagerListView.vue
│   │   │   ├── styles/            # 全局样式
│   │   │   ├── App.vue
│   │   │   └── main.ts
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   │
│   ├── manager/                    # 经理后台
│   │   ├── src/
│   │   │   ├── components/        # 组件
│   │   │   │   └── RichTextEditor.vue
│   │   │   ├── layouts/
│   │   │   ├── router/
│   │   │   ├── views/
│   │   │   │   ├── DashboardView.vue
│   │   │   │   ├── LoginView.vue
│   │   │   │   ├── ProfileView.vue
│   │   │   │   ├── product/
│   │   │   │   │   ├── ProductListView.vue
│   │   │   │   │   └── ProductEditView.vue
│   │   │   │   └── commission/
│   │   │   │       └── CommissionListView.vue
│   │   │   ├── styles/
│   │   │   ├── App.vue
│   │   │   └── main.ts
│   │   └── ...
│   │
│   ├── user/                       # 用户端（移动端）
│   │   ├── src/
│   │   │   ├── layouts/
│   │   │   │   └── TabbarLayout.vue  # 底部导航布局
│   │   │   ├── router/
│   │   │   ├── views/
│   │   │   │   ├── HomeView.vue
│   │   │   │   ├── LoginView.vue
│   │   │   │   ├── ProfileView.vue
│   │   │   │   ├── CommissionView.vue
│   │   │   │   ├── ProductDetailView.vue
│   │   │   │   ├── EmployeeLoginView.vue
│   │   │   │   └── EmployeeProfileView.vue
│   │   │   ├── styles/
│   │   │   ├── App.vue
│   │   │   └── main.ts
│   │   └── ...
│   │
│   └── api/                        # 后端API服务
│       ├── src/
│       │   ├── index.ts           # 主入口（所有路由在此定义）
│       │   ├── db.ts              # 数据库连接与初始化
│       │   ├── data.ts            # 文件存储操作
│       │   ├── data-memory.ts     # 内存存储（降级方案）
│       │   ├── data-memory.ts
│       │   └── sms.ts             # 短信服务
│       ├── dist_migrate/          # 迁移脚本
│       ├── package.json
│       └── tsconfig.json
│
├── packages/                       # 共享包
│   └── shared/                    # 共享库
│       ├── src/
│       │   ├── index.ts          # 导出入口
│       │   ├── types/            # 类型定义
│       │   │   └── index.ts
│       │   ├── stores/           # Pinia状态管理
│       │   │   ├── auth.ts        # 认证状态
│       │   │   ├── user.ts        # 用户状态
│       │   │   ├── product.ts     # 产品状态
│       │   │   └── commission.ts  # 佣金状态
│       │   └── utils/             # 工具函数
│       │       ├── request.ts     # HTTP请求封装
│       │       ├── helpers.ts    # 通用工具
│       │       └── constants.ts   # 常量定义
│       ├── package.json
│       └── tsconfig.json
│
├── scripts/                        # 部署脚本
│   ├── deploy.sh                  # 自动部署脚本
│   └── setup-server.sh            # 服务器初始化脚本
│
├── .github/
│   └── workflows/
│       └── deploy.yml             # GitHub Actions CI/CD
│
├── package.json                    # 根package.json
├── pnpm-workspace.yaml             # pnpm工作空间配置
├── pnpm-lock.yaml
├── tsconfig.json                  # TypeScript根配置
└── README.md
```

### 4.2 关键文件说明

| 文件路径 | 说明 | 重要性 |
|----------|------|--------|
| `apps/api/src/index.ts` | API服务主入口，包含所有路由定义 | ⭐⭐⭐ |
| `apps/api/src/db.ts` | 数据库连接与表初始化 | ⭐⭐⭐ |
| `packages/shared/src/types/index.ts` | 全局类型定义 | ⭐⭐⭐ |
| `packages/shared/src/utils/request.ts` | HTTP请求封装 | ⭐⭐⭐ |
| `packages/shared/src/stores/*.ts` | 状态管理模块 | ⭐⭐ |
| `apps/*/src/router/index.ts` | 各应用路由配置 | ⭐⭐ |

---

## 5. 模块详解

### 5.1 系统管理员后台 (apps/admin)

**功能定位**：系统的超级管理后台，用于管理所有渠道经理和普通用户。

**主要功能**：

| 模块 | 功能点 | 路由 |
|------|--------|------|
| 仪表盘 | 全局数据统计 | `/` |
| 用户管理 | 用户列表、团队名称修改、状态切换 | `/users` |
| 经理管理 | 经理列表、添加经理、状态管理、团队名称修改 | `/managers` |
| 操作日志 | 查看所有管理操作记录 | `/operation-logs` |
| 设置 | 管理员信息修改、密码修改 | `/settings` |

**路由配置** (`apps/admin/src/router/index.ts`)：

```typescript
// 路由守卫：验证管理员登录状态
// 布局组件：AdminLayout.vue（左侧菜单 + 顶部导航）
// 主要页面：DashboardView, UserListView, ManagerListView, OperationLogView, SettingsView
```

**核心组件**：

- `AdminLayout.vue` - 管理员后台布局
- `UserListView.vue` - 用户列表管理
- `ManagerListView.vue` - 经理列表管理
- `OperationLogView.vue` - 操作日志查看
- `SettingsView.vue` - 管理员设置

---

### 5.2 渠道经理后台 (apps/manager)

**功能定位**：渠道经理的工作台，管理自己负责的产品和订单。

**主要功能**：

| 模块 | 功能点 | 路由 |
|------|--------|------|
| 仪表盘 | 我的产品统计、佣金统计 | `/` |
| 产品管理 | 产品列表、产品编辑/创建、产品上下架 | `/products` |
| 订单管理 | 订单审核（通过/驳回）、订单结算 | `/orders` |
| 佣金管理 | 佣金记录查看 | `/commissions` |
| 员工管理 | 创建员工账号、查看员工列表 | `/employees` |
| 个人中心 | 个人信息修改 | `/profile` |

**路由配置** (`apps/manager/src/router/index.ts`)：

```typescript
// 路由守卫：验证经理登录状态
// 布局组件：ManagerLayout.vue
// 主要页面：DashboardView, ProductListView, ProductEditView, CommissionListView, ProfileView
```

**核心组件**：

- `ManagerLayout.vue` - 经理后台布局
- `ProductListView.vue` - 产品列表管理
- `ProductEditView.vue` - 产品编辑（富文本编辑器）
- `CommissionListView.vue` - 佣金记录
- `RichTextEditor.vue` - 富文本编辑器组件

---

### 5.3 用户端 (apps/user)

**功能定位**：面向普通用户的移动端应用，用于浏览产品和做单。

**主要功能**：

| 模块 | 功能点 | 路由 |
|------|--------|------|
| 首页 | 产品列表、分类筛选 | `/` |
| 产品详情 | 产品信息、做单入口 | `/product/:id` |
| 登录注册 | 手机号+密码登录、短信验证码登录、注册 | `/login` |
| 个人中心 | 个人信息、做单记录、佣金查看 | `/profile` |
| 员工入口 | 员工账号登录 | `/employee-login` |

**布局组件**：

- `TabbarLayout.vue` - 底部导航布局（首页、佣金、我的）
- 底部Tab：首页、佣金、我的

**核心页面**：

- `HomeView.vue` - 首页产品列表
- `ProductDetailView.vue` - 产品详情页
- `LoginView.vue` - 用户登录/注册
- `ProfileView.vue` - 个人中心
- `CommissionView.vue` - 佣金查看
- `EmployeeLoginView.vue` - 员工登录
- `EmployeeProfileView.vue` - 员工个人中心

---

### 5.4 后端API服务 (apps/api)

**技术架构**：Express + TypeScript

**存储策略**：
- **优先模式**：MySQL数据库（配置环境变量启用）
- **降级模式**：JSON文件存储（默认启用）

**入口文件**：`apps/api/src/index.ts`（1846行，包含所有业务逻辑）

#### 5.4.1 主要接口分组

| 接口组 | 路径前缀 | 功能说明 |
|--------|----------|----------|
| 产品接口 | `/api/products` | 产品的CRUD操作 |
| 经理接口 | `/api/managers` | 经理的登录、注册、管理 |
| 用户接口 | `/api/users` | 用户的登录、注册、管理 |
| 订单接口 | `/api/orders` | 做单、订单审核、结算 |
| 佣金接口 | `/api/commissions` | 佣金记录管理 |
| 管理员接口 | `/api/admin` | 管理员登录、操作日志 |
| 员工接口 | `/api/employees` | 员工子账户管理 |
| 文件接口 | `/api/upload` | 图片上传服务 |
| 短信接口 | `/api/*/sms/*` | 短信验证码发送与验证 |

#### 5.4.2 核心路由处理函数

**产品相关**：

```typescript
// 获取产品列表（支持分页、分类、状态筛选）
app.get('/api/products')

// 获取产品详情
app.get('/api/products/:id')

// 创建产品
app.post('/api/products')

// 更新产品
app.put('/api/products/:id')

// 删除产品
app.delete('/api/products/:id')

// 经理仪表盘统计
app.get('/api/stats/dashboard')
```

**订单相关**：

```typescript
// 用户做单（扣减库存）
app.post('/api/orders')

// 获取订单列表（按用户/经理筛选）
app.get('/api/orders')

// 获取订单统计
app.get('/api/orders/stats')

// 经理审核订单（通过/驳回）
app.put('/api/orders/:id/review')

// 经理结算操作（待付款/已结算）
app.put('/api/orders/:id/settle')

// 删除订单（管理后台）
app.delete('/api/orders/:id')
```

**认证相关**：

```typescript
// 经理登录
app.post('/api/managers/login')

// 经理短信验证码登录
app.post('/api/managers/sms/login')

// 用户登录
app.post('/api/users/login')

// 用户短信验证码登录/注册
app.post('/api/users/sms/login')

// 管理员登录
app.post('/api/admin/login')

// 管理员短信验证码登录
app.post('/api/admin/sms/login')
```

---

## 6. 数据库设计

### 6.1 实体关系图

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  Managers   │       │   Users     │       │   Admins    │
│  (渠道经理)  │       │  (普通用户)  │       │  (管理员)    │
└──────┬──────┘       └──────┬──────┘       └─────────────┘
       │                    │
       │ 1:N                │ 1:N
       ▼                    ▼
┌─────────────┐       ┌─────────────┐
│  Products   │       │   Orders    │
│   (产品)    │       │   (订单)    │
└──────┬──────┘       └──────┬──────┘
       │                    │
       │                    │ N:1
       │                    ▼
       │             ┌─────────────┐
       └────────────▶│ Commissions │
                     │   (佣金)    │
                     └─────────────┘
```

### 6.2 数据表结构

#### 6.2.1 产品表 (products)

```sql
CREATE TABLE products (
  id VARCHAR(100) PRIMARY KEY,
  title VARCHAR(500) NOT NULL,           -- 产品标题
  description TEXT,                      -- 产品描述
  coverImage VARCHAR(1000),              -- 封面图
  images JSON,                           -- 图片列表
  price DECIMAL(10,2),                   -- 产品价格（同时作为佣金基数）
  originalPrice DECIMAL(10,2),           -- 原价
  category VARCHAR(100),                 -- 分类
  status VARCHAR(50),                   -- 状态：draft/published/archived/offline/admin_offline
  managerId VARCHAR(100),                -- 所属经理ID
  stock INT,                             -- 库存（0或空表示不限）
  options JSON,                          -- 选项配置
  publishedBy VARCHAR(200),              -- 发布人
  publishedAt DATETIME,                  -- 发布时间
  offlineReason TEXT,                    -- 下架原因
  offlineAt DATETIME,                     -- 下架时间
  requireName TINYINT(1),                -- 是否需要姓名
  requirePhone TINYINT(1),              -- 是否需要手机号
  createdAt DATETIME,
  updatedAt DATETIME
);
```

#### 6.2.2 渠道经理表 (managers)

```sql
CREATE TABLE managers (
  id VARCHAR(100) PRIMARY KEY,
  username VARCHAR(200) NOT NULL,       -- 用户名
  password VARCHAR(500) NOT NULL,        -- 密码
  name VARCHAR(200),                     -- 姓名
  phone VARCHAR(50),                     -- 手机号
  teamName VARCHAR(200),                -- 团队名称
  status VARCHAR(50),                   -- 状态：active/disabled
  createdAt DATETIME,
  updatedAt DATETIME
);
```

#### 6.2.3 普通用户表 (users)

```sql
CREATE TABLE users (
  id VARCHAR(100) PRIMARY KEY,
  phone VARCHAR(50),                    -- 手机号
  password VARCHAR(500),                 -- 密码（短信登录时为空）
  nickname VARCHAR(200),                 -- 昵称
  teamName VARCHAR(200),                 -- 团队名称
  role VARCHAR(50),                     -- 角色：user
  status VARCHAR(50),                   -- 状态：active/disabled
  alipayUserId VARCHAR(200),            -- 支付宝用户ID
  wechatOpenId VARCHAR(200),            -- 微信OpenID
  loginMethods JSON,                    -- 登录方式列表
  createdAt DATETIME,
  updatedAt DATETIME
);
```

#### 6.2.4 订单表 (orders)

```sql
CREATE TABLE orders (
  id VARCHAR(100) PRIMARY KEY,
  productId VARCHAR(100),               -- 产品ID
  userId VARCHAR(100),                  -- 做单用户ID
  managerId VARCHAR(100),                -- 所属经理ID
  productName VARCHAR(500),              -- 产品名称（冗余）
  productPrice DECIMAL(10,2),           -- 产品价格（冗余）
  optionLabel VARCHAR(500),              -- 选择的选项
  redirectUrl VARCHAR(2000),             -- 跳转链接
  userName VARCHAR(200),                 -- 用户填写的姓名
  userPhone VARCHAR(50),                 -- 用户填写的手机号
  teamName VARCHAR(200),                -- 做单用户团队名称
  status VARCHAR(50),                   -- 状态：pending/approved/rejected/pending_payment/settled
  reviewedAt DATETIME,                   -- 审核时间
  rejectReason TEXT,                     -- 驳回原因
  addedToPaymentAt DATETIME,            -- 添加到待付款时间
  settledAt DATETIME,                    -- 结算时间
  transferredFromManager VARCHAR(200),  -- 订单转移来源经理
  transferredAt DATETIME,               -- 订单转移时间
  managedBy VARCHAR(50),               -- 管理方：manager/admin
  createdAt DATETIME
);
```

#### 6.2.5 佣金表 (commissions)

```sql
CREATE TABLE commissions (
  id VARCHAR(100) PRIMARY KEY,
  orderId VARCHAR(100),                 -- 关联订单ID
  userId VARCHAR(100),                  -- 用户ID
  managerId VARCHAR(100),               -- 经理ID
  productName VARCHAR(500),              -- 产品名称
  amount DECIMAL(10,2),                 -- 佣金金额
  status VARCHAR(50),                   -- 状态：pending/paid/rejected
  createdAt DATETIME,
  approvedAt DATETIME,
  paidAt DATETIME
);
```

#### 6.2.6 员工子账户表 (employees)

```sql
CREATE TABLE employees (
  id VARCHAR(100) PRIMARY KEY,
  userId VARCHAR(100) NOT NULL,         -- 主账户ID
  phone VARCHAR(50) NOT NULL,           -- 员工手机号
  password VARCHAR(500) NOT NULL,       -- 密码
  nickname VARCHAR(200),                -- 昵称
  expiresAt DATETIME,                   -- 账户过期时间
  status VARCHAR(50),                   -- 状态：active
  createdAt DATETIME,
  updatedAt DATETIME,
  INDEX idx_userId (userId),
  INDEX idx_phone (phone),
  INDEX idx_expiresAt (expiresAt)
);
```

#### 6.2.7 管理员表 (admins)

```sql
CREATE TABLE admins (
  id VARCHAR(100) PRIMARY KEY,
  phone VARCHAR(50) NOT NULL,           -- 手机号
  password VARCHAR(500) NOT NULL,       -- 密码
  name VARCHAR(200),                    -- 姓名
  status VARCHAR(50),                   -- 状态
  createdAt DATETIME,
  updatedAt DATETIME
);
```

**默认管理员账号**：
- 通过环境变量配置：
  - `ADMIN_PHONE`：管理员手机号
  - `ADMIN_PASSWORD`：管理员密码
  - `ADMIN_NAME`：管理员姓名（可选，默认为"超级管理员"）
- 首次启动时会自动创建默认管理员账号

#### 6.2.8 操作日志表 (operation_logs)

```sql
CREATE TABLE operation_logs (
  id VARCHAR(100) PRIMARY KEY,
  adminId VARCHAR(100),                 -- 管理员ID
  adminPhone VARCHAR(50),               -- 管理员手机号
  adminName VARCHAR(200),               -- 管理员姓名
  operationType VARCHAR(100),          -- 操作类型
  targetType VARCHAR(100),              -- 目标类型
  targetId VARCHAR(100),               -- 目标ID
  targetName VARCHAR(500),             -- 目标名称
  reason VARCHAR(1000),                -- 操作原因
  detail TEXT,                          -- 详细信息
  createdAt DATETIME
);
```

### 6.3 状态流转

#### 6.3.1 产品状态流转

```
draft ──发布──▶ published ──经理禁用──▶ offline
  │                │                    │
  │                │                admin_offline
  │                │                    ▲
  │                └──管理员下架──▶────┘
  └──编辑──▶draft
```

#### 6.3.2 订单状态流转

```
pending ──审核通过──▶ approved ──添加待付款──▶ pending_payment ──确认结算──▶ settled
    │                     │
    │                     └──▶（同时生成佣金记录，状态pending）
    │
    └──审核驳回──▶ rejected（库存退回）
```

#### 6.3.3 佣金状态流转

```
pending ──发放──▶ paid
    │
    └──驳回──▶ rejected
```

---

## 7. API接口文档

### 7.1 统一响应格式

```typescript
interface ApiResponse<T = any> {
  code: number      // 0=成功，非0=失败
  message: string   // 消息描述
  data: T          // 响应数据
}

interface PaginatedResponse<T> {
  list: T[]        // 数据列表
  total: number    // 总记录数
  page: number     // 当前页码
  pageSize: number // 每页条数
}
```

### 7.2 产品接口

#### 获取产品列表

```
GET /api/products

Query Parameters:
- page: number (default: 1)
- pageSize: number (default: 10)
- category: string (optional)
- status: string (optional, manager端)
- managerId: string (optional, 经理ID)

Response:
{
  code: 0,
  message: 'success',
  data: {
    list: Product[],
    total: number,
    page: number,
    pageSize: number
  }
}
```

#### 获取产品详情

```
GET /api/products/:id

Response:
{
  code: 0,
  message: 'success',
  data: Product & { sales: number }
}
```

#### 创建产品

```
POST /api/products

Body:
{
  title: string           // 必填
  description: string
  coverImage: string
  images: string[]
  price: number
  originalPrice?: number
  category: string
  status?: 'draft' | 'published'
  stock?: number
  options?: any[]
  requireName?: boolean
  requirePhone?: boolean
}

Response:
{
  code: 0,
  message: '创建成功',
  data: Product
}
```

#### 更新产品

```
PUT /api/products/:id

Body: (同创建，字段可选)
```

#### 删除产品

```
DELETE /api/products/:id

Query: managerId (optional, 验证产品归属)
```

### 7.3 订单接口

#### 用户做单

```
POST /api/orders

Body:
{
  productId: string         // 必填
  userId?: string           // 做单用户ID
  employeeId?: string       // 员工ID（员工做单时）
  optionLabel?: string      // 选择的选项
  redirectUrl?: string      // 跳转链接
  userName?: string         // 用户姓名
  userPhone?: string        // 用户手机号
}

Response:
{
  code: 0,
  message: '做单成功',
  data: {
    order: Order,
    remainingStock: number  // 剩余库存，-1表示不限
  }
}
```

#### 获取订单列表

```
GET /api/orders

Query:
- userId: string (optional, 用户端)
- managerId: string (optional, 经理端)
- status: string (optional)
- page: number
- pageSize: number
- managedBy: string (optional, admin)
```

#### 审核订单

```
PUT /api/orders/:id/review

Body:
{
  action: 'approve' | 'reject'  // 必填
  reason?: string                // 驳回原因
}

Response:
{
  code: 0,
  message: '审核通过' | '已驳回',
  data: Order
}
```

#### 结算订单

```
PUT /api/orders/:id/settle

Body:
{
  action: 'pending_payment' | 'paid'  // 必填
}
```

### 7.4 认证接口

#### 用户注册

```
POST /api/users/register

Body:
{
  phone: string
  password: string
  nickname?: string
  teamName?: string
}
```

#### 用户登录

```
POST /api/users/login

Body:
{
  phone: string
  password: string
}
```

#### 短信验证码登录

```
POST /api/users/sms/login

Body:
{
  phone: string
  code: string
  teamName?: string  // 新用户注册时可选
}

Response:
{
  code: 0,
  message: '登录成功',
  data: {
    token: string,
    user: User,
    isNew: boolean  // 是否新注册用户
  }
}
```

#### 经理登录

```
POST /api/managers/login

Body:
{
  phone: string
  password: string
}
```

### 7.5 管理员接口

#### 管理员登录

```
POST /api/admin/login

Body:
{
  phone: string
  password: string
}
```

#### 管理员全局统计

```
GET /api/admin/stats

Response:
{
  code: 0,
  data: {
    managerCount: number      // 经理数量
    userCount: number         // 用户数量
    publishedProductCount: number  // 上架产品数
    totalCommission: number   // 佣金总额
  }
}
```

### 7.6 员工接口

#### 创建员工

```
POST /api/employees

Body:
{
  userId: string         // 主账户ID
  phone: string          // 员工手机号
  password: string       // 密码（至少6位）
  nickname?: string       // 昵称
  expiresHours: number    // 有效期（小时，至少1）
}
```

#### 员工登录

```
POST /api/employees/login

Body:
{
  phone: string
  password: string
}
```

### 7.7 文件上传接口

```
POST /api/upload

Content-Type: multipart/form-data

Body:
- file: File

Response:
{
  code: 0,
  message: '上传成功',
  data: {
    url: string,          // 访问路径
    filename: string      // 文件名
  }
}

限制：
- 最大文件大小：5MB
- 访问路径：/api/uploads/:filename
```

---

## 8. 共享包说明

### 8.1 包结构

```
packages/shared/
├── src/
│   ├── index.ts              # 统一导出
│   ├── types/
│   │   └── index.ts         # 全局类型定义
│   ├── stores/
│   │   ├── auth.ts          # 认证Store
│   │   ├── user.ts          # 用户Store
│   │   ├── product.ts       # 产品Store
│   │   └── commission.ts     # 佣金Store
│   └── utils/
│       ├── request.ts       # HTTP请求封装
│       ├── helpers.ts       # 工具函数
│       └── constants.ts     # 常量定义
└── package.json
```

### 8.2 类型定义 (types/index.ts)

```typescript
// 用户角色
enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user'
}

// 用户接口
interface User {
  id: string
  name: string
  phone: string
  avatar?: string
  role: UserRole
  status: 'active' | 'inactive' | 'banned'
  createdAt: string
  updatedAt: string
}

// 产品接口
interface Product {
  id: string
  title: string
  description: string
  coverImage: string
  images?: string[]
  price: number
  originalPrice?: number
  category: string
  status: 'draft' | 'published' | 'archived'
  publishedBy: string
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

// 佣金接口
interface Commission {
  id: string
  userId: string
  userName: string
  productId: string
  productTitle: string
  amount: number
  status: CommissionStatus
  approvedBy?: string
  approvedAt?: string
  paidAt?: string
  createdAt: string
  updatedAt: string
}

// 通用响应
interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

// 分页响应
interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}
```

### 8.3 HTTP请求封装 (utils/request.ts)

```typescript
// 基于Axios封装，统一处理：
// 1. 请求拦截：自动携带Token
// 2. 响应拦截：统一错误处理、401跳转登录
// 3. 统一响应格式

import { get, post, put, del } from './request'

// 使用示例
const res = await get<PaginatedResponse<Product>>('/products', { page: 1, pageSize: 10 })
const res = await post<User>('/users/login', { phone, password })
```

**请求拦截器**：

```typescript
instance.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

**响应拦截器**：

```typescript
instance.interceptors.response.use(response => {
  const { code, message } = response.data
  if (code === 0) return response
  // 401处理：清除Token并刷新页面
  if (code === 401 && !window.location.pathname.includes('/login')) {
    localStorage.removeItem('token')
    window.location.reload()
  }
  return Promise.reject(new Error(message))
})
```

### 8.4 工具函数 (utils/helpers.ts)

| 函数 | 说明 | 示例 |
|------|------|------|
| `formatMoney(value)` | 格式化金额为CNY | `formatMoney(100)` → `¥100.00` |
| `formatDate(date, format)` | 格式化日期（北京时区） | `formatDate('2024-01-01', 'YYYY-MM-DD')` |
| `maskPhone(phone)` | 手机号脱敏 | `maskPhone('13812345678')` → `138****5678` |
| `copyToClipboard(text)` | 复制到剪贴板 | 返回Promise<boolean> |

**状态映射常量**：

```typescript
// 佣金状态映射
commissionStatusMap: {
  pending: { label: '待审核', color: '#f59e0b' },
  approved: { label: '已通过', color: '#3b82f6' },
  paid: { label: '已发放', color: '#10b981' },
  rejected: { label: '已驳回', color: '#ef4444' }
}

// 用户状态映射
userStatusMap: {
  active: { label: '正常', color: '#10b981' },
  inactive: { label: '未激活', color: '#9ca3af' },
  banned: { label: '已封禁', color: '#ef4444' }
}
```

### 8.5 Pinia状态管理 (stores/)

#### 8.5.1 认证Store (auth.ts)

```typescript
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>('')
  const user = ref<User | null>(null)
  
  const isLoggedIn = computed(() => !!token.value)
  const userRole = computed(() => user.value?.role)
  
  // 方法
  async function login(params: LoginParams): Promise<LoginResult>
  async function logout(): Promise<void>
  async function fetchCurrentUser(): Promise<User>
  
  return { token, user, isLoggedIn, userRole, login, logout, fetchCurrentUser }
})
```

#### 8.5.2 产品Store (product.ts)

```typescript
export const useProductStore = defineStore('product', () => {
  const products = ref<Product[]>([])
  const currentProduct = ref<Product | null>(null)
  const total = ref(0)
  const loading = ref(false)
  
  // 方法
  async function fetchProducts(params: PaginationParams & { status?: string; keyword?: string })
  async function fetchProduct(id: string): Promise<Product>
  async function createProduct(data: Partial<Product>): Promise<Product>
  async function updateProduct(id: string, data: Partial<Product>): Promise<Product>
  async function deleteProduct(id: string): Promise<void>
  
  return { products, currentProduct, total, loading, fetchProducts, fetchProduct, createProduct, updateProduct, deleteProduct }
})
```

#### 8.5.3 用户Store (user.ts)

```typescript
export const useUserStore = defineStore('user', () => {
  const users = ref<User[]>([])
  const managers = ref<Manager[]>([])
  const total = ref(0)
  const loading = ref(false)
  
  // 方法
  async function fetchUsers(params: PaginationParams & { keyword?: string; status?: string })
  async function fetchManagers(params: PaginationParams & { keyword?: string })
  async function createUser(data: Partial<User>): Promise<User>
  async function updateUser(id: string, data: Partial<User>): Promise<User>
  async function deleteUser(id: string): Promise<void>
  
  return { users, managers, total, loading, fetchUsers, fetchManagers, createUser, updateUser, deleteUser }
})
```

#### 8.5.4 佣金Store (commission.ts)

```typescript
export const useCommissionStore = defineStore('commission', () => {
  const commissions = ref<Commission[]>([])
  const summary = ref<CommissionSummary>({ total: 0, pending: 0, approved: 0, paid: 0 })
  const total = ref(0)
  const loading = ref(false)
  
  // 方法
  async function fetchCommissions(params: PaginationParams & { status?: string })
  async function fetchSummary(): Promise<CommissionSummary>
  async function approveCommission(id: string): Promise<void>
  async function rejectCommission(id: string, reason: string): Promise<void>
  async function claimCommission(id: string): Promise<void>
  
  return { commissions, summary, total, loading, fetchCommissions, fetchSummary, approveCommission, rejectCommission, claimCommission }
})
```

---

## 9. 部署指南

### 9.1 自动化部署流程

```
代码推送 → GitHub Actions 构建 → SCP上传到服务器 → Nginx重载
```

### 9.2 服务器配置要求

- 操作系统：Linux (Ubuntu/CentOS)
- Node.js：>= 18.x
- Nginx：最新稳定版
- 域名/子路径配置

### 9.3 环境变量配置

#### API服务环境变量 (.env)

```env
# 端口配置
PORT=3000

# 数据存储目录
DATA_DIR=./data

# MySQL数据库（可选，启用则优先使用数据库）
DB_HOST=your_mysql_host
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=promo_hub

# 短信服务（如果使用）
SMS_API_KEY=your_api_key
SMS_API_SECRET=your_secret
```

#### 前端环境变量 (.env.local)

```env
# API基础地址
VITE_API_BASE_URL=/api
VITE_APP_TITLE=推广管理系统
```

### 9.4 Nginx配置

```nginx
server {
    listen 80;
    server_name your_domain_or_ip;

    # 管理后台
    location / {
        root /var/www/promo-hub/admin;
        try_files $uri $uri/ /index.html;
    }

    # 经理后台
    location /manager {
        alias /var/www/promo-hub/manager;
        try_files $uri $uri/ /manager/index.html;
    }

    # 用户端
    location /user {
        alias /var/www/promo-hub/user;
        try_files $uri $uri/ /user/index.html;
    }

    # API服务代理
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 上传文件访问
    location /api/uploads {
        alias /path/to/data/uploads;
        expires 30d;
    }
}
```

### 9.5 访问地址

部署完成后：

| 应用 | 访问地址 |
|------|----------|
| 管理员后台 | `http://服务器IP/` |
| 经理后台 | `http://服务器IP/manager/` |
| 用户端 | `http://服务器IP/user/` |

---

## 10. 开发指南

### 10.1 环境准备

```bash
# 1. 安装Node.js (>=18)
node -v  # v18.x.x 或更高

# 2. 安装pnpm
npm install -g pnpm
pnpm -v  # 9.x.x

# 3. 安装依赖
pnpm install
```

### 10.2 开发命令

```bash
# 启动开发服务器
pnpm dev:admin      # 管理员后台 → http://localhost:3001
pnpm dev:manager    # 渠道经理后台 → http://localhost:3002
pnpm dev:user       # 用户端 → http://localhost:3003

# 启动后端API服务
cd apps/api
pnpm dev  # → http://localhost:3000

# 构建生产版本
pnpm build:admin
pnpm build:manager
pnpm build:user

# 类型检查
pnpm type-check

# 代码规范检查
pnpm lint
```

### 10.3 项目启动顺序

1. **启动API服务**（必须先启动）
   ```bash
   cd apps/api
   pnpm dev
   ```

2. **启动前端应用**（可同时启动多个）
   ```bash
   pnpm dev:admin    # 管理员后台
   pnpm dev:manager  # 经理后台
   pnpm dev:user     # 用户端
   ```

### 10.4 前端开发注意事项

#### 添加新页面

1. 在对应应用的 `views/` 目录下创建页面组件
2. 在 `router/index.ts` 中注册路由
3. 添加路由守卫（如果需要登录验证）

```typescript
// apps/admin/src/router/index.ts
{
  path: '/new-page',
  component: () => import('../views/NewPageView.vue'),
  meta: { requiresAuth: true }
}
```

#### 使用共享Store

```typescript
import { useProductStore } from '@promo/shared/stores/product'
import { useAuthStore } from '@promo/shared/stores/auth'

const productStore = useProductStore()
const authStore = useAuthStore()
```

#### 发送API请求

```typescript
import { get, post, put, del } from '@promo/shared/utils/request'
import type { Product, ApiResponse, PaginatedResponse } from '@promo/shared/types'

// GET请求
const res = await get<PaginatedResponse<Product>>('/products', { page: 1 })
console.log(res.data.list)

// POST请求
const res = await post<Product>('/products', { title: '新产品' })
```

### 10.5 后端开发注意事项

#### 添加新路由

在 `apps/api/src/index.ts` 中添加：

```typescript
// 路由定义
app.get('/api/new-endpoint', async (req, res) => {
  try {
    // 业务逻辑
    res.json({ code: 0, message: 'success', data: result })
  } catch (error) {
    console.error('[NewEndpoint] Error:', error)
    res.json({ code: 500, message: '服务器错误', data: null })
  }
})
```

#### 使用数据库

```typescript
import { query, queryOne } from './db.js'

// 查询列表
const rows = await query('SELECT * FROM products WHERE status = ?', ['published'])

// 查询单个
const row = await queryOne('SELECT * FROM products WHERE id = ?', [id])
```

#### 文件存储模式

```typescript
import { readProducts, writeProducts } from './data.js'

// 读取数据
const products = await readProducts()

// 写入数据
products.push(newProduct)
await writeProducts(products)
```

### 10.6 调试技巧

#### 前端调试

- 使用Vue DevTools查看组件状态和Pinia Store
- 使用浏览器开发者工具Network面板查看API请求
- 添加console.log或断点调试

#### 后端调试

- 查看终端日志输出
- 添加console.log打印关键变量
- 使用Postman/curl测试API接口

### 10.7 常见问题

#### 1. 依赖安装失败

```bash
# 清理缓存并重新安装
pnpm store prune
rm -rf node_modules
pnpm install
```

#### 2. TypeScript类型错误

```bash
# 重新生成类型声明
pnpm build:shared
```

#### 3. API服务启动失败

检查端口占用：
```bash
lsof -i :3000
```

#### 4. 数据库连接失败

确认MySQL服务运行中，并检查环境变量配置。

---

## 附录

### A. 关键依赖版本

| 包名 | 版本 | 用途 |
|------|------|------|
| vue | ^3.5.0 | 前端框架 |
| vue-router | ^4.4.0 | 路由管理 |
| pinia | ^2.2.0 | 状态管理 |
| element-plus | ^2.9.0 | PC端UI |
| vant | ^4.9.0 | 移动端UI |
| express | ^4.21.0 | 后端框架 |
| mysql2 | ^3.22.3 | MySQL驱动 |
| axios | ^1.7.0 | HTTP客户端 |

### B. 项目约定

1. **命名规范**：
   - 组件名：PascalCase（如 `UserListView.vue`）
   - 函数名：camelCase（如 `fetchProducts`）
   - 常量：UPPER_SNAKE_CASE（如 `DEFAULT_PAGE_SIZE`）

2. **代码风格**：
   - 使用TypeScript strict模式
   - 组件使用 `<script setup>` 语法
   - 样式使用 Scoped CSS 或 SCSS

3. **Git提交规范**：
   - `feat:` 新功能
   - `fix:` 修复bug
   - `docs:` 文档更新
   - `refactor:` 重构
   - `chore:` 构建/工具变动

### C. 相关文档

- [Vue 3 文档](https://vuejs.org/)
- [TypeScript 文档](https://www.typescriptlang.org/)
- [Element Plus 文档](https://element-plus.org/)
- [Vant 文档](https://vant-contrib.gitee.io/vant/)
- [Express 文档](https://expressjs.com/)
- [Pinia 文档](https://pinia.vuejs.org/)

---

**文档版本**：1.0.0
**最后更新**：2024年
**维护者**：Promo Hub Team
