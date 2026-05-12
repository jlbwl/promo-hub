-- 为 orders 表的 deleted 字段添加索引，加速软删除查询
ALTER TABLE orders ADD INDEX idx_deleted (deleted);

-- 为复合查询添加组合索引
ALTER TABLE orders ADD INDEX idx_deleted_manager (deleted, managerId);
