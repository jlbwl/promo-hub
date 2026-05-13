-- ===============================================
-- 完整的数据库初始化与列添加脚本
-- ===============================================

-- 确保 cart 表存在
CREATE TABLE IF NOT EXISTS cart (
  id VARCHAR(100) PRIMARY KEY,
  userId VARCHAR(100) NOT NULL COMMENT '用户ID（主账户）',
  managerId VARCHAR(100) DEFAULT '' COMMENT '所属经理ID',
  productId VARCHAR(100) NOT NULL COMMENT '产品ID',
  productName VARCHAR(500) DEFAULT '' COMMENT '产品名称',
  productPrice DECIMAL(10,2) DEFAULT 0 COMMENT '产品单价',
  coverImage VARCHAR(1000) DEFAULT '' COMMENT '产品封面图',
  optionLabel VARCHAR(500) DEFAULT '' COMMENT '选择的选项',
  redirectUrl VARCHAR(2000) DEFAULT '' COMMENT '跳转链接',
  addedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '加入购物车时间',
  INDEX idx_userId (userId),
  INDEX idx_managerId (managerId),
  INDEX idx_productId (productId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 确保 orders 表有 deleted 和 deletedAt
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deleted TINYINT(1) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS deletedAt DATETIME DEFAULT NULL;

-- 添加 deleted 相关索引（如果不存在）
ALTER TABLE orders ADD INDEX IF NOT EXISTS idx_deleted (deleted);
ALTER TABLE orders ADD INDEX IF NOT EXISTS idx_deleted_manager (deleted, managerId);

-- 确保 orders 有其他必需列
ALTER TABLE orders ADD COLUMN IF NOT EXISTS userName VARCHAR(200) DEFAULT '' AFTER redirectUrl;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS userPhone VARCHAR(50) DEFAULT '' AFTER userName;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS teamName VARCHAR(200) DEFAULT '' AFTER userPhone;

-- 确保 products 表有 managerId
ALTER TABLE products ADD COLUMN IF NOT EXISTS managerId VARCHAR(100) DEFAULT '' AFTER status;

-- 检查表
SHOW TABLES;
DESCRIBE cart;
DESCRIBE orders;
DESCRIBE products;
