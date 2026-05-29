#!/bin/bash
set -e

DEPLOY_DIR="/www/wwwroot/promo-hub"
NGINX_CONF="/etc/nginx/conf.d/promo-hub.conf"

echo "🚀 开始部署..."

# 清理干扰文件
rm -f "${DEPLOY_DIR}/index.html" "${DEPLOY_DIR}/index.htm" 2>/dev/null || true
rm -f /var/www/html/index.html /usr/share/nginx/html/index.html 2>/dev/null || true

# 创建目录
mkdir -p "${DEPLOY_DIR}/api/data/uploads"
cd "${DEPLOY_DIR}/api"

# 创建 package.json
cat > package.json << 'PKGEOF'
{"name":"@promo/api","version":"1.0.0","private":true,"type":"module","scripts":{"dev":"tsx watch src/index.ts","build":"tsc","start":"node index.js"},"dependencies":{"bcryptjs":"^2.4.3","connect-mongo":"^5.1.0","cors":"^2.8.5","dotenv":"^17.4.2","express":"^4.21.0","express-rate-limit":"^8.5.1","express-session":"^1.18.1","multer":"^1.4.5-lts.1","mysql2":"^3.22.3","redis":"^5.12.1","uuid":"^11.0.0"},"devDependencies":{"@types/cors":"^2.8.17","@types/express":"^5.0.0","@types/multer":"^1.4.12","@types/uuid":"^10.0.0","tsx":"^4.19.0","typescript":"^5.7.0"}}
PKGEOF

# 创建 .env 文件
cat > .env << 'ENVEOF'
ENVEOF

# 数据库修复
echo "=== 修复数据库 ==="
mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" \
  -e "ALTER TABLE orders ADD COLUMN IF NOT EXISTS teamName VARCHAR(200) DEFAULT '' AFTER userPhone, ADD COLUMN IF NOT EXISTS userName VARCHAR(200) DEFAULT '' AFTER redirectUrl, ADD COLUMN IF NOT EXISTS userPhone VARCHAR(50) DEFAULT '' AFTER userName;" 2>/dev/null || true

mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" \
  -e "ALTER TABLE products ADD COLUMN IF NOT EXISTS requireName TINYINT(1) NOT NULL DEFAULT 0 AFTER offlineAt, ADD COLUMN IF NOT EXISTS requirePhone TINYINT(1) NOT NULL DEFAULT 0 AFTER requireName, ADD COLUMN IF NOT EXISTS categoryId VARCHAR(100) DEFAULT '' AFTER category, ADD COLUMN IF NOT EXISTS categoryNameSnapshot VARCHAR(200) DEFAULT '' AFTER categoryId;" 2>/dev/null || true

mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" \
  -e "CREATE TABLE IF NOT EXISTS employees (id VARCHAR(100) PRIMARY KEY, userId VARCHAR(100) NOT NULL, phone VARCHAR(50) NOT NULL, password VARCHAR(500) NOT NULL, nickname VARCHAR(200) DEFAULT '', expiresAt DATETIME NOT NULL, status VARCHAR(50) NOT NULL DEFAULT 'active', createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_userId (userId), INDEX idx_phone (phone), INDEX idx_expiresAt (expiresAt)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;" 2>/dev/null || true

mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" \
  -e "CREATE TABLE IF NOT EXISTS product_categories (id VARCHAR(100) PRIMARY KEY, name VARCHAR(200) NOT NULL, value VARCHAR(200) NOT NULL, sort INT NOT NULL DEFAULT 0, status VARCHAR(50) NOT NULL DEFAULT 'active', createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;" 2>/dev/null || true

mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" \
  -e "INSERT IGNORE INTO product_categories (id, name, value, sort, status, createdAt, updatedAt) VALUES ('cat_1', '综合-立返', 'comprehensive-instant', 1, 'active', NOW(), NOW()), ('cat_2', '综合-数据', 'comprehensive-data', 2, 'active', NOW(), NOW()), ('cat_3', '个养和加挂', 'personal-insurance', 3, 'active', NOW(), NOW()), ('cat_4', '限三-立返', 'limit3-instant', 4, 'active', NOW(), NOW()), ('cat_5', '限三-数据', 'limit3-data', 5, 'active', NOW(), NOW()), ('cat_6', '不限三-立返', 'unlimit3-instant', 6, 'active', NOW(), NOW()), ('cat_7', '不限三-数据', 'unlimit3-data', 7, 'active', NOW(), NOW()), ('cat_8', '三方-立返', 'third-party-instant', 8, 'active', NOW(), NOW()), ('cat_9', '三方-数据', 'third-party-data', 9, 'active', NOW(), NOW()), ('cat_10', '其它', 'other', 10, 'active', NOW(), NOW());" 2>/dev/null || true

# 停止旧进程
pm2 stop promo-api 2>/dev/null || true
pm2 delete promo-api 2>/dev/null || true

# 移动文件
if [ -f "dist/index.js" ]; then
  mv -f dist/* . 2>/dev/null || true
  rm -rf dist
fi

# 安装依赖
rm -rf node_modules package-lock.json
npm install --production --no-audit

# 启动服务
pm2 start index.js --name promo-api --cwd "${DEPLOY_DIR}/api" -f
sleep 5

# 更新 Nginx 配置
mkdir -p "${DEPLOY_DIR}/nginx"
if [ -f nginx-config/nginx.conf ]; then
  cp nginx-config/nginx.conf "${NGINX_CONF}"
fi

# 先清理所有可能冲突的 Nginx 配置
echo "🧹 清理所有可能冲突的 Nginx 配置..."
rm -f /etc/nginx/conf.d/*.conf /etc/nginx/sites-enabled/* 2>/dev/null
mkdir -p /etc/nginx/ssl
mkdir -p /var/www/html/.well-known/acme-challenge

# 检查是否有真实证书文件
HAS_REAL_CERT=0
# 优先检查 Let's Encrypt 证书
if [ -f /etc/letsencrypt/live/www.jlbtg.cn/fullchain.pem ] && [ -f /etc/letsencrypt/live/www.jlbtg.cn/privkey.pem ]; then
    echo "✅ 检测到 Let's Encrypt 证书，正在使用..."
    cp -f /etc/letsencrypt/live/www.jlbtg.cn/fullchain.pem /etc/nginx/ssl/www.jlbtg.cn.pem
    cp -f /etc/letsencrypt/live/www.jlbtg.cn/privkey.pem /etc/nginx/ssl/www.jlbtg.cn.key
    HAS_REAL_CERT=1
elif [ -f /etc/nginx/ssl/www.jlbtg.cn.pem ] && [ -f /etc/nginx/ssl/www.jlbtg.cn.key ]; then
    # 检查是否是自签名证书
    if openssl x509 -in /etc/nginx/ssl/www.jlbtg.cn.pem -text -noout 2>/dev/null | grep -q "issuer.*CN.*www.jlbtg.cn"; then
        echo "⚠️  检测到自签名证书，准备尝试获取真实证书..."
    else
        echo "✅ 检测到真实 SSL 证书"
        HAS_REAL_CERT=1
    fi
fi

# 尝试获取 Let's Encrypt 证书（如果没有真实证书）
if [ $HAS_REAL_CERT -eq 0 ] && command -v certbot &>/dev/null; then
    echo "🔐 尝试使用 certbot 获取 Let's Encrypt 证书..."
    # 使用 webroot 模式获取证书（更可靠）
    certbot certonly --webroot -w /var/www/html -d www.jlbtg.cn -d jlbtg.cn --non-interactive --agree-tos -m dev@jlbtg.cn 2>/dev/null || true
    
    # 如果 certbot 获取成功，复制到标准位置
    if [ -f /etc/letsencrypt/live/www.jlbtg.cn/fullchain.pem ] && [ -f /etc/letsencrypt/live/www.jlbtg.cn/privkey.pem ]; then
        cp -f /etc/letsencrypt/live/www.jlbtg.cn/fullchain.pem /etc/nginx/ssl/www.jlbtg.cn.pem
        cp -f /etc/letsencrypt/live/www.jlbtg.cn/privkey.pem /etc/nginx/ssl/www.jlbtg.cn.key
        echo "✅ Let's Encrypt 证书已安装"
        HAS_REAL_CERT=1
    fi
fi

# 如果仍然没有证书，创建自签名证书作为备用方案
if [ $HAS_REAL_CERT -eq 0 ]; then
    if [ ! -f /etc/nginx/ssl/www.jlbtg.cn.pem ] || [ ! -f /etc/nginx/ssl/www.jlbtg.cn.key ]; then
        echo "⚠️  未能获取真实证书，正在创建自签名证书用于临时测试..."
        openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
            -keyout /etc/nginx/ssl/www.jlbtg.cn.key \
            -out /etc/nginx/ssl/www.jlbtg.cn.pem \
            -subj "/C=CN/ST=Beijing/L=Beijing/O=Dev/OU=Dev/CN=www.jlbtg.cn/emailAddress=dev@jlbtg.cn" 2>/dev/null || true
    fi
fi

# 强制重写 Nginx 配置确保跳转
cat > "${NGINX_CONF}" << 'NGINXEOF'
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
    location /admin/ { alias /www/wwwroot/promo-hub/admin/; index index.html; try_files $uri $uri/ /admin/index.html; }
    
    # 渠道经理后台
    location /manager/ { alias /www/wwwroot/promo-hub/manager/; index index.html; try_files $uri $uri/ /manager/index.html; }
    
    # 用户端
    location /user/ { alias /www/wwwroot/promo-hub/user/; index index.html; try_files $uri $uri/ /user/index.html; }
    
    # API 反向代理
    location /api/ { proxy_pass http://127.0.0.1:3000/; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
    
    # 根路径精确匹配 - 跳转到 /user/
    location = / { return 302 /user/; }
}
NGINXEOF

nginx -t && nginx -s reload

echo "🎉 部署完成！"
echo "User files: $(ls ${DEPLOY_DIR}/user/ 2>/dev/null | wc -l)"
