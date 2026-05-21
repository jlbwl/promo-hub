-- =============================================
-- 修复 products 表：添加 categoryId 和 categoryNameSnapshot 列
-- =============================================

-- 添加 categoryId 列（如果不存在）
ALTER TABLE products ADD COLUMN IF NOT EXISTS categoryId VARCHAR(100) DEFAULT '' AFTER category;

-- 添加 categoryNameSnapshot 列（如果不存在）
ALTER TABLE products ADD COLUMN IF NOT EXISTS categoryNameSnapshot VARCHAR(200) DEFAULT '' AFTER categoryId;

-- 查看表结构确认
SHOW CREATE TABLE products;
