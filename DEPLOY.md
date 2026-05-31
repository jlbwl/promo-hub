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
├── node_modules/      # 依赖包
├── package.json       # 项目配置
├── pnpm-lock.yaml     # 包锁定文件（使用 pnpm）
└── .env               # 环境变量配置（不上传 Git）
```

## 五、Nginx 配置要点

**配置文件**: `/etc/nginx/conf.d/promo-hub.conf`

### 关键配置项
- **域名**: `www.jlbtg.cn` / `jlbtg.cn`
- **SSL 证书**: 
  - `/root/certs/www.jlbtg.cn.pem`
  - `/root/certs/www.jlbtg.cn.key`
- **API 代理**: `/api/` → `http://127.0.0.1:3000`
- **前端路由**: SPA 需要 `try_files $uri $uri/ /index.html` 支持

### 示例 Nginx 配置

```nginx
server {
    listen 80;
    server_name www.jlbtg.cn jlbtg.cn;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.jlbtg.cn jlbtg.cn;

    ssl_certificate /root/certs/www.jlbtg.cn.pem;
    ssl_certificate_key /root/certs/www.jlbtg.cn.key;

    root /www/wwwroot/promo-hub/user/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
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
SMS_ACCESS_KEY_ID=<从 Secrets 获取>
SMS_ACCESS_KEY_SECRET=<从 Secrets 获取>
SMS_SIGN_NAME=<从 Secrets 获取>
```

### GitHub Secrets 配置

在 GitHub 仓库的 `Settings → Secrets and variables → Actions` 中配置以下 Secrets：

| Secret 名称 | 说明 |
|------------|------|
| `DB_PASSWORD` | 数据库密码 |
| `SESSION_SECRET` | Session 密钥 |
| `SMS_ACCESS_KEY_ID` | 阿里云访问密钥 ID |
| `SMS_ACCESS_KEY_SECRET` | 阿里云访问密钥 Secret |
| `SMS_SIGN_NAME` | 短信签名名称 |
| `DEPLOY_HOST` | 部署服务器 IP |
| `DEPLOY_USER` | 部署用户名 |
| `DEPLOY_KEY` | SSH 私钥 |

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

### CI/CD 脚本示例

在 `.github/workflows/deploy.yml` 中：

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_KEY }}
          script: |
            cd /www/wwwroot/promo-hub
            git pull origin main
            pnpm install
            pnpm build
            pm2 restart promo-api
            nginx -t && nginx -s reload
```

## 十、关键检查点

- ✅ Node.js 版本必须为 **18.20.6**
- ✅ 使用 **pnpm** 而非 npm（有 `pnpm-lock.yaml`）
- ✅ 环境变量必须正确配置
- ✅ SSL 证书路径不能改变
- ✅ PM2 进程名保持 `promo-api`
- ✅ 数据库连接信息正确
- ✅ CORS 配置包含所有域名

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

**文档版本**: 1.0.0  
**最后更新**: 2026-05-31  
**维护者**: Development Team
