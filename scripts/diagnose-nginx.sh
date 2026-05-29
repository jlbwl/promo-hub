#!/bin/bash
# ============================================================
# 服务器 Nginx 配置诊断和修复脚本
# 使用方法: bash diagnose-nginx.sh
# ============================================================

set -e

DEPLOY_DIR="/www/wwwroot/promo-hub"
NGINX_CONF="/etc/nginx/conf.d/promo-hub.conf"

echo "🔍 开始诊断 Nginx 配置..."
echo ""

# 1. 检查是否有其他 nginx 配置文件
echo "=== 检查 Nginx 主配置 ==="
cat /etc/nginx/nginx.conf | grep -A 5 "include" || echo "未找到 include 指令"
echo ""

# 2. 检查 conf.d 目录下的所有配置
echo "=== 检查所有 Nginx 配置文件 ==="
ls -la /etc/nginx/conf.d/ 2>/dev/null || echo "conf.d 目录不存在"
echo ""

# 3. 检查 sites-enabled 目录
echo "=== 检查 sites-enabled 目录 ==="
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || echo "sites-enabled 目录不存在"
ls -la /etc/nginx/sites-available/ 2>/dev/null || echo "sites-available 目录不存在"
echo ""

# 4. 检查默认站点配置
echo "=== 检查默认站点配置 ==="
cat /etc/nginx/sites-enabled/default 2>/dev/null || echo "默认站点配置不存在"
echo ""

# 5. 检查当前运行的 nginx 配置
echo "=== 检查 promo-hub 配置 ==="
cat "${NGINX_CONF}" 2>/dev/null || echo "promo-hub 配置不存在"
echo ""

# 6. 检查根目录是否有多余的文件
echo "=== 检查根目录文件 ==="
ls -la "${DEPLOY_DIR}/" 2>/dev/null || echo "部署目录不存在"
echo ""

# 7. 强制重写 nginx 配置
echo "=== 强制重写 Nginx 配置 ==="
cat > "${NGINX_CONF}" << 'EOF'
server {
    listen 80;
    server_name www.jlbtg.cn jlbtg.cn;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_min_length 1024;
    
    # Let's Encrypt ACME 验证路径 (必须保持在 HTTP)
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
    
    # SSL 证书配置
    ssl_certificate /etc/nginx/ssl/www.jlbtg.cn.pem;
    ssl_certificate_key /etc/nginx/ssl/www.jlbtg.cn.key;
    
    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    
    # HSTS (HTTP Strict Transport Security)
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    # 管理员后台 (最优先)
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

    # 根路径精确匹配 - 强制跳转到用户端
    location = / {
        return 302 /user/;
    }
}
EOF

echo "✓ Nginx 配置已重写"

# 8. 删除可能的干扰文件
echo "=== 清理干扰文件 ==="
rm -f "${DEPLOY_DIR}/index.html"
rm -f "${DEPLOY_DIR}/index.htm"
rm -f /var/www/html/index.html
rm -f /usr/share/nginx/html/index.html
echo "✓ 干扰文件已清理"

# 9. 测试并重载 Nginx
echo "=== 测试并重载 Nginx ==="
nginx -t
nginx -s reload
echo "✓ Nginx 已重载"

echo ""
echo "🎉 诊断和修复完成！"
echo ""
echo "请再次访问 https://www.jlbtg.cn/ 测试"
