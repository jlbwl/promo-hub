#!/bin/bash
# ============================================================
# 项目部署脚本 (简化版)
# 专注于部署网站，SSL证书需单独配置
# ============================================================

set -e

DEPLOY_DIR="/www/wwwroot/promo-hub"
NGINX_CONF="/etc/nginx/conf.d/promo-hub.conf"

# 准备目录
mkdir -p "${DEPLOY_DIR}"
mkdir -p /etc/nginx/ssl
mkdir -p /var/www/html/.well-known/acme-challenge

# 清理旧配置
rm -f /etc/nginx/conf.d/*.conf 2>/dev/null

# ============================================================
# 部署 Nginx 配置
# ============================================================
echo "========================================================"
echo " 部署 Nginx 配置"
echo "========================================================"

cat > "${NGINX_CONF}" << 'EOF'
server {
    listen 80;
    server_name www.jlbtg.cn jlbtg.cn;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_min_length 1024;
    
    # Let's Encrypt ACME 验证路径
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }
    
    # 所有其他 HTTP 请求重定向到 HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name www.jlbtg.cn jlbtg.cn;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_min_length 1024;
    
    # SSL 证书配置 - 需要先上传证书
    ssl_certificate /etc/nginx/ssl/www.jlbtg.cn.pem;
    ssl_certificate_key /etc/nginx/ssl/www.jlbtg.cn.key;
    
    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    
    # 管理员后台
    location /admin/ {
        alias /www/wwwroot/promo-hub/admin/;
        index index.html;
        try_files $uri $uri/ /admin/index.html;
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
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 根路径跳转到用户端
    location = / {
        return 302 /user/;
    }
}
EOF

# ============================================================
# 部署 API 服务
# ============================================================
echo ""
echo "========================================================"
echo " 部署 API 服务"
echo "========================================================"

if [ -f "${DEPLOY_DIR}/api/index.js" ]; then
    cd "${DEPLOY_DIR}/api" || exit 1
    npm install --production 2>&1 || true
    
    if command -v pm2 >/dev/null 2>&1; then
        pm2 delete promo-api 2>/dev/null || true
        pm2 start index.js --name promo-api
        echo "✅ API 服务已启动"
    fi
fi

# ============================================================
# 验证和重载
# ============================================================
echo ""
echo "========================================================"
echo " 验证配置"
echo "========================================================"

nginx -t
echo ""

# 检查证书是否存在
if [ -f "/etc/nginx/ssl/www.jlbtg.cn.pem" ] && [ -f "/etc/nginx/ssl/www.jlbtg.cn.key" ]; then
    echo "✅ 检测到 SSL 证书"
    nginx -s reload
    echo "✅ Nginx 已重载"
else
    echo "⚠️  未检测到 SSL 证书！"
    echo "   请先上传证书，然后运行: nginx -s reload"
fi

# 显示部署目录
echo ""
echo "========================================================"
echo " 部署目录信息"
echo "========================================================"
ls -la "${DEPLOY_DIR}/" 2>/dev/null
echo ""
echo "✅ 部署完成！"
echo ""
echo "下一步："
echo "  1. 上传 SSL 证书到 /etc/nginx/ssl/"
echo "  2. 运行: nginx -s reload"
echo "  3. 访问: https://www.jlbtg.cn"
echo ""
