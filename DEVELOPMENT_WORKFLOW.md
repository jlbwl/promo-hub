# 开发工作流指南

本文档描述了 Promo-Hub 项目的标准开发工作流程，旨在确保本地开发环境与 CI/CD 部署环境的一致性，避免环境差异导致的问题。

## 目录

- [分支策略](#分支策略)
- [环境配置](#环境配置)
- [开发流程](#开发流程)
- [提交规范](#提交规范)
- [CI/CD 流程](#cicd-流程)

---

## 分支策略

我们使用 Git Flow 简化版本的分支策略：

### 主要分支

- **`main`**: 生产环境分支，稳定版本，只能通过 PR 合并
- **`develop`**: 开发环境分支，集成最新功能的测试分支

### 辅助分支

- **`feature/*`**: 新功能开发分支
- **`bugfix/*`**: Bug 修复分支
- **`hotfix/*`**: 生产环境紧急修复分支

---

## 环境配置

### 1. 环境配置文件隔离

所有环境配置文件（`.env`）已在 `.gitignore` 中配置，不会被提交到 Git。

### 2. 环境配置模板

我们为不同环境提供了配置模板：

- **开发环境**: `config/environments/.env.dev.template`
- **测试环境**: `config/environments/.env.test.template`
- **生产环境**: `config/environments/.env.prod.template`

### 3. 快速初始化环境

使用提供的脚本快速设置开发环境：

#### macOS/Linux
```bash
pnpm setup:env
```

#### Windows
```powershell
pnpm setup:env:win
```

脚本会：
1. 检测是否已存在 `.env` 文件
2. 让你选择要初始化的环境（dev/test/prod）
3. 复制对应的配置模板到各应用目录
4. 提示你编辑配置文件填入真实值

### 4. 手动配置

如果需要手动配置：

```bash
# 复制 API 环境配置
cp config/environments/.env.dev.template apps/api/.env

# 复制前端环境配置
cp config/environments/.env.frontend.dev.template apps/admin/.env
cp config/environments/.env.frontend.dev.template apps/manager/.env
cp config/environments/.env.frontend.dev.template apps/user/.env

# 编辑各 .env 文件，填入真实的配置值
```

### 5. 必须配置的环境变量

#### API 服务
- `DB_HOST`: 数据库主机
- `DB_PORT`: 数据库端口
- `DB_USER`: 数据库用户
- `DB_PASSWORD`: 数据库密码
- `DB_NAME`: 数据库名称
- `SESSION_SECRET`: Session 密钥（生产环境必须使用强随机字符串）
- `ADMIN_PHONE`: 默认管理员手机号
- `ADMIN_PASSWORD`: 默认管理员密码

#### 前端应用
- `VITE_API_BASE_URL`: API 服务地址
- `VITE_ICP_NUMBER`: ICP 备案号（可选）

---

## 开发流程

### 标准开发流程

1. **拉取最新代码**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **创建功能分支**
   ```bash
   # 新功能
   git checkout -b feature/your-feature-name

   # Bug 修复
   git checkout -b bugfix/your-bugfix-name
   ```

3. **设置开发环境**
   ```bash
   # 初始化环境（首次）
   pnpm setup:env

   # 安装依赖
   pnpm install
   ```

4. **开发调试**
   ```bash
   # 启动所有开发服务
   pnpm dev

   # 或单独启动
   pnpm dev:admin    # 管理后台
   pnpm dev:manager  # 经理端
   pnpm dev:user     # 用户端
   pnpm dev:api      # API 服务
   ```

5. **代码检查和测试**
   ```bash
   # 类型检查
   pnpm type-check

   # 代码规范检查
   pnpm lint

   # 自动修复规范问题
   pnpm lint:fix

   # 运行测试
   pnpm test
   ```

6. **提交代码**
   ```bash
   git add .
   git commit -m "feat: 添加新功能"
   git push origin feature/your-feature-name
   ```

7. **创建 Pull Request**
   - 在 GitHub 上创建 PR 到 `develop` 或 `main` 分支
   - 等待 CI 检查通过
   - 代码审查后合并

---

## 提交规范

### Commit Message 格式

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具链相关

### 示例

```bash
git commit -m "feat(admin): 添加用户管理功能"
git commit -m "fix(api): 修复登录验证逻辑"
git commit -m "docs: 更新开发文档"
```

---

## CI/CD 流程

### 1. CI 检查（每次 Push）

当代码推送到任何分支时，会自动触发 CI 检查：

- **代码质量检查**: 类型检查、Lint、测试
- **安全扫描**: 检查是否有敏感信息被提交（仅限 PR）

### 2. 部署流程

只有推送到 `main` 分支才会触发部署：

1. **部署前检查**: 确保没有敏感配置文件在 Git 中
2. **代码质量检查**: 运行所有测试和类型检查
3. **构建应用**: 为生产环境构建所有应用
4. **部署到服务器**: 上传文件到服务器并重启服务

### 3. 环境变量管理

生产环境的敏感信息通过 GitHub Secrets 管理，不会暴露在代码中：

- `SERVER_HOST`: 服务器主机
- `SERVER_USER`: 服务器用户
- `SERVER_SSH_KEY`: SSH 密钥
- `DB_HOST`: 数据库主机
- `DB_USER`: 数据库用户
- `DB_PASSWORD`: 数据库密码
- `SESSION_SECRET`: Session 密钥
- `ALIBABA_CLOUD_*`: 阿里云相关配置
- 等等...

---

## 常见问题

### Q: 本地开发正常，部署后报错？

A: 检查以下几点：
1. 确保所有环境变量都在 GitHub Secrets 中配置
2. 检查生产环境的 `.env` 配置是否正确
3. 查看 CI/CD 日志确认构建过程是否有错误

### Q: 如何防止 `.env` 文件被提交？

A: `.gitignore` 已经配置好了，但是你要确保：
1. 不要手动 `git add .env`
2. CI/CD 流程会检查是否有 `.env` 文件被提交，如果有会阻止部署

### Q: 如何切换环境配置？

A:
```bash
# 备份当前配置
cp apps/api/.env apps/api/.env.backup

# 复制新环境配置
cp config/environments/.env.test.template apps/api/.env
# 编辑填入测试环境配置
```

---

## 最佳实践

1. **永远不要提交 `.env` 文件**: 它们包含敏感信息
2. **总是使用环境配置模板**: 保持配置一致性
3. **在 PR 中进行代码审查**: 确保代码质量和安全性
4. **定期同步 `main` 分支**: 避免分支过时太久
5. **使用有意义的提交信息**: 方便后续追踪和回滚

---

## 相关文档

- [README.md](./README.md) - 项目概述
- [CODE_ORGANIZATION.md](./CODE_ORGANIZATION.md) - 代码组织规范
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - 部署指南
