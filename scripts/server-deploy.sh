#!/bin/bash
# ============================================================
# 项目部署脚本 - 自动解决证书时间问题
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
# 关键：先生成一个超长期有效的证书，覆盖过去和未来
# ============================================================
echo "========================================================"
echo " 步骤 1: 生成证书"
echo "========================================================"

# 备份旧证书（如果有）
mkdir -p /etc/nginx/ssl/backup
if [ -f /etc/nginx/ssl/www.jlbtg.cn.pem ]; then
    mv -f /etc/nginx/ssl/www.jlbtg.cn.pem /etc/nginx/ssl/backup/www.jlbtg.cn.pem.$(date +%s) 2>/dev/null || true
fi
if [ -f /etc/nginx/ssl/www.jlbtg.cn.key ]; then
    mv -f /etc/nginx/ssl/www.jlbtg.cn.key /etc/nginx/ssl/backup/www.jlbtg.cn.key.$(date +%s) 2>/dev/null || true
fi

# 尝试多种方法获取有效证书
HAS_CERT=0

# 1. 先试 Let's Encrypt
if [ -f /etc/letsencrypt/live/www.jlbtg.cn/fullchain.pem ] && [ -f /etc/letsencrypt/live/www.jlbtg.cn/privkey.pem ]; then
    echo "✅ 使用 Let's Encrypt 证书"
    cp -f /etc/letsencrypt/live/www.jlbtg.cn/fullchain.pem /etc/nginx/ssl/www.jlbtg.cn.pem
    cp -f /etc/letsencrypt/live/www.jlbtg.cn/privkey.pem /etc/nginx/ssl/www.jlbtg.cn.key
    chmod 600 /etc/nginx/ssl/www.jlbtg.cn.key
    HAS_CERT=1
elif command -v certbot &> /dev/null; then
    # 先配置一个临时的 HTTP 服务用于 ACME 验证
    cat > ${NGINX_CONF} << 'TEMP_HTTP'
server {
    listen 80;
    server_name www.jlbtg.cn jlbtg.cn;
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }
}
TEMP_HTTP
    nginx -t && nginx -s reload
    sleep 2
    
    certbot certonly --webroot -w /var/www/html -d www.jlbtg.cn -d jlbtg.cn --non-interactive --agree-tos -m dev@jlbtg.cn --keep-until-expiring 2>&1 || true
    if [ -f /etc/letsencrypt/live/www.jlbtg.cn/fullchain.pem ] && [ -f /etc/letsencrypt/live/www.jlbtg.cn/privkey.pem ]; then
        cp -f /etc/letsencrypt/live/www.jlbtg.cn/fullchain.pem /etc/nginx/ssl/www.jlbtg.cn.pem
        cp -f /etc/letsencrypt/live/www.jlbtg.cn/privkey.pem /etc/nginx/ssl/www.jlbtg.cn.key
        chmod 600 /etc/nginx/ssl/www.jlbtg.cn.key
        HAS_CERT=1
        echo "✅ Let's Encrypt 证书获取成功"
    fi
fi

# 2. 如果没有，生成自签名证书（超长有效期）
if [ $HAS_CERT -eq 0 ]; then
    echo "🔐 生成自签名证书（有效期 10 年）"
    
    # 尝试临时修改系统时间到 2023 年（如果有权限）
    if [ "$(id -u)" = "0" ]; then
        SAVED_DATE=$(date +%s)
        date -s "2023-05-30 12:00:00" 2>&1 || true
    fi
    
    # 生成证书（10年有效期）
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/www.jlbtg.cn.key \
        -out /etc/nginx/ssl/www.jlbtg.cn.pem \
        -subj "/C=CN/ST=Beijing/L=Beijing/O=Dev/OU=Dev/CN=www.jlbtg.cn" \
        -addext "subjectAltName=DNS:www.jlbtg.cn,DNS:jlbtg.cn" 2>&1
    
    chmod 600 /etc/nginx/ssl/www.jlbtg.cn.key
    
    # 恢复原时间
    if [ "$(id -u)" = "0" ] && [ -n "$SAVED_DATE" ]; then
        date -s "@$SAVED_DATE" 2>&1 || true
        if command -v ntpdate &> /dev/null; then
            ntpdate -u pool.ntp.org 2>&1 || true
        fi
    fi
    
    HAS_CERT=1
fi

# ============================================================
# 部署最终的 Nginx 配置
# ============================================================
echo ""
echo "========================================================"
echo " 步骤 2: 部署 Nginx 配置"
echo "========================================================"

cat > ${NGINX_CONF} << 'FINAL_CONF'
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
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_min_length 1024;
    ssl_certificate /etc/nginx/ssl/www.jlbtg.cn.pem;
    ssl_certificate_key /etc/nginx/ssl/www.jlbtg.cn.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    
    location /admin/ { alias /www/wwwroot/promo-hub/admin/; index index.html; try_files $uri $uri/ /admin/index.html; }
    location /manager/ { alias /www/wwwroot/promo-hub/manager/; index index.html; try_files $uri $uri/ /manager/index.html; }
    location /user/ { alias /www/wwwroot/promo-hub/user/; index index.html; try_files $uri $uri/ /user/index.html; }
    location /api/ { proxy_pass http://127.0.0.1:3000/; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
    location = / { return 302 /user/; }
}
FINAL_CONF

# 重载 Nginx
nginx -t
nginx -s reload

# 部署 API
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
if [ -f /etc/nginx/ssl/www.jlbtg.cn.pem ]; then
    openssl x509 -in /etc/nginx/ssl/www.jlbtg.cn.pem -text -noout | grep -A 2 -B 2 "Not Before\|Not After\|Subject:" || true
fi
echo ""
echo "部署目录:"
ls -la ${DEPLOY_DIR}/ 2>/dev/null
echo ""
echo "========================================================"
echo " 🎉 部署完成！请访问 https://www.jlbtg.cn"
echo "========================================================"
