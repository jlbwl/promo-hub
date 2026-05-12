-- =============================================
-- 修复数据库问题：添加缺失的列和索引
-- =============================================

-- 1. 确保 orders 表有 deleted 和 deletedAt 列
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted TINYINT(1) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deletedAt DATETIME DEFAULT NULL;

-- 2. 添加索引（如果不存在）
ALTER TABLE orders ADD INDEX idx_deleted (deleted);
ALTER TABLE orders ADD INDEX idx_deleted_manager (deleted, managerId);

-- 3. 确保其他必要列存在
ALTER TABLE orders ADD COLUMN IF NOT EXISTS teamName VARCHAR(200) DEFAULT '' AFTER userPhone;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS userName VARCHAR(200) DEFAULT '' AFTER redirectUrl;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS userPhone VARCHAR(50) DEFAULT '' AFTER userName;

-- 4. 确保 products 表有 managerId 列
ALTER TABLE products ADD COLUMN IF NOT EXISTS managerId VARCHAR(100) DEFAULT '' AFTER status;

-- 5. 查看表结构确认
SHOW CREATE TABLE orders;
SHOW CREATE TABLE products;
