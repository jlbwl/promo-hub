#!/bin/bash
# ============================================================
# 一键修复数据库 Schema 脚本
# 使用方法：bash fix-database.sh
# ============================================================

set -e

echo "🔧 开始修复数据库 Schema..."

# 读取环境变量
if [ -f .env ]; then
  source .env
else
  echo "❌ .env 文件不存在，请先创建"
  exit 1
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-promo_hub}"

echo "📊 数据库信息："
echo "  主机: ${DB_HOST}"
echo "  端口: ${DB_PORT}"
echo "  用户: ${DB_USER}"
echo "  数据库: ${DB_NAME}"

# 检查 MySQL 客户端
if ! command -v mysql &> /dev/null; then
    echo "⚠️  MySQL 客户端未安装"
    echo "请选择一种方式安装："
    echo ""
    echo "方式1（Ubuntu/Debian）："
    echo "  sudo apt-get update && sudo apt-get install -y mysql-client"
    echo ""
    echo "方式2（CentOS/RHEL）："
    echo "  sudo yum install -y mysql"
    echo ""
    echo "方式3（Mac）："
    echo "  brew install mysql"
    echo ""
    echo "方式4：使用 Docker"
    echo "  docker run -it --rm mysql mysql -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} -p${DB_PASSWORD} ${DB_NAME}"
    exit 1
fi

echo ""
echo "✅ MySQL 客户端已安装，开始修复..."

# 修复 orders 表
echo ""
echo "📝 修复 orders 表..."

echo "  → 添加 teamName 字段"
mysql -h "${DB_HOST}" \
      -P "${DB_PORT}" \
      -u "${DB_USER}" \
      -p"${DB_PASSWORD}" \
      "${DB_NAME}" \
      -e "ALTER TABLE orders ADD COLUMN IF NOT EXISTS teamName VARCHAR(200) DEFAULT '' AFTER userPhone;" \
      2>/dev/null && echo "  ✅ teamName 已添加" || echo "  ⚠️ teamName 可能已存在"

echo "  → 添加 userName 字段"
mysql -h "${DB_HOST}" \
      -P "${DB_PORT}" \
      -u "${DB_USER}" \
      -p"${DB_PASSWORD}" \
      "${DB_NAME}" \
      -e "ALTER TABLE orders ADD COLUMN IF NOT EXISTS userName VARCHAR(200) DEFAULT '' AFTER redirectUrl;" \
      2>/dev/null && echo "  ✅ userName 已添加" || echo "  ⚠️ userName 可能已存在"

echo "  → 添加 userPhone 字段"
mysql -h "${DB_HOST}" \
      -P "${DB_PORT}" \
      -u "${DB_USER}" \
      -p"${DB_PASSWORD}" \
      "${DB_NAME}" \
      -e "ALTER TABLE orders ADD COLUMN IF NOT EXISTS userPhone VARCHAR(50) DEFAULT '' AFTER userName;" \
      2>/dev/null && echo "  ✅ userPhone 已添加" || echo "  ⚠️ userPhone 可能已存在"

# 修复 products 表
echo ""
echo "📝 修复 products 表..."

echo "  → 添加 requireName 字段"
mysql -h "${DB_HOST}" \
      -P "${DB_PORT}" \
      -u "${DB_USER}" \
      -p"${DB_PASSWORD}" \
      "${DB_NAME}" \
      -e "ALTER TABLE products ADD COLUMN IF NOT EXISTS requireName TINYINT(1) NOT NULL DEFAULT 0 AFTER offlineAt;" \
      2>/dev/null && echo "  ✅ requireName 已添加" || echo "  ⚠️ requireName 可能已存在"

echo "  → 添加 requirePhone 字段"
mysql -h "${DB_HOST}" \
      -P "${DB_PORT}" \
      -u "${DB_USER}" \
      -p"${DB_PASSWORD}" \
      "${DB_NAME}" \
      -e "ALTER TABLE products ADD COLUMN IF NOT EXISTS requirePhone TINYINT(1) NOT NULL DEFAULT 0 AFTER requireName;" \
      2>/dev/null && echo "  ✅ requirePhone 已添加" || echo "  ⚠️ requirePhone 可能已存在"

# 验证结果
echo ""
echo "🔍 验证修复结果..."
echo ""
echo "orders 表结构："
mysql -h "${DB_HOST}" \
      -P "${DB_PORT}" \
      -u "${DB_USER}" \
      -p"${DB_PASSWORD}" \
      "${DB_NAME}" \
      -e "DESCRIBE orders;" 2>/dev/null | grep -E "teamName|userName|userPhone" || echo "  (无相关字段)"

echo ""
echo "products 表结构："
mysql -h "${DB_HOST}" \
      -P "${DB_PORT}" \
      -u "${DB_USER}" \
      -p"${DB_PASSWORD}" \
      "${DB_NAME}" \
      -e "DESCRIBE products;" 2>/dev/null | grep -E "requireName|requirePhone" || echo "  (无相关字段)"

echo ""
echo "🎉 数据库修复完成！"
echo ""
echo "现在可以测试做单功能了！"
