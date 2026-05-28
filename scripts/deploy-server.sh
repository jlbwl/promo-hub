#!/bin/bash
# ============================================================
# 服务器部署脚本 - 在阿里云服务器上执行
# ============================================================

set -e

DEPLOY_DIR="/www/wwwroot/promo-hub"
NGINX_CONF="/etc/nginx/conf.d/promo-hub.conf"

echo "🚀 开始服务器部署..."

# 1. 清理根目录旧文件，防止意外跳转
echo "=== 清理根目录旧文件 ==="
rm -f "${DEPLOY_DIR}/index.html" "${DEPLOY_DIR}/index.htm" 2>/dev/null || true
rm -f /var/www/html/index.html /usr/share/nginx/html/index.html 2>/dev/null || true

# 2. 创建 API 目录
mkdir -p "${DEPLOY_DIR}/api/data/uploads"
cd "${DEPLOY_DIR}/api"

# 3. 创建 package.json
echo '{"name":"@promo/api","version":"1.0.0","private":true,"type":"module","scripts":{"dev":"tsx watch src/index.ts","build":"tsc","start":"node index.js"},"dependencies":{"bcryptjs":"^2.4.3","connect-mongo":"^5.1.0","cors":"^2.8.5","dotenv":"^17.4.2","express":"^4.21.0","express-rate-limit":"^8.5.1","express-session":"^1.18.1","multer":"^1.4.5-lts.1","mysql2":"^3.22.3","redis":"^5.12.1","uuid":"^11.0.0"},"devDependencies":{"@types/cors":"^2.8.17","@types/express":"^5.0.0","@types/multer":"^1.4.12","@types/uuid":"^10.0.0","tsx":"^4.19.0","typescript":"^5.7.0"}}' > package.json

# 4. 创建 .env 文件
cat > .env << 'ENVEOF'
ENVEOF

# 5. 自动修复数据库 Schema
echo "=== 开始自动修复数据库 Schema ==="

# 修复 orders 表缺少的字段
echo "--- 修复 orders 表 ---"
mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" -e "ALTER TABLE orders ADD COLUMN IF NOT EXISTS teamName VARCHAR(200) DEFAULT '' AFTER userPhone;" 2>/dev/null && echo "✓ teamName 字段已添加" || echo "⚠ teamName 字段可能已存在"
mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" -e "ALTER TABLE orders ADD COLUMN IF NOT EXISTS userName VARCHAR(200) DEFAULT '' AFTER redirectUrl;" 2>/dev/null && echo "✓ userName 字段已添加" || echo "⚠ userName 字段可能已存在"
mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" -e "ALTER TABLE orders ADD COLUMN IF NOT EXISTS userPhone VARCHAR(50) DEFAULT '' AFTER userName;" 2>/dev/null && echo "✓ userPhone 字段已添加" || echo "⚠ userPhone 字段可能已存在"

# 修复 employees 表
echo "--- 修复 employees 表 ---"
mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" -e "CREATE TABLE IF NOT EXISTS employees (id VARCHAR(100) PRIMARY KEY, userId VARCHAR(100) NOT NULL, phone VARCHAR(50) NOT NULL, password VARCHAR(500) NOT NULL, nickname VARCHAR(200) DEFAULT '', expiresAt DATETIME NOT NULL, status VARCHAR(50) NOT NULL DEFAULT 'active', createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_userId (userId), INDEX idx_phone (phone), INDEX idx_expiresAt (expiresAt)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;" 2>/dev/null && echo "✓ employees 表已创建或已存在" || echo "⚠ employees 表创建可能失败"

# 初始化产品分类表
echo "--- 初始化产品分类表 ---"
mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" -e "CREATE TABLE IF NOT EXISTS product_categories (id VARCHAR(100) PRIMARY KEY, name VARCHAR(200) NOT NULL, value VARCHAR(200) NOT NULL, sort INT NOT NULL DEFAULT 0, status VARCHAR(50) NOT NULL DEFAULT 'active', createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;" 2>/dev/null && echo "✓ product_categories 表已创建" || echo "⚠ product_categories 表创建可能失败"

# 为 products 表添加分类字段
mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" -e "ALTER TABLE products ADD COLUMN IF NOT EXISTS categoryId VARCHAR(100) DEFAULT '' AFTER category;" 2>/dev/null && echo "✓ categoryId 字段已添加" || echo "⚠ categoryId 字段可能已存在"
mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" -e "ALTER TABLE products ADD COLUMN IF NOT EXISTS categoryNameSnapshot VARCHAR(200) DEFAULT '' AFTER categoryId;" 2>/dev/null && echo "✓ categoryNameSnapshot 字段已添加" || echo "⚠ categoryNameSnapshot 字段可能已存在"

# 初始化默认分类数据
mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" -e "INSERT IGNORE INTO product_categories (id, name, value, sort, status, createdAt, updatedAt) VALUES ('cat_1', '综合-立返', 'comprehensive-instant', 1, 'active', NOW(), NOW()), ('cat_2', '综合-数据', 'comprehensive-data', 2, 'active', NOW(), NOW()), ('cat_3', '个养和加挂', 'personal-insurance', 3, 'active', NOW(), NOW()), ('cat_4', '限三-立返', 'limit3-instant', 4, 'active', NOW(), NOW()), ('cat_5', '限三-数据', 'limit3-data', 5, 'active', NOW(), NOW()), ('cat_6', '不限三-立返', 'unlimit3-instant', 6, 'active', NOW(), NOW()), ('cat_7', '不限三-数据', 'unlimit3-data', 7, 'active', NOW(), NOW()), ('cat_8', '三方-立返', 'third-party-instant', 8, 'active', NOW(), NOW()), ('cat_9', '三方-数据', 'third-party-data', 9, 'active', NOW(), NOW()), ('cat_10', '其它', 'other', 10, 'active', NOW(), NOW());" 2>/dev/null && echo "✓ 默认分类数据已插入" || echo "⚠ 默认分类数据插入可能失败"

# 6. 停止旧进程
echo "=== 停止旧进程 ==="
pm2 stop promo-api 2>/dev/null || true
pm2 delete promo-api 2>/dev/null || true
pm2 save --force 2>/dev/null || true

# 7. 检查上传的文件
echo "=== 检查上传的文件 ==="
ls -la

# 8. 强制安装依赖
echo "=== 强制安装依赖 ==="
rm -rf node_modules package-lock.json
npm install --production --no-audit 2>&1
echo "✓ 依赖安装完成"

# 9. 启动服务
echo "=== 启动 API 服务 ==="
pm2 start index.js --name promo-api --cwd "${DEPLOY_DIR}/api" -f
sleep 5

# 10. 检查服务状态
echo "=== API 服务状态 ==="
pm2 status

# 11. 更新 Nginx 配置
echo "=== 更新 Nginx 配置 ==="
mkdir -p "${DEPLOY_DIR}/nginx"
if [ -f nginx-config/nginx.conf ]; then
  cp nginx-config/nginx.conf "${NGINX_CONF}"
  echo "✓ Nginx配置已复制"
fi

# 12. 测试并重载 Nginx
echo "=== 测试并重载 Nginx ==="
nginx -t
nginx -s reload

echo ""
echo "🎉 部署完成！"
echo "=== 文件统计 ==="
echo "Admin files: $(ls ${DEPLOY_DIR}/admin/ 2>/dev/null | wc -l)"
echo "Manager files: $(ls ${DEPLOY_DIR}/manager/ 2>/dev/null | wc -l)"
echo "User files: $(ls ${DEPLOY_DIR}/user/ 2>/dev/null | wc -l)"
