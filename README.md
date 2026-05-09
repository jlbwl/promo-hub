# Promo Hub - 业务推广管理系统

基于 Vue 3 + TypeScript + Vite 的现代化推广管理系统，采用 pnpm Monorepo 架构。

## 📁 项目结构

```
├── apps/
│   ├── admin/          # 系统管理员后台 (Element Plus)
│   ├── manager/        # 渠道经理后台 (Element Plus)
│   └── user/           # 用户端 (Vant 4)
├── packages/
│   └── shared/         # 共享包（类型、Store、工具函数）
├── scripts/            # 部署脚本
└── .github/workflows/  # CI/CD 配置
```

## 🚀 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev:admin      # 管理员后台 → http://localhost:3001
pnpm dev:manager    # 渠道经理后台 → http://localhost:3002
pnpm dev:user       # 用户端 → http://localhost:3003

# 构建
pnpm build:admin
pnpm build:manager
pnpm build:user
```

## 🔄 CI/CD 自动部署

### 首次配置

1. **服务器初始化**（在阿里云服务器上执行一次）：
   ```bash
   scp scripts/setup-server.sh root@你的服务器IP:/tmp/
   ssh root@你的服务器IP "bash /tmp/setup-server.sh"
   ```

2. **配置 GitHub Secrets**（在仓库 Settings → Secrets and variables → Actions 中添加）：

   | Secret 名称 | 说明 | 示例 |
   |-------------|------|------|
   | `SERVER_HOST` | 服务器 IP 或域名 | `39.105.xx.xx` |
   | `SERVER_PORT` | SSH 端口 | `22` |
   | `SERVER_USER` | SSH 用户名 | `root` |
   | `SERVER_SSH_KEY` | SSH 私钥 | `-----BEGIN OPENSSH PRIVATE KEY-----...` |

3. **生成 SSH 密钥对**（如果没有）：
   ```bash
   ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/deploy_key
   # 将公钥添加到服务器
   ssh-copy-id -i ~/.ssh/deploy_key.pub root@你的服务器IP
   # 将私钥内容复制到 GitHub Secret SERVER_SSH_KEY
   cat ~/.ssh/deploy_key
   ```

### 部署流程

推送代码到 `main` 分支后自动触发：
```
代码推送 → GitHub Actions 构建 → SCP 上传到服务器 → Nginx 重载
```

也可在 GitHub Actions 页面手动触发部署。

### 访问地址

部署完成后：
- 管理员后台：`http://服务器IP/`
- 渠道经理后台：`http://服务器IP/manager/`
- 用户端：`http://服务器IP/user/`

## 🔧 环境变量

在各应用目录创建 `.env.local` 文件：

```env
VITE_API_BASE_URL=/api
VITE_APP_TITLE=推广管理系统
```
