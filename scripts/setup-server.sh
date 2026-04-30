#!/bin/bash
# ============================================================
# 服务器初始化脚本 — 在阿里云服务器上首次运行
# 用法: bash setup-server.sh
# ============================================================

set -e

DEPLOY_DIR="/var/www/promo-hub"
NGINX_CONF="/etc/nginx/conf.d/promo-hub.conf"

echo "🚀 开始初始化服务器环境..."

# 1. 安装 Nginx
if ! command -v nginx &> /dev/null; then
    echo "📦 安装 Nginx..."
    yum install -y nginx 2>/dev/null || apt-get install -y nginx 2>/dev/null
    systemctl enable nginx
    systemctl start nginx
    echo "✅ Nginx 安装完成"
else
    echo "✅ Nginx 已安装"
fi

# 2. 创建部署目录
echo "📁 创建部署目录..."
mkdir -p "${DEPLOY_DIR}/admin"
mkdir -p "${DEPLOY_DIR}/manager"
mkdir -p "${DEPLOY_DIR}/user"

# 3. 配置 Nginx
echo "⚙️  配置 Nginx..."
cat > "${NGINX_CONF}" << 'EOF'
server {
    listen 80;
    server_name _;  # 替换为你的域名，如 promo.example.com

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_min_length 1024;

    # 管理员后台
    location / {
        root /var/www/promo-hub/admin;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 推广经理后台
    location /manager {
        alias /var/www/promo-hub/manager;
        index index.html;
        try_files $uri $uri/ /manager/index.html;
    }

    # 用户端
    location /user {
        alias /var/www/promo-hub/user;
        index index.html;
        try_files $uri $uri/ /user/index.html;
    }

    # API 反向代理（根据后端地址调整）
    location /api/ {
        proxy_pass http://127.0.0.1:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# 4. 测试并重载 Nginx
echo "🔄 测试 Nginx 配置..."
nginx -t && systemctl reload nginx

# 5. 配置防火墙
if command -v firewall-cmd &> /dev/null; then
    echo "🔥 配置防火墙..."
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --reload
elif command -v ufw &> /dev/null; then
    echo "🔥 配置防火墙..."
    ufw allow 'Nginx Full'
fi

echo ""
echo "🎉 服务器初始化完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  管理员后台:  http://$(hostname -I | awk '{print $1}')/"
echo "  推广经理端:  http://$(hostname -I | awk '{print $1}')/manager/"
echo "  用户端:      http://$(hostname -I | awk '{print $1}')/user/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  后续步骤:"
echo "  1. 如果有域名，修改 ${NGINX_CONF} 中的 server_name"
echo "  2. 配置 SSL 证书（推荐使用 certbot）"
echo "  3. 调整 API 代理地址（proxy_pass）指向实际后端"
