# 生产环境部署文档

## 一、系统环境

| 项目 | 配置 |
|------|------|
| 操作系统 | Alibaba Cloud Linux 3.2104 LTS |
| 内核版本 | 5.10.134-19.3.al8.x86_64 |
| 架构 | x86_64 |

## 二、关键软件版本（CI/CD 必须匹配）

| 软件 | 版本 | 说明 |
|------|------|------|
| Node.js | v18.20.6 | 后端运行环境 |
| Nginx | 1.20.1 | Web 服务器 |
| PM2 | 6.0.14 | 进程管理 |
| Git | 2.43.7 | 版本控制 |
| pnpm | >= 9 | 包管理器 |

## 三、服务配置

| 服务 | 状态 | 启动方式 |
|------|------|----------|
| nginx | active | systemctl start nginx |
| mysqld | active | systemctl start mysqld |
| promo-api | online | PM2 管理 |

## 四、项目结构

```
/www/wwwroot/promo-hub/
├── admin/              # 管理后台前端
├── manager/           # 管理端前端
├── user/              # 用户端前端
├── api/               # Node.js 后端
│   └── index.js       # 入口文件
├── config/            # 配置目录
│   └── nginx.conf.template  # Nginx 配置模板（已纳入版本控制）
├── node_modules/      # 依赖包
├── package.json       # 项目配置
├── pnpm-lock.yaml     # 包锁定文件（使用 pnpm）
└── .env               # 环境变量配置（不上传 Git）
```

## 五、Nginx 配置要点

### 配置管理方式

**重要改进**: 现在使用模板文件管理 Nginx 配置，而非硬编码。

- **模板文件**: `config/nginx.conf.template`（已纳入版本控制）
- **生成的配置**: `/etc/nginx/conf.d/promo-hub.conf`（动态生成，不上传 Git）
- **模板变量替换**: CI/CD 部署时自动从 GitHub Secrets 读取变量值

### 模板变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DOMAIN_NAMES` | 域名列表 | `www.jlbtg.cn jlbtg.cn` |
| `SSL_CERT_PATH` | SSL 证书路径 | `/etc/nginx/ssl/www.jlbtg.cn.pem` |
| `SSL_KEY_PATH` | SSL 密钥路径 | `/etc/nginx/ssl/www.jlbtg.cn.key` |
| `ACME_ROOT` | ACME 验证路径 | `/var/www/html` |
| `API_URL` | API 反向代理地址 | `http://127.0.0.1:3000` |
| `PROJECT_ROOT` | 项目根目录 | `/www/wwwroot/promo-hub` |

### Nginx 配置模板内容

```nginx
# Nginx 配置模板文件
# 在部署时通过变量替换生成实际配置

server {
    listen 80;
    server_name ${DOMAIN_NAMES};
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_min_length 1024;
    
    # Let's Encrypt ACME 验证路径 (必须保持在 HTTP)
    location /.well-known/acme-challenge/ {
        root ${ACME_ROOT};
        allow all;
    }
    
    # 所有其他 HTTP 请求重定向到 HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN_NAMES};
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_min_length 1024;

    # SSL 证书配置
    ssl_certificate ${SSL_CERT_PATH};
    ssl_certificate_key ${SSL_KEY_PATH};

    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # HSTS (HTTP Strict Transport Security)
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    # Favicon: Serve from user directory by default
    location ~* ^/favicon\.(ico|svg|png)$ {
        alias ${PROJECT_ROOT}/user/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files $uri $uri/ =404;
    }

    # 管理员后台 (最优先)
    location /admin/ { alias ${PROJECT_ROOT}/admin/; index index.html; try_files $uri $uri/ /admin/index.html; }

    # 渠道经理后台
    location /manager/ { alias ${PROJECT_ROOT}/manager/; index index.html; try_files $uri $uri/ /manager/index.html; }

    # 用户端
    location /user/ { alias ${PROJECT_ROOT}/user/; index index.html; try_files $uri $uri/ /user/index.html; }

    # API 反向代理
    location /api/ { proxy_pass ${API_URL}/; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }

    # 根路径精确匹配 - 跳转到 /user/
    location = / { return 302 /user/; }
}
```

### 关键配置项（实际生效值）
- **域名**: `www.jlbtg.cn` / `jlbtg.cn`
- **SSL 证书**: 
  - `/etc/nginx/ssl/www.jlbtg.cn.pem`
  - `/etc/nginx/ssl/www.jlbtg.cn.key`
- **API 代理**: `/api/` → `http://127.0.0.1:3000`
- **前端路由**: SPA 需要 `try_files $uri $uri/ /index.html` 支持

### 手动从模板生成配置（如果需要）

```bash
# 使用 sed 替换变量生成配置
cd /www/wwwroot/promo-hub
sed -e 's|\${DOMAIN_NAMES}|www.jlbtg.cn jlbtg.cn|g' \
    -e 's|\${SSL_CERT_PATH}|/etc/nginx/ssl/www.jlbtg.cn.pem|g' \
    -e 's|\${SSL_KEY_PATH}|/etc/nginx/ssl/www.jlbtg.cn.key|g' \
    -e 's|\${ACME_ROOT}|/var/www/html|g' \
    -e 's|\${API_URL}|http://127.0.0.1:3000|g' \
    -e 's|\${PROJECT_ROOT}|/www/wwwroot/promo-hub|g' \
    config/nginx.conf.template > /etc/nginx/conf.d/promo-hub.conf

# 验证配置
nginx -t

# 重载 Nginx
nginx -s reload
```

## 六、环境变量（敏感信息，CI/CD 使用 Secrets 管理）

### 必需的环境变量

```bash
# 数据库配置
DB_HOST=rm-2zed47q2696h20ai9.mysql.rds.aliyuncs.com
DB_PORT=3306
DB_USER=promo_admin
DB_PASSWORD=<从 Secrets 获取>
DB_NAME=promo_hub

# 应用配置
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://www.jlbtg.cn,https://jlbtg.cn

# Session 配置
SESSION_SECRET=<从 Secrets 获取>

# 阿里云 SMS 配置
ALIBABA_CLOUD_ACCESS_KEY_ID=<从 Secrets 获取>
ALIBABA_CLOUD_ACCESS_KEY_SECRET=<从 Secrets 获取>
ALIBABA_CLOUD_SMS_SIGN_NAME=<从 Secrets 获取>
ALIBABA_CLOUD_SMS_TEMPLATE_CODE=<从 Secrets 获取>

# Redis 配置（可选）
REDIS_HOST=<从 Secrets 获取，可选>
REDIS_PORT=6379
REDIS_PASSWORD=<从 Secrets 获取，可选>
REDIS_DB=0
DATA_DIR=/www/wwwroot/promo-hub/api/data
```

### GitHub Secrets 配置

在 GitHub 仓库的 `Settings → Secrets and variables → Actions` 中配置以下 Secrets：

| Secret 名称 | 说明 | 是否必需 |
|------------|------|----------|
| `DB_HOST` | 数据库主机 | ✅ |
| `DB_PORT` | 数据库端口 | ✅ |
| `DB_USER` | 数据库用户名 | ✅ |
| `DB_PASSWORD` | 数据库密码 | ✅ |
| `DB_NAME` | 数据库名称 | ✅ |
| `SESSION_SECRET` | Session 密钥 | ✅ |
| `ADMIN_PHONE` | 管理员手机号 | ✅ |
| `ADMIN_PASSWORD` | 管理员密码 | ✅ |
| `ALIBABA_CLOUD_ACCESS_KEY_ID` | 阿里云访问密钥 ID | ✅ |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | 阿里云访问密钥 Secret | ✅ |
| `ALIBABA_CLOUD_SMS_SIGN_NAME` | 短信签名名称 | ✅ |
| `ALIBABA_CLOUD_SMS_TEMPLATE_CODE` | 短信模板码 | ✅ |
| `SERVER_HOST` | 部署服务器 IP | ✅ |
| `SERVER_USER` | 部署用户名 | ✅ |
| `SERVER_SSH_KEY` | SSH 私钥 | ✅ |
| `SERVER_PORT` | SSH 端口 | ❌（默认 22） |
| `DOMAIN_NAMES` | 域名列表（空格分隔） | ❌ |
| `SSL_CERT_PATH` | SSL 证书路径 | ❌ |
| `SSL_KEY_PATH` | SSL 密钥路径 | ❌ |
| `ACME_ROOT` | ACME 验证路径 | ❌ |
| `API_URL` | API 地址 | ❌ |
| `REDIS_HOST` | Redis 主机 | ❌ |
| `REDIS_PORT` | Redis 端口 | ❌ |
| `REDIS_PASSWORD` | Redis 密码 | ❌ |
| `REDIS_DB` | Redis 数据库 | ❌ |
| `DATA_DIR` | 数据存储目录 | ❌ |
| `VITE_ICP_NUMBER` | ICP 备案号 | ❌ |

## 七、PM2 进程配置

### 进程信息
- **进程名**: `promo-api`
- **启动脚本**: `/www/wwwroot/promo-hub/api/index.js`
- **工作目录**: `/www/wwwroot/promo-hub/api`
- **配置保存**: `pm2 save`

### PM2 常用命令

```bash
# 查看进程状态
pm2 list

# 重启服务
pm2 restart promo-api

# 查看日志
pm2 logs promo-api

# 保存当前进程列表
pm2 save --force

# 保存进程列表开机自启
pm2 startup

# 监控资源使用
pm2 monit
```

## 八、防火墙端口

**开放端口**: 20, 21, 22, 80, 443, 8888, 888, 39000-40000

```bash
# 查看防火墙状态
systemctl status firewalld

# 开放端口
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=443/tcp

# 重载防火墙
firewall-cmd --reload
```

## 九、CI/CD 部署流程

### 部署流程概述

完整的 CI/CD 部署流程如下：

```
1. 代码推送到 main 分支 → GitHub Actions 触发
2. 部署前检查（检查是否有 .env 等敏感文件被提交）
3. 代码质量检查（TypeScript 类型检查 + ESLint）
4. 构建应用（Admin/Manager/User 前端 + API 后端）
5. 上传构建产物到服务器
6. 上传 Nginx 配置模板
7. 在服务器上从模板生成 Nginx 配置（替换变量）
8. 创建/更新 .env 环境变量文件
9. 安装依赖
10. 重启 PM2 进程
11. 重载 Nginx
```

### 部署前备份

```bash
# 备份 Nginx 配置
cp -r /etc/nginx/conf.d/promo-hub.conf /etc/nginx/conf.d/promo-hub.conf.backup

# 备份 PM2 进程列表
pm2 save --force
```

### 自动化部署步骤

#### 1. 拉取最新代码

```bash
cd /www/wwwroot/promo-hub
git pull origin main
```

#### 2. 安装依赖（使用 pnpm）

```bash
pnpm install
```

#### 3. 构建前端

```bash
pnpm build
```

#### 4. 重启后端服务

```bash
pm2 restart promo-api
```

#### 5. 重载 Nginx

```bash
nginx -t && nginx -s reload
```

### CI/CD 配置文件

完整的 CI/CD 配置文件见 `.github/workflows/deploy.yml`

## 十、关键检查点

- ✅ Node.js 版本必须为 **18.20.6**
- ✅ 使用 **pnpm** 而非 npm（有 `pnpm-lock.yaml`）
- ✅ 环境变量必须正确配置
- ✅ SSL 证书路径不能改变
- ✅ PM2 进程名保持 `promo-api`
- ✅ 数据库连接信息正确
- ✅ CORS 配置包含所有域名
- ✅ Nginx 配置使用模板文件，避免硬编码路径
- ✅ 敏感信息仅存储在 GitHub Secrets 中，不上传 Git

## 十一、回滚方案

### Nginx 配置回滚

```bash
cp /etc/nginx/conf.d/promo-hub.conf.backup /etc/nginx/conf.d/promo-hub.conf
nginx -s reload
```

### PM2 回滚

```bash
pm2 restart promo-api
```

### 代码回滚

```bash
cd /www/wwwroot/promo-hub
git revert HEAD  # 回滚上一次提交
# 或
git reset --hard <commit_hash>  # 回滚到指定提交
```

### 完整回滚脚本

```bash
#!/bin/bash
set -e

echo "开始回滚..."

# 停止服务
pm2 stop promo-api

# 切换到上一个稳定版本
cd /www/wwwroot/promo-hub
git checkout HEAD~1

# 安装依赖
pnpm install

# 构建
pnpm build

# 重启服务
pm2 restart promo-api

# 重载 Nginx
nginx -s reload

echo "回滚完成！"
```

## 十二、健康检查

### 检查服务状态

```bash
# 检查系统服务状态
systemctl is-active nginx
systemctl is-active mysqld

# 检查 PM2 进程
pm2 list

# 检查 Nginx 配置
nginx -t

# 检查端口监听
ss -tlnp | grep -E ':(80|443|3000)'
```

### HTTP 健康检查

```bash
# 检查前端
curl -I https://www.jlbtg.cn

# 检查 API
curl -I https://www.jlbtg.cn/api/health

# 检查响应时间
curl -o /dev/null -s -w '%{http_code}\n' https://www.jlbtg.cn
curl -o /dev/null -s -w '%{time_total}s\n' https://www.jlbtg.cn
```

### 日志检查

```bash
# PM2 日志
pm2 logs promo-api --lines 50

# Nginx 访问日志
tail -50 /var/log/nginx/access.log

# Nginx 错误日志
tail -50 /var/log/nginx/error.log
```

## 十三、数据库迁移注意事项

### 备份数据库

```bash
mysqldump -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 执行迁移

```bash
# 检查迁移脚本
ls -la /www/wwwroot/promo-hub/api/dist_migrate/

# 执行迁移
node /www/wwwroot/promo-hub/api/dist_migrate/*.js
```

## 十四、性能优化建议

### PM2 集群模式

```bash
# 使用集群模式运行
pm2 start /www/wwwroot/promo-hub/api/index.js -i max --name promo-api

# 查看 CPU 使用
pm2 monit
```

### Nginx 缓存配置

```nginx
# 静态资源缓存
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

## 十五、监控告警

### 设置监控脚本

```bash
#!/bin/bash
# check_health.sh

# 检查服务状态
if ! pm2 list | grep -q "promo-api.*online"; then
    echo "promo-api is down!" | mail -s "Alert: promo-api down" admin@example.com
fi

# 检查磁盘空间
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 90 ]; then
    echo "Disk usage is ${DISK_USAGE}%!" | mail -s "Alert: Disk usage high" admin@example.com
fi
```

## 十六、紧急联系

- **运维团队**: [联系方式]
- **数据库管理员**: [联系方式]
- **域名服务商**: [联系方式]

---

**文档版本**: 2.0.0  
**最后更新**: 2026-05-31  
**维护者**: Development Team
