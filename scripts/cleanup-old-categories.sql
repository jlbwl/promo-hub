-- 清理旧的硬编码分类并初始化动态分类
-- 执行前请备份数据库！

-- 1. 查看当前所有分类
SELECT '清理前的分类数据:' as info;
SELECT * FROM product_categories ORDER BY sort;

-- 2. 删除所有旧分类
DELETE FROM product_categories;
SELECT '已删除所有旧分类' as info;

-- 3. 插入新的动态分类（您可以根据需要修改）
INSERT INTO product_categories (id, name, value, sort, status, createdAt, updatedAt) VALUES
('cat_1700000000001', '综合-立返', 'comprehensive-instant', 1, 'active', NOW(), NOW()),
('cat_1700000000002', '综合-数据', 'comprehensive-data', 2, 'active', NOW(), NOW()),
('cat_1700000000003', '个养和加挂', 'personal-insurance', 3, 'active', NOW(), NOW()),
('cat_1700000000004', '限三-立返', 'limit3-instant', 4, 'active', NOW(), NOW()),
('cat_1700000000005', '限三-数据', 'limit3-data', 5, 'active', NOW(), NOW()),
('cat_1700000000006', '不限三-立返', 'unlimit3-instant', 6, 'active', NOW(), NOW()),
('cat_1700000000007', '不限三-数据', 'unlimit3-data', 7, 'active', NOW(), NOW());

SELECT '已插入新的动态分类' as info;

-- 4. 验证分类数据
SELECT * FROM product_categories ORDER BY sort;

-- 5. 查看所有产品及其分类关联
SELECT 
  p.id,
  p.title,
  p.category as old_category_field,
  p.categoryId,
  p.categoryNameSnapshot,
  pc.name as real_category_name,
  pc.value as real_category_value
FROM products p
LEFT JOIN product_categories pc ON p.categoryId = pc.id
ORDER BY p.createdAt DESC
LIMIT 20;

-- 6. 更新现有产品的分类关联（如果有的话）
-- 这个步骤将产品的旧 category 字段同步到 categoryId 和 categoryNameSnapshot
UPDATE products p
INNER JOIN product_categories pc ON p.category = pc.value
SET 
  p.categoryId = pc.id,
  p.categoryNameSnapshot = pc.name
WHERE p.categoryId IS NULL OR p.categoryId = '';

SELECT '已更新现有产品的分类关联' as info;

-- 7. 再次查看产品分类关联
SELECT 
  p.id,
  p.title,
  p.categoryId,
  p.categoryNameSnapshot,
  pc.name as real_category_name
FROM products p
LEFT JOIN product_categories pc ON p.categoryId = pc.id
ORDER BY p.createdAt DESC
LIMIT 20;
