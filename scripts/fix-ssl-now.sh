#!/bin/bash
# ============================================================
# SSL 证书快速修复脚本
# ============================================================

echo "========================================================"
echo "SSL 证书快速修复"
echo "========================================================"

# 1. 删除旧的无效证书
echo ""
echo "1. 删除旧证书..."
rm -f /etc/nginx/ssl/www.jlbtg.cn.pem
rm -f /etc/nginx/ssl/www.jlbtg.cn.key
echo "✅ 旧证书已删除"

# 2. 尝试获取 Let's Encrypt
echo ""
echo "2. 尝试获取 Let's Encrypt 证书..."
mkdir -p /var/www/html/.well-known/acme-challenge

# 临时配置一个简单的 Nginx 仅用于获取证书
cat > /etc/nginx/conf.d/temp-acme.conf << 'TEMP_CONF'
server {
    listen 80;
    server_name www.jlbtg.cn jlbtg.cn;
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }
}
TEMP_CONF

# 重载 Nginx
nginx -t && nginx -s reload

# 等待一下
sleep 3

# 尝试获取证书
HAS_CERT=0
if command -v certbot &> /dev/null; then
    certbot certonly --webroot -w /var/www/html -d www.jlbtg.cn -d jlbtg.cn --non-interactive --agree-tos -m dev@jlbtg.cn --keep-until-expiring 2>&1
    if [ -f /etc/letsencrypt/live/www.jlbtg.cn/fullchain.pem ] && [ -f /etc/letsencrypt/live/www.jlbtg.cn/privkey.pem ]; then
        cp -f /etc/letsencrypt/live/www.jlbtg.cn/fullchain.pem /etc/nginx/ssl/www.jlbtg.cn.pem
        cp -f /etc/letsencrypt/live/www.jlbtg.cn/privkey.pem /etc/nginx/ssl/www.jlbtg.cn.key
        chmod 600 /etc/nginx/ssl/www.jlbtg.cn.key
        HAS_CERT=1
        echo "✅ Let's Encrypt 证书获取成功！"
    fi
fi

# 3. 如果获取失败，重新生成自签名证书
if [ $HAS_CERT -eq 0 ]; then
    echo ""
    echo "3. 重新生成自签名证书..."
    # 确保时间正确
    if command -v ntpdate &> /dev/null; then
        ntpdate -u pool.ntp.org 2>/dev/null || true
    fi
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/www.jlbtg.cn.key \
        -out /etc/nginx/ssl/www.jlbtg.cn.pem \
        -subj "/C=CN/ST=Beijing/L=Beijing/O=Dev/OU=Dev/CN=www.jlbtg.cn" \
        -addext "subjectAltName=DNS:www.jlbtg.cn,DNS:jlbtg.cn"
    chmod 600 /etc/nginx/ssl/www.jlbtg.cn.key
    echo "✅ 自签名证书已重新生成"
fi

# 4. 删除临时配置，应用完整配置
rm -f /etc/nginx/conf.d/temp-acme.conf

# 5. 部署最终的完整 Nginx 配置
echo ""
echo "4. 应用完整 Nginx 配置..."
cat > /etc/nginx/conf.d/promo-hub.conf << 'FINAL_CONF'
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
nginx -t && nginx -s reload

echo ""
echo "========================================================"
echo "证书信息："
openssl x509 -in /etc/nginx/ssl/www.jlbtg.cn.pem -text -noout | grep -A 2 -B 2 "Not Before\|Not After\|Subject:" || true
echo "========================================================"
echo "🎉 SSL 证书修复完成！"
echo "请尝试访问 https://www.jlbtg.cn"
echo "========================================================"
