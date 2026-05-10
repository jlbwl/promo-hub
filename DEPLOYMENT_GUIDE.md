# Promo Hub 自动化部署指南

## 📋 目录

1. [部署架构](#1-部署架构)
2. [快速开始](#2-快速开始)
3. [GitHub Secrets 配置](#3-github-secrets-配置)
4. [服务器初始化](#4-服务器初始化)
5. [CI/CD 流程详解](#5-cicd-流程详解)
6. [部署脚本使用](#6-部署脚本使用)
7. [环境变量配置](#7-环境变量配置)
8. [监控与日志](#8-监控与日志)
9. [故障排除](#9-故障排除)
10. [安全建议](#10-安全建议)

---

## 1. 部署架构

### 1.1 系统架构

```
GitHub Repository
      │
      │ Push to main branch
      ▼
GitHub Actions
      │
      ├──▶ Build Jobs (Parallel)
      │      ├──▶ Build Admin
      │      ├──▶ Build Manager
      │      ├──▶ Build User
      │      └──▶ Build API
      │
      └──▶ Deploy Job
             │
             ├──▶ SCP Upload (Parallel)
             │      ├──▶ Upload Admin
             │      ├──▶ Upload Manager
             │      ├──▶ Upload User
             │      └──▶ Upload API
             │
             └──▶ SSH Commands
                    ├──▶ Create .env file
                    ├──▶ Install dependencies
                    ├──▶ Start PM2 service
                    └──▶ Reload Nginx
                         │
                         ▼
                   Aliyun Server
                   ├── Nginx (Port 80)
                   │      ├── / → Admin App
                   │      ├── /manager/ → Manager App
                   │      ├── /user/ → User App
                   │      └── /api/ → API Proxy
                   │
                   └── PM2 (Port 3000)
                          └── API Service
```

### 1.2 目录结构

```
/www/wwwroot/promo-hub/
├── admin/               # 管理员后台
├── manager/            # 渠道经理后台
├── user/              # 用户端应用
├── api/               # API 服务
│   ├── dist/         # 构建产物
│   ├── data/         # 数据存储
│   │   └── uploads/  # 上传文件
│   ├── node_modules/ # 依赖
│   ├── package.json
│   └── .env          # 环境变量
├── backups/           # 版本备份
└── logs/             # 日志文件
```

### 1.3 访问地址

| 应用 | 路径 | 说明 |
|------|------|------|
| 管理员后台 | `/` | 系统管理员使用 |
| 渠道经理后台 | `/manager/` | 渠道经理使用 |
| 用户端 | `/user/` | 普通用户使用 |
| API服务 | `/api/` | 内部接口 |

---

## 2. 快速开始

### 2.1 一键部署流程

```bash
# 1. 首次：配置 GitHub Secrets（见第3章）

# 2. 推送代码到 main 分支
git add .
git commit -m "feat: 更新内容"
git push origin main

# 3. 等待 GitHub Actions 完成（约5-10分钟）

# 4. 访问你的服务器 IP 或域名
```

### 2.2 手动部署（如有特殊需求）

```bash
# 在本地构建
pnpm install
pnpm build:admin
pnpm build:manager
pnpm build:user
pnpm build:api

# 上传到服务器
scp -r apps/admin/dist/* user@your-server:/www/wwwroot/promo-hub/admin/
scp -r apps/manager/dist/* user@your-server:/www/wwwroot/promo-hub/manager/
scp -r apps/user/dist/* user@your-server:/www/wwwroot/promo-hub/user/
scp -r apps/api/dist/* user@your-server:/www/wwwroot/promo-hub/api/

# 在服务器上执行
ssh user@your-server
cd /www/wwwroot/promo-hub/api
npm install --production
pm2 restart promo-api
nginx -s reload
```

---

## 3. GitHub Secrets 配置

### 3.1 配置步骤

1. **进入仓库设置**
   - 打开 GitHub 仓库
   - 点击 `Settings` → `Secrets and variables` → `Actions`

2. **添加以下 Secrets**

| Secret 名称 | 必填 | 说明 | 示例 |
|------------|------|------|------|
| `SERVER_HOST` | ✅ | 服务器 IP 或域名 | `39.105.xx.xx` |
| `SERVER_PORT` | | SSH 端口 | `22`（默认） |
| `SERVER_USER` | ✅ | SSH 用户名 | `root` |
| `SERVER_SSH_KEY` | ✅ | SSH 私钥 | `-----BEGIN OPENSSH...` |
| `DB_HOST` | | MySQL 主机 | `rm-xxxx.mysql.rds.aliyuncs.com` |
| `DB_PORT` | | MySQL 端口 | `3306` |
| `DB_USER` | | MySQL 用户名 | `promo_user` |
| `DB_PASSWORD` | | MySQL 密码 | `your_password` |
| `DB_NAME` | | 数据库名 | `promo_hub` |
| `ALIBABA_CLOUD_ACCESS_KEY_ID` | | 阿里云 AccessKey ID | `LTAI5t...` |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | | 阿里云 AccessKey Secret | `Abc123...` |
| `ALIBABA_CLOUD_SMS_SIGN_NAME` | | 短信签名 | `推广管理系统` |
| `ALIBABA_CLOUD_SMS_TEMPLATE_CODE` | | 短信模板码 | `SMS_xxx` |

### 3.2 生成 SSH 密钥

```bash
# 1. 本地生成密钥对
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/deploy_key

# 2. 将公钥添加到服务器
ssh-copy-id -i ~/.ssh/deploy_key.pub root@your-server-ip

# 3. 将私钥内容复制到 GitHub Secret
cat ~/.ssh/deploy_key

# 4. 复制输出的内容，粘贴到 GitHub Secrets 的 SERVER_SSH_KEY
```

### 3.3 验证配置

在 GitHub 仓库中：
- 点击 `Actions` 标签
- 选择 `Deploy to Aliyun Server`
- 点击 `Run workflow`
- 查看执行日志确认配置正确

---

## 4. 服务器初始化

### 4.1 首次运行初始化脚本

```bash
# 1. 上传初始化脚本到服务器
scp scripts/setup-server.sh root@your-server:/tmp/

# 2. SSH 连接到服务器
ssh root@your-server

# 3. 运行初始化脚本
bash /tmp/setup-server.sh
```

### 4.2 初始化脚本功能

```bash
# 自动执行以下操作：
1. 安装 Nginx
2. 创建部署目录 /www/wwwroot/promo-hub
3. 配置 Nginx 反向代理
4. 配置防火墙（开放80端口）
5. 生成 SSL 证书（可选）
```

### 4.3 手动安装（如果脚本失败）

```bash
# 安装 Nginx
yum install -y nginx  # CentOS/RHEL
# 或
apt-get install -y nginx  # Ubuntu/Debian

# 启动并设置开机启动
systemctl start nginx
systemctl enable nginx

# 安装 Node.js 18+
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# 安装 PM2
npm install -g pm2

# 创建部署目录
mkdir -p /www/wwwroot/promo-hub/{admin,manager,user,api,backups,logs}
mkdir -p /www/wwwroot/promo-hub/api/data/uploads

# 设置权限
useradd -m -s /bin/bash promo
chown -R promo:promo /www/wwwroot/promo-hub
```

### 4.4 配置 Nginx

创建配置文件 `/etc/nginx/conf.d/promo-hub.conf`：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名，或用 _ 匹配所有
    
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    
    # 管理员后台
    location / {
        root /www/wwwroot/promo-hub/admin;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    # 渠道经理后台
    location /manager/ {
        alias /www/wwwroot/promo-hub/manager/;
        index index.html;
        try_files $uri $uri/ /manager/index.html;
    }
    
    # 用户端
    location /user/ {
        alias /www/wwwroot/promo-hub/user/;
        index index.html;
        try_files $uri $uri/ /user/index.html;
    }
    
    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 上传文件访问
    location /api/uploads/ {
        alias /www/wwwroot/promo-hub/api/data/uploads/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
    
    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /www/wwwroot/promo-hub;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 4.5 配置 SSL（HTTPS）

使用 Let's Encrypt 免费证书：

```bash
# 安装 certbot
yum install -y certbot python3-certbot-nginx

# 获取证书（替换为你的域名）
certbot --nginx -d your-domain.com

# 自动续期
echo "0 0 * * * certbot renew --quiet" | crontab -
```

或使用阿里云 SSL 证书，下载后在 Nginx 中配置：

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/your-domain.com.pem;
    ssl_certificate_key /path/to/your-domain.com.key;
    
    # 其他配置同上...
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 5. CI/CD 流程详解

### 5.1 工作流程文件

文件位置：[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)

### 5.2 构建阶段（Build）

```yaml
build:
  jobs:
    - name: Build Admin
      command: pnpm --filter @promo/admin build
      
    - name: Build Manager
      command: pnpm --filter @promo/manager build
      
    - name: Build User
      command: pnpm --filter @promo/user build
      
    - name: Build API
      command: pnpm --filter @promo/api build
```

**并行构建**：所有应用同时构建，加快速度

**产物上传**：使用 GitHub Actions Artifacts 保存构建产物

### 5.3 部署阶段（Deploy）

```yaml
deploy:
  needs: build  # 依赖构建阶段
  
  steps:
    - name: Upload to server via SCP
      # 使用 appleboy/scp-action 上传文件
      source: "admin-dist/*"
      target: "/www/wwwroot/promo-hub/admin"
      
    - name: SSH Commands
      # 执行服务器端操作
      - 创建 .env 文件
      - 安装依赖
      - 重启 PM2 服务
      - 重载 Nginx
```

### 5.4 执行顺序

```
1. 触发条件
   ├── Push to main branch
   └── Manual workflow dispatch

2. 构建阶段（并行）
   ├── Build Admin ──→ Upload Artifact
   ├── Build Manager ──→ Upload Artifact
   ├── Build User ──→ Upload Artifact
   └── Build API ──→ Upload Artifact

3. 部署阶段（顺序）
   ├── Download All Artifacts
   ├── Upload Admin to server
   ├── Upload Manager to server
   ├── Upload User to server
   ├── Upload API to server
   ├── Create .env file
   ├── npm install
   ├── pm2 restart
   ├── health check
   └── nginx reload
```

### 5.5 手动触发部署

1. 进入 GitHub 仓库
2. 点击 `Actions` 标签
3. 选择 `Deploy to Aliyun Server`
4. 点击 `Run workflow`
5. 可选择分支后点击运行

---

## 6. 部署脚本使用

### 6.1 服务器端部署脚本

文件位置：[`scripts/deploy.sh`](scripts/deploy.sh)

### 6.2 功能列表

| 命令 | 功能 | 说明 |
|------|------|------|
| `bash deploy.sh build` | 构建 | 本地构建所有应用 |
| `bash deploy.sh deploy` | 部署 | 部署已构建的应用 |
| `bash deploy.sh all` | 全量 | 构建并部署 |
| `bash deploy.sh rollback` | 回滚 | 回滚到上一版本 |
| `bash deploy.sh status` | 状态 | 查看服务状态 |
| `bash deploy.sh logs` | 日志 | 查看 API 日志 |
| `bash deploy.sh restart` | 重启 | 重启所有服务 |
| `bash deploy.sh backup` | 备份 | 备份所有应用 |

### 6.3 使用示例

```bash
# SSH 到服务器
ssh root@your-server

# 查看帮助
bash /www/wwwroot/promo-hub/scripts/deploy.sh help

# 查看服务状态
bash /www/wwwroot/promo-hub/scripts/deploy.sh status

# 查看最近 100 行日志
bash /www/wwwroot/promo-hub/scripts/deploy.sh logs 100

# 回滚到上一版本
bash /www/wwwroot/promo-hub/scripts/deploy.sh rollback

# 只回滚某个应用
bash /www/wwwroot/promo-hub/scripts/deploy.sh rollback admin
```

### 6.4 备份策略

- **自动备份**：每次部署前自动备份
- **保留数量**：每个应用保留最近 5 个备份
- **备份位置**：`/www/wwwroot/promo-hub/backups/`
- **命名规则**：`{app}_{YYYYMMDD_HHMMSS}.tar.gz`

---

## 7. 环境变量配置

### 7.1 API 环境变量

API 服务支持以下环境变量，在 `.env` 文件中配置：

```env
# 服务器配置
PORT=3000                          # API 服务端口
DATA_DIR=./data                    # 数据存储目录

# MySQL 数据库（可选）
DB_HOST=rm-xxxx.mysql.rds.aliyuncs.com
DB_PORT=3306
DB_USER=promo_user
DB_PASSWORD=your_password
DB_NAME=promo_hub

# 阿里云短信服务（可选）
ALIBABA_CLOUD_ACCESS_KEY_ID=LTAI5t...
ALIBABA_CLOUD_ACCESS_KEY_SECRET=Abc123...
ALIBABA_CLOUD_SMS_SIGN_NAME=推广管理系统
ALIBABA_CLOUD_SMS_TEMPLATE_CODE=SMS_xxx
```

### 7.2 配置方式

#### 方式一：GitHub Secrets（推荐）

所有敏感信息通过 GitHub Secrets 配置，CI/CD 自动生成 `.env` 文件。

#### 方式二：手动创建

在服务器上创建 `/www/wwwroot/promo-hub/api/.env` 文件：

```bash
# SSH 到服务器
ssh root@your-server

# 创建 .env 文件
cat > /www/wwwroot/promo-hub/api/.env << 'EOF'
PORT=3000
DATA_DIR=./data
DB_HOST=your_mysql_host
DB_PORT=3306
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=promo_hub
EOF

# 重启服务
cd /www/wwwroot/promo-hub/api
pm2 restart promo-api
```

### 7.3 环境变量说明

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `PORT` | | 3000 | API 服务监听端口 |
| `DATA_DIR` | | ./data | 数据存储目录 |
| `DB_HOST` | | - | MySQL 主机地址 |
| `DB_PORT` | | 3306 | MySQL 端口 |
| `DB_USER` | | - | MySQL 用户名 |
| `DB_PASSWORD` | | - | MySQL 密码 |
| `DB_NAME` | | - | 数据库名 |

---

## 8. 监控与日志

### 8.1 查看日志

```bash
# 使用 PM2 日志
pm2 logs promo-api --lines 100 --nostream

# 使用部署脚本
bash /www/wwwroot/promo-hub/scripts/deploy.sh logs 100

# 查看文件日志
tail -f /www/wwwroot/promo-hub/logs/api.log

# 归档日志
cat /www/wwwroot/promo-hub/logs/api_20240101_120000.log
```

### 8.2 PM2 进程管理

```bash
# 查看进程状态
pm2 status

# 重启服务
pm2 restart promo-api

# 停止服务
pm2 stop promo-api

# 删除进程
pm2 delete promo-api

# 开机自启配置
pm2 startup
pm2 save

# 监控资源使用
pm2 monit
```

### 8.3 健康检查

API 提供健康检查端点：

```bash
# 本地检查
curl http://127.0.0.1:3000/api/health

# 响应示例
{
  "code": 0,
  "message": "ok",
  "data": {
    "uptime": 3600.5
  }
}
```

### 8.4 Nginx 日志

```bash
# 访问日志
tail -f /var/log/nginx/access.log

# 错误日志
tail -f /var/log/nginx/error.log

# 配置日志格式（自定义）
log_format custom '$remote_addr - $remote_user [$time_local] '
                 '"$request" $status $body_bytes_sent '
                 '"$http_referer" "$http_user_agent"';
```

### 8.5 系统监控

```bash
# 查看系统资源
top
htop

# 查看磁盘使用
df -h

# 查看内存使用
free -h

# 查看网络连接
netstat -tlnp | grep 3000
ss -tlnp | grep 3000
```

---

## 9. 故障排除

### 9.1 常见问题

#### 问题 1：部署失败 - SCP 上传超时

**原因**：构建产物过大或网络不稳定

**解决**：
```bash
# 增加 SCP 超时时间（修改 deploy.yml）
timeout: 300s  # 默认 60s
```

#### 问题 2：PM2 启动失败

**原因**：Node.js 版本不兼容或依赖缺失

**解决**：
```bash
# 检查 Node.js 版本
node -v  # 需要 >= 18

# 重新安装依赖
cd /www/wwwroot/promo-hub/api
npm install --production

# 查看错误日志
pm2 logs promo-api --err --lines 50
```

#### 问题 3：API 返回 502

**原因**：API 服务未启动或端口不通

**解决**：
```bash
# 检查服务状态
pm2 status
curl http://127.0.0.1:3000/api/health

# 检查端口占用
lsof -i :3000

# 重启服务
pm2 restart promo-api
```

#### 问题 4：静态资源 404

**原因**：Nginx 配置错误或文件未上传

**解决**：
```bash
# 检查文件是否存在
ls -la /www/wwwroot/promo-hub/admin/

# 测试 Nginx 配置
nginx -t

# 重载 Nginx
nginx -s reload
```

#### 问题 5：数据库连接失败

**原因**：MySQL 配置错误或网络不通

**解决**：
```bash
# 检查 .env 配置
cat /www/wwwroot/promo-hub/api/.env

# 测试数据库连接
mysql -h $DB_HOST -u $DB_USER -p $DB_NAME

# 查看 API 日志中的数据库错误
pm2 logs promo-api --lines 50 | grep -i mysql
```

### 9.2 回滚操作

```bash
# 自动回滚（使用备份）
bash /www/wwwroot/promo-hub/scripts/deploy.sh rollback

# 手动回滚
cd /www/wwwroot/promo-hub/backups
ls -lt | head  # 查看最新备份

# 解压备份
tar -xzf admin_20240101_120000.tar.gz -C /www/wwwroot/promo-hub/

# 重启服务
pm2 restart promo-api
nginx -s reload
```

### 9.3 调试技巧

```bash
# 1. 查看完整构建日志
# 在 GitHub Actions 中查看详细日志

# 2. 本地模拟部署
# 在本地运行部署命令，检查每一步输出

# 3. SSH 到服务器手动执行
ssh root@your-server

# 4. 检查文件权限
ls -la /www/wwwroot/promo-hub/

# 5. 检查进程用户
ps aux | grep pm2
ps aux | grep nginx

# 6. 测试 API 端点
curl -v http://127.0.0.1:3000/api/health
```

### 9.4 联系支持

如遇无法解决的问题：
1. 查看 GitHub Actions 日志
2. 查看服务器日志：`bash deploy.sh logs 200`
3. 截图错误信息
4. 提交 GitHub Issue

---

## 10. 安全建议

### 10.1 服务器安全

```bash
# 1. 使用 SSH 密钥登录，禁用密码登录
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd

# 2. 配置防火墙
firewall-cmd --permanent --add-service=ssh
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload

# 3. 安装 Fail2Ban 防暴力破解
yum install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# 4. 定期更新系统
yum update -y
```

### 10.2 GitHub Secrets 安全

- ✅ 使用 SSH 密钥而非密码
- ✅ 定期轮换 AccessKey
- ✅ 不在代码中硬编码密钥
- ✅ 使用最小权限原则

### 10.3 Nginx 安全

```nginx
# 隐藏 Nginx 版本号
server_tokens off;

# 防止点击劫持
add_header X-Frame-Options "SAMEORIGIN";

# 防止 XSS
add_header X-Content-Type-Options "nosniff";
add_header X-XSS-Protection "1; mode=block";

# 限制请求大小
client_max_body_size 10M;
```

### 10.4 数据库安全

```bash
# 1. 使用强密码
# 2. 限制数据库访问 IP
# 3. 定期备份
mysqldump -h $DB_HOST -u $DB_USER -p $DB_NAME > backup_$(date +%Y%m%d).sql

# 4. 启用 SSL 连接
```

---

## 附录

### A. 命令速查表

| 命令 | 说明 |
|------|------|
| GitHub Actions 触发 | `git push origin main` |
| 查看服务状态 | `bash deploy.sh status` |
| 查看日志 | `bash deploy.sh logs 100` |
| 重启服务 | `bash deploy.sh restart` |
| 回滚版本 | `bash deploy.sh rollback` |
| 手动部署 | `bash deploy.sh all` |

### B. 文件路径

| 文件 | 位置 | 说明 |
|------|------|------|
| CI/CD 工作流 | `.github/workflows/deploy.yml` | GitHub Actions 配置 |
| 服务器部署脚本 | `scripts/deploy.sh` | 服务器端部署脚本 |
| 服务器初始化脚本 | `scripts/setup-server.sh` | 服务器初始化脚本 |
| Nginx 配置 | `/etc/nginx/conf.d/promo-hub.conf` | 服务器 Nginx 配置 |
| API 环境变量 | `/www/wwwroot/promo-hub/api/.env` | API 配置 |

### C. 端口说明

| 端口 | 服务 | 说明 |
|------|------|------|
| 80 | Nginx | HTTP 服务 |
| 443 | Nginx | HTTPS 服务 |
| 3000 | Node.js API | API 服务 |
| 22 | SSH | 服务器连接 |

### D. 联系方式

- GitHub Issues: [提交问题](https://github.com/your-repo/issues)
- 文档更新: 修改 `DEPLOYMENT_GUIDE.md`

---

**文档版本**: 1.0.0  
**最后更新**: 2024年  
**维护者**: Promo Hub Team
