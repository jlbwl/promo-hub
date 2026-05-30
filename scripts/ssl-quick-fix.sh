#!/bin/bash
# ============================================================
# SSL证书快速修复脚本
# 自动修复常见的SSL证书配置问题
# ============================================================

set -e

echo "========================================================"
echo " SSL证书快速修复工具"
echo "========================================================"
echo ""

DEPLOY_DIR="/www/wwwroot/promo-hub"
NGINX_CONF="/etc/nginx/conf.d/promo-hub.conf"
CERT_FILE="/etc/nginx/ssl/www.jlbtg.cn.pem"
KEY_FILE="/etc/nginx/ssl/www.jlbtg.cn.key"

# 1. 检查证书是否存在
HAS_CERT=0
if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    HAS_CERT=1
    echo "✅ 检测到SSL证书"
else
    echo "⚠️  未检测到SSL证书，将使用HTTP-only模式"
fi

# 2. 如果有证书，验证并修复权限
if [ $HAS_CERT -eq 1 ]; then
    echo ""
    echo "验证证书..."
    
    # 验证证书格式
    if ! openssl x509 -in "$CERT_FILE" -noout 2>/dev/null; then
        echo "❌ 证书格式不正确"
        echo "   请确认证书文件是PEM格式"
        HAS_CERT=0
    else
        echo "✅ 证书格式正确"
    fi
    
    # 验证私钥格式
    if ! openssl rsa -in "$KEY_FILE" -check -noout 2>/dev/null; then
        echo "❌ 私钥格式不正确"
        echo "   请确认私钥文件是PEM格式"
        HAS_CERT=0
    else
        echo "✅ 私钥格式正确"
    fi
    
    # 检查证书和私钥是否匹配
    CERT_MODULUS=$(openssl x509 -in "$CERT_FILE" -noout -modulus 2>/dev/null | md5sum | cut -d' ' -f1)
    KEY_MODULUS=$(openssl rsa -in "$KEY_FILE" -noout -modulus 2>/dev/null | md5sum | cut -d' ' -f1)
    
    if [ "$CERT_MODULUS" != "$KEY_MODULUS" ]; then
        echo "❌ 证书和私钥不匹配"
        echo "   请确认上传的是同一套证书和私钥"
        HAS_CERT=0
    else
        echo "✅ 证书和私钥匹配"
    fi
    
    # 修复权限
    echo ""
    echo "修复证书文件权限..."
    chmod 600 "$KEY_FILE"
    chmod 644 "$CERT_FILE"
    chown -R root:root /etc/nginx/ssl/
    echo "✅ 权限已修复"
fi

# 3. 创建必要的目录
echo ""
echo "创建必要的目录..."
mkdir -p "${DEPLOY_DIR}"
mkdir -p /etc/nginx/ssl
mkdir -p /etc/nginx/conf.d
mkdir -p /var/www/html/.well-known/acme-challenge
echo "✅ 目录已创建"

# 4. 清理旧配置
echo ""
echo "清理旧的Nginx配置..."
rm -f /etc/nginx/conf.d/*.conf 2>/dev/null
echo "✅ 旧配置已清理"

# 5. 部署Nginx配置
echo ""
echo "部署Nginx配置..."

if [ $HAS_CERT -eq 1 ]; then
    echo "使用HTTPS配置..."
    cat > "${NGINX_CONF}" << 'EOF'
server {
    listen 80;
    server_name www.jlbtg.cn jlbtg.cn;
    
    # Let's Encrypt ACME 验证路径
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }
    
    # 重定向到 HTTPS
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
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    
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
else
    echo "使用HTTP-only配置..."
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
fi

echo "✅ Nginx配置已部署"

# 6. 测试Nginx配置
echo ""
echo "测试Nginx配置..."
if nginx -t 2>&1; then
    echo "✅ Nginx配置验证通过"
else
    echo "❌ Nginx配置验证失败"
    echo "   请检查上述错误信息"
    exit 1
fi

# 7. 重载Nginx
echo ""
echo "重载Nginx..."
nginx -s reload
echo "✅ Nginx已重载"

# 8. 检查Nginx服务状态
echo ""
echo "检查Nginx服务状态..."
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx服务正在运行"
else
    echo "⚠️  Nginx服务未运行，尝试启动..."
    systemctl start nginx
    if systemctl is-active --quiet nginx; then
        echo "✅ Nginx服务已启动"
    else
        echo "❌ Nginx服务启动失败"
        exit 1
    fi
fi

# 9. 显示结果
echo ""
echo "========================================================"
echo " 🎉 修复完成！"
echo "========================================================"
echo ""

if [ $HAS_CERT -eq 1 ]; then
    echo "访问地址:"
    echo "  HTTPS: https://www.jlbtg.cn"
    echo "  HTTP: http://www.jlbtg.cn (自动重定向到HTTPS)"
    echo ""
    echo "验证证书:"
    echo "  openssl s_client -connect www.jlbtg.cn:443 | openssl x509 -noout -dates"
else
    echo "访问地址:"
    echo "  HTTP: http://www.jlbtg.cn"
    echo ""
    echo "⚠️  当前使用HTTP-only模式"
    echo "   请上传SSL证书后再次运行此脚本以启用HTTPS"
fi

echo ""