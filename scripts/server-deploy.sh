#!/bin/bash
set -e

echo "🚀 开始服务器部署..."

# 配置变量
DEPLOY_DIR="/www/wwwroot/promo-hub"
NGINX_CONF="/etc/nginx/conf.d/promo-hub.conf"

# 清理干扰文件
echo "=== 清理根目录旧文件 ==="
rm -f "${DEPLOY_DIR}/index.html" "${DEPLOY_DIR}/index.htm" 2>/dev/null || true
rm -f /var/www/html/index.html /usr/share/nginx/html/index.html 2>/dev/null || true

# 创建必要目录
mkdir -p "${DEPLOY_DIR}/api/data/uploads"
cd "${DEPLOY_DIR}/api"

# 创建 package.json
cat > package.json << 'PKGEOF'
{"name":"@promo/api","version":"1.0.0","private":true,"type":"module","scripts":{"dev":"tsx watch src/index.ts","build":"tsc","start":"node index.js"},"dependencies":{"bcryptjs":"^2.4.3","connect-mongo":"^5.1.0","cors":"^2.8.5","dotenv":"^17.4.2","express":"^4.21.0","express-rate-limit":"^8.5.1","express-session":"^1.18.1","multer":"^1.4.5-lts.1","mysql2":"^3.22.3","redis":"^5.12.1","uuid":"^11.0.0"},"devDependencies":{"@types/cors":"^2.8.17","@types/express":"^5.0.0","@types/multer":"^1.4.12","@types/uuid":"^10.0.0","tsx":"^4.19.0","typescript":"^5.7.0"}}
PKGEOF

# 数据库修复
echo "=== 修复数据库 ==="
if command -v mysql &> /dev/null; then
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
fi

# 停止旧进程
pm2 stop promo-api 2>/dev/null || true
pm2 delete promo-api 2>/dev/null || true

# 移动构建文件
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

# 更新 Nginx 配置 - 确保根路径跳转到 /user/
mkdir -p "${DEPLOY_DIR}/nginx"
if [ -f nginx-config/nginx.conf ]; then
  cp nginx-config/nginx.conf "${NGINX_CONF}"
fi

# 强制重写 Nginx 配置
cat > "${NGINX_CONF}" << 'NGINXEOF'
server {
    listen 80;
    server_name _;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_min_length 1024;
    location = / { return 302 /user/; }
    location / { return 302 /user/; }
    location /admin/ { alias /www/wwwroot/promo-hub/admin/; index index.html; try_files $uri $uri/ /admin/index.html; }
    location /manager/ { alias /www/wwwroot/promo-hub/manager/; index index.html; try_files $uri $uri/ /manager/index.html; }
    location /user/ { alias /www/wwwroot/promo-hub/user/; index index.html; try_files $uri $uri/ /user/index.html; }
    location /api/ { proxy_pass http://127.0.0.1:3000/; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; }
}
NGINXEOF

# 测试并重载 Nginx
nginx -t && nginx -s reload

echo "🎉 部署完成！"
echo "User files: $(ls ${DEPLOY_DIR}/user/ 2>/dev/null | wc -l)"
