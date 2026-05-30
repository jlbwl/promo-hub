#!/bin/bash
# ============================================================
# 项目部署脚本 - 2 阶段证书处理
# ============================================================

set -e

DEPLOY_DIR="/www/wwwroot/promo-hub"
NGINX_CONF="/etc/nginx/conf.d/promo-hub.conf"
ACME_DIR="/var/www/html"

# 准备目录
mkdir -p ${DEPLOY_DIR}
mkdir -p /etc/nginx/ssl
mkdir -p ${ACME_DIR}/.well-known/acme-challenge

# 清理可能冲突的旧配置
rm -f /etc/nginx/conf.d/*.conf 2>/dev/null

# ============================================================
# 阶段 1：仅 HTTP 配置（用于 ACME 验证）
# ============================================================
echo "========================================================"
echo " 阶段 1: 配置 HTTP 用于 Let's Encrypt 验证"
echo "========================================================"

cat > ${NGINX_CONF} << 'HTTP_ONLY'
server {
    listen 80;
    server_name www.jlbtg.cn jlbtg.cn;
    
    # ACME 验证路径
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }
    
    # 其他路径先直接服务（避免重定向影响验证）
    location /admin/ { alias /www/wwwroot/promo-hub/admin/; index index.html; try_files $uri $uri/ /admin/index.html; }
    location /manager/ { alias /www/wwwroot/promo-hub/manager/; index index.html; try_files $uri $uri/ /manager/index.html; }
    location /user/ { alias /www/wwwroot/promo-hub/user/; index index.html; try_files $uri $uri/ /user/index.html; }
    location /api/ { proxy_pass http://127.0.0.1:3000/; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
    location = / { return 302 /user/; }
}
HTTP_ONLY

# 先重载 Nginx
nginx -t
nginx -s reload

sleep 2

# ============================================================
# 阶段 2：获取 Let's Encrypt 证书
# ============================================================
echo ""
echo "========================================================"
echo " 阶段 2: 尝试获取 Let's Encrypt 证书"
echo "========================================================"

HAS_REAL_CERT=0

# 方法 1: 检查是否已有 Let's Encrypt 证书
if [ -f /etc/letsencrypt/live/www.jlbtg.cn/fullchain.pem ] && [ -f /etc/letsencrypt/live/www.jlbtg.cn/privkey.pem ]; then
    echo "✅ 找到已有的 Let's Encrypt 证书"
    cp -f /etc/letsencrypt/live/www.jlbtg.cn/fullchain.pem /etc/nginx/ssl/www.jlbtg.cn.pem
    cp -f /etc/letsencrypt/live/www.jlbtg.cn/privkey.pem /etc/nginx/ssl/www.jlbtg.cn.key
    chmod 600 /etc/nginx/ssl/www.jlbtg.cn.key
    HAS_REAL_CERT=1
fi

# 方法 2: 使用 certbot 获取新证书
if [ $HAS_REAL_CERT -eq 0 ] && command -v certbot &> /dev/null; then
    echo "🔐 尝试用 certbot 获取证书..."
    certbot certonly --webroot -w /var/www/html -d www.jlbtg.cn -d jlbtg.cn --non-interactive --agree-tos -m dev@jlbtg.cn --keep-until-expiring 2>&1 || true
    
    if [ -f /etc/letsencrypt/live/www.jlbtg.cn/fullchain.pem ] && [ -f /etc/letsencrypt/live/www.jlbtg.cn/privkey.pem ]; then
        cp -f /etc/letsencrypt/live/www.jlbtg.cn/fullchain.pem /etc/nginx/ssl/www.jlbtg.cn.pem
        cp -f /etc/letsencrypt/live/www.jlbtg.cn/privkey.pem /etc/nginx/ssl/www.jlbtg.cn.key
        chmod 600 /etc/nginx/ssl/www.jlbtg.cn.key
        HAS_REAL_CERT=1
        echo "✅ Let's Encrypt 证书获取成功！"
    fi
fi

# 方法 3: 检查是否有有效的真实证书（不是未来时间的）
if [ $HAS_REAL_CERT -eq 0 ] && [ -f /etc/nginx/ssl/www.jlbtg.cn.pem ] && [ -f /etc/nginx/ssl/www.jlbtg.cn.key ]; then
    # 检查证书时间是否合理
    if openssl x509 -in /etc/nginx/ssl/www.jlbtg.cn.pem -checkend 0 -noout 2>/dev/null; then
        echo "✅ 现有证书有效"
        HAS_REAL_CERT=1
    else
        echo "⚠️  现有证书无效（可能时间有问题）"
    fi
fi

# 方法 4: 如果都没有，重新生成当前时间有效的自签名证书
if [ $HAS_REAL_CERT -eq 0 ]; then
    echo "🔑 重新生成当前时间有效的自签名证书..."
    # 确保 NTP 时间同步（如果可以）
    if command -v ntpdate &> /dev/null; then
        ntpdate -u pool.ntp.org 2>/dev/null || true
    fi
    # 强制重新生成证书
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/www.jlbtg.cn.key \
        -out /etc/nginx/ssl/www.jlbtg.cn.pem \
        -subj "/C=CN/ST=Beijing/L=Beijing/O=Dev/OU=Dev/CN=www.jlbtg.cn" \
        -addext "subjectAltName=DNS:www.jlbtg.cn,DNS:jlbtg.cn" 2>&1 || true
    chmod 600 /etc/nginx/ssl/www.jlbtg.cn.key
fi

# ============================================================
# 阶段 3：部署完整的 HTTPS + HTTP 配置
# ============================================================
echo ""
echo "========================================================"
echo " 阶段 3: 部署完整的 Nginx 配置"
echo "========================================================"

if [ $HAS_REAL_CERT -eq 1 ]; then
    echo "🔐 使用 HTTPS 配置"
    cat > ${NGINX_CONF} << 'HTTPS_CONF'
server {
    listen 80;
    server_name www.jlbtg.cn jlbtg.cn;
    
    # ACME 验证路径保持开放
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }
    
    # 其他重定向到 HTTPS
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
    
    # SSL 证书
    ssl_certificate /etc/nginx/ssl/www.jlbtg.cn.pem;
    ssl_certificate_key /etc/nginx/ssl/www.jlbtg.cn.key;
    
    # 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    
    # 各路径配置
    location /admin/ { alias /www/wwwroot/promo-hub/admin/; index index.html; try_files $uri $uri/ /admin/index.html; }
    location /manager/ { alias /www/wwwroot/promo-hub/manager/; index index.html; try_files $uri $uri/ /manager/index.html; }
    location /user/ { alias /www/wwwroot/promo-hub/user/; index index.html; try_files $uri $uri/ /user/index.html; }
    location /api/ { proxy_pass http://127.0.0.1:3000/; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
    location = / { return 302 /user/; }
}
HTTPS_CONF
else
    echo "⚠️  仅使用 HTTP 配置（临时方案）"
fi

# ============================================================
# 最后：测试并重载 Nginx
# ============================================================
nginx -t
nginx -s reload

# 部署 API 服务
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
echo "Nginx 配置文件:"
cat ${NGINX_CONF} | head -50
echo ""
echo "证书信息:"
if [ -f /etc/nginx/ssl/www.jlbtg.cn.pem ]; then
    openssl x509 -in /etc/nginx/ssl/www.jlbtg.cn.pem -text -noout | grep -A 2 -B 2 "Not Before\|Not After\|Subject:" || true
else
    echo "证书文件不存在"
fi
echo ""
echo "部署目录:"
ls -la ${DEPLOY_DIR}/ 2>/dev/null
echo ""
echo "========================================================"
echo " 🎉 部署完成！"
echo "========================================================"
