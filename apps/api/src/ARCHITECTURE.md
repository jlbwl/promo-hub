# API 服务架构说明

## 目录结构

```
src/
├── controllers/     # 控制器层 - 处理 HTTP 请求/响应
│   ├── admin.controller.ts
│   ├── manager.controller.ts
│   ├── user.controller.ts
│   ├── employee.controller.ts
│   ├── product.controller.ts
│   ├── order.controller.ts
│   ├── cart.controller.ts
│   └── stats.controller.ts
├── middleware/      # 中间件 - 认证、限流、验证等
│   ├── auth.ts
│   ├── rateLimit.ts
│   └── validation.ts
├── routes/          # 路由层 - 定义 API 端点
│   ├── admin.routes.ts
│   ├── manager.routes.ts
│   ├── user.routes.ts
│   ├── employee.routes.ts
│   ├── product.routes.ts
│   ├── order.routes.ts
│   ├── cart.routes.ts
│   └── stats.routes.ts
├── utils/           # 工具函数 - 通用功能
│   ├── response.ts  # 响应格式
│   └── sms.ts       # 短信验证码
├── data.ts          # 数据访问层 - DB 操作
├── db.ts            # 数据库连接
└── index.ts         # 入口文件
```

## 分层说明

### 1. Controller 层 (controllers/)
职责：
- 处理 HTTP 请求（解析参数、验证输入）
- 调用业务逻辑
- 格式化并返回响应
- 不应该包含复杂的业务逻辑

### 2. Route 层 (routes/)
职责：
- 定义路由路径和 HTTP 方法
- 挂载中间件
- 连接 controller

### 3. Data 层 (data.ts)
职责：
- 封装所有数据库操作
- 不处理业务逻辑
- 使用纯 SQL

### 4. Middleware 层 (middleware/)
职责：
- 认证和授权
- 请求限流
- 参数验证
- 错误处理

### 5. Utils 层 (utils/)
职责：
- 通用工具函数
- 响应格式化
- 验证码生成/验证

## 迁移进度

- [x] 创建目录结构
- [x] 创建 utils 模块
- [x] 创建 admin controller & routes（示例）
- [x] 创建 manager controller & routes
- [x] 创建 user controller & routes
- [ ] 创建 employee controller & routes
- [ ] 创建 product controller & routes
- [ ] 创建 order controller & routes
- [ ] 创建 cart controller & routes
- [ ] 创建 stats controller & routes
- [ ] 重构 index.ts 为入口文件
- [ ] 删除旧代码
