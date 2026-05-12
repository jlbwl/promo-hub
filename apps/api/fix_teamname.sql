-- 修复 orders 表缺少 teamName 字段
-- 执行此脚本修复数据库

ALTER TABLE orders ADD COLUMN IF NOT EXISTS teamName VARCHAR(200) DEFAULT '' AFTER userPhone;

-- 如果上面的语句不支持 IF NOT EXISTS，使用下面的语句：
-- ALTER TABLE orders ADD COLUMN teamName VARCHAR(200) DEFAULT '';

-- 验证字段是否存在
DESCRIBE orders;
