#!/bin/bash
# ============================================================
# 安全的证书修复方案（不修改系统时间）
# ============================================================

echo "========================================================"
echo " 安全的证书修复方案"
echo "========================================================"

DEPLOY_DIR="/www/wwwroot/promo-hub"
NGINX_CONF="/etc/nginx/conf.d/promo-hub.conf"
SSL_DIR="/etc/nginx/ssl"

# 1. 首先确保有 HTTP 服务可用（用于验证和访问）
echo ""
echo "步骤 1: 配置 HTTP 服务"
cat > ${NGINX_CONF} << 'HTTP_CONFIG'
server {
    listen 80;
    server_name www.jlbtg.cn jlbtg.cn;
    
    # ACME 挑战路径
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }
    
    # 服务静态文件
    location /admin/ { alias /www/wwwroot/promo-hub/admin/; index index.html; try_files $uri $uri/ /admin/index.html; }
    location /manager/ { alias /www/wwwroot/promo-hub/manager/; index index.html; try_files $uri $uri/ /manager/index.html; }
    location /user/ { alias /www/wwwroot/promo-hub/user/; index index.html; try_files $uri $uri/ /user/index.html; }
    location /api/ { proxy_pass http://127.0.0.1:3000/; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
    location = / { return 302 /user/; }
}
HTTP_CONFIG

nginx -t && nginx -s reload
echo "✅ HTTP 服务已启动"

# 2. 先尝试获取真实的 Let's Encrypt 证书
echo ""
echo "步骤 2: 尝试获取 Let's Encrypt 证书"
if command -v certbot &> /dev/null; then
    certbot certonly --webroot -w /var/www/html -d www.jlbtg.cn -d jlbtg.cn --non-interactive --agree-tos -m dev@jlbtg.cn --keep-until-expiring 2>&1 || true
    
    if [ -f /etc/letsencrypt/live/www.jlbtg.cn/fullchain.pem ] && [ -f /etc/letsencrypt/live/www.jlbtg.cn/privkey.pem ]; then
        mkdir -p ${SSL_DIR}
        cp -f /etc/letsencrypt/live/www.jlbtg.cn/fullchain.pem ${SSL_DIR}/www.jlbtg.cn.pem
        cp -f /etc/letsencrypt/live/www.jlbtg.cn/privkey.pem ${SSL_DIR}/www.jlbtg.cn.key
        chmod 600 ${SSL_DIR}/www.jlbtg.cn.key
        echo "✅ Let's Encrypt 证书获取成功！"
        USE_HTTPS=1
    fi
fi

# 3. 如果无法获取真实证书，使用自签名证书（但保持 HTTP 可用）
if [ -z "$USE_HTTPS" ]; then
    echo ""
    echo "步骤 3: 使用自签名证书（但保持 HTTP 可用）"
    
    mkdir -p ${SSL_DIR}
    
    # 生成自签名证书（使用当前系统时间，有效期 1 年）
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ${SSL_DIR}/www.jlbtg.cn.key \
        -out ${SSL_DIR}/www.jlbtg.cn.pem \
        -subj "/C=CN/ST=Beijing/L=Beijing/O=Dev/OU=Dev/CN=www.jlbtg.cn" \
        -addext "subjectAltName=DNS:www.jlbtg.cn,DNS:jlbtg.cn" 2>&1
    
    chmod 600 ${SSL_DIR}/www.jlbtg.cn.key
    chmod 644 ${SSL_DIR}/www.jlbtg.cn.pem
    
    # 关键：同时提供 HTTP 和 HTTPS，不强制重定向
    echo "ℹ️  同时提供 HTTP 和 HTTPS 访问"
    cat > ${NGINX_CONF} << 'BOTH_CONFIG'
server {
    listen 80;
    server_name www.jlbtg.cn jlbtg.cn;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }
    
    location /admin/ { alias /www/wwwroot/promo-hub/admin/; index index.html; try_files $uri $uri/ /admin/index.html; }
    location /manager/ { alias /www/wwwroot/promo-hub/manager/; index index.html; try_files $uri $uri/ /manager/index.html; }
    location /user/ { alias /www/wwwroot/promo-hub/user/; index index.html; try_files $uri $uri/ /user/index.html; }
    location /api/ { proxy_pass http://127.0.0.1:3000/; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
    location = / { return 302 /user/; }
}

server {
    listen 443 ssl http2;
    server_name www.jlbtg.cn jlbtg.cn;
    
    ssl_certificate /etc/nginx/ssl/www.jlbtg.cn.pem;
    ssl_certificate_key /etc/nginx/ssl/www.jlbtg.cn.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_min_length 1024;
    
    location /admin/ { alias /www/wwwroot/promo-hub/admin/; index index.html; try_files $uri $uri/ /admin/index.html; }
    location /manager/ { alias /www/wwwroot/promo-hub/manager/; index index.html; try_files $uri $uri/ /manager/index.html; }
    location /user/ { alias /www/wwwroot/promo-hub/user/; index index.html; try_files $uri $uri/ /user/index.html; }
    location /api/ { proxy_pass http://127.0.0.1:3000/; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
    location = / { return 302 /user/; }
}
BOTH_CONFIG

else
    # 有真实证书时，才强制 HTTPS
    echo "✅ 使用真实证书，强制 HTTPS"
    cat > ${NGINX_CONF} << 'HTTPS_ONLY'
server {
    listen 80;
    server_name www.jlbtg.cn jlbtg.cn;
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name www.jlbtg.cn jlbtg.cn;
    ssl_certificate /etc/nginx/ssl/www.jlbtg.cn.pem;
    ssl_certificate_key /etc/nginx/ssl/www.jlbtg.cn.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_min_length 1024;
    
    location /admin/ { alias /www/wwwroot/promo-hub/admin/; index index.html; try_files $uri $uri/ /admin/index.html; }
    location /manager/ { alias /www/wwwroot/promo-hub/manager/; index index.html; try_files $uri $uri/ /manager/index.html; }
    location /user/ { alias /www/wwwroot/promo-hub/user/; index index.html; try_files $uri $uri/ /user/index.html; }
    location /api/ { proxy_pass http://127.0.0.1:3000/; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
    location = / { return 302 /user/; }
}
HTTPS_ONLY
fi

# 4. 重载 Nginx 和启动 API
echo ""
echo "步骤 4: 重载服务"
nginx -t && nginx -s reload

if [ -f ${DEPLOY_DIR}/api/index.js ]; then
    cd ${DEPLOY_DIR}/api || exit 1
    npm install --production 2>&1 || true
    if command -v pm2 &> /dev/null; then
        pm2 delete promo-api 2>/dev/null || true
        pm2 start index.js --name promo-api
    fi
fi

echo ""
echo "========================================================"
echo " 诊断信息"
echo "========================================================"
echo "系统时间: $(date)"
echo ""
echo "证书信息:"
if [ -f ${SSL_DIR}/www.jlbtg.cn.pem ]; then
    openssl x509 -in ${SSL_DIR}/www.jlbtg.cn.pem -text -noout | grep -A 2 -B 2 "Not Before\|Not After\|Subject:" || true
fi
echo ""
echo "部署目录:"
ls -la ${DEPLOY_DIR}/ 2>/dev/null
echo ""
echo "========================================================"
echo " 🎉 完成！"
echo " 访问地址："
echo "    HTTP: http://www.jlbtg.cn"
echo "    HTTPS: https://www.jlbtg.cn"
echo "========================================================"
