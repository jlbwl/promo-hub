import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env') })

// 数据库连接配置（从环境变量读取）
const pool = mysql.createPool({
  host: process.env.DB_HOST || '',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  connectTimeout: 10000,
})

// 通用查询方法（带超时）
export async function query(sql: string, params?: any[]): Promise<any> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Query timeout')), 20000)
  })
  const queryPromise = pool.execute(sql, params)
  const [rows] = await Promise.race([queryPromise, timeoutPromise]) as any
  return rows
}

export async function queryOne(sql: string, params?: any[]): Promise<any> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Query timeout')), 20000)
  })
  const queryPromise = pool.execute(sql, params)
  const [rows] = await Promise.race([queryPromise, timeoutPromise]) as any
  return (rows as any[])[0] || null
}

// 初始化数据库表
export async function initDatabase(): Promise<void> {
  // 产品表
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(100) PRIMARY KEY,
      title VARCHAR(500) NOT NULL DEFAULT '',
      description LONGTEXT,
      coverImage VARCHAR(1000) DEFAULT '',
      images JSON DEFAULT NULL,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      originalPrice DECIMAL(10,2) DEFAULT 0,
      category VARCHAR(100) DEFAULT '',
      status VARCHAR(50) NOT NULL DEFAULT 'draft',
      managerId VARCHAR(100) DEFAULT '',
      stock INT NOT NULL DEFAULT 0,
      options JSON DEFAULT NULL,
      publishedBy VARCHAR(200) DEFAULT '',
      publishedAt DATETIME DEFAULT NULL,
      offlineReason TEXT DEFAULT NULL,
      offlineAt DATETIME DEFAULT NULL,
      requireName TINYINT(1) NOT NULL DEFAULT 0,
      requirePhone TINYINT(1) NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // 新增 requireName 和 requirePhone 列（如果不存在）
  try {
    await pool.execute('ALTER TABLE products ADD COLUMN requireName TINYINT(1) NOT NULL DEFAULT 0 AFTER offlineAt')
  } catch (e) { /* 列可能已存在，忽略错误 */ }
  try {
    await pool.execute('ALTER TABLE products ADD COLUMN requirePhone TINYINT(1) NOT NULL DEFAULT 0 AFTER requireName')
  } catch (e) { /* 列可能已存在，忽略错误 */ }

  // 修改 description 字段为 LONGTEXT（如果不已经是）
  try {
    await pool.execute('ALTER TABLE products MODIFY COLUMN description LONGTEXT')
    console.log('[DB] description column changed to LONGTEXT')
  } catch (e) { /* 忽略错误 */ }

  // 渠道经理表
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS managers (
      id VARCHAR(100) PRIMARY KEY,
      username VARCHAR(200) NOT NULL,
      password VARCHAR(500) NOT NULL DEFAULT '',
      name VARCHAR(200) DEFAULT '',
      phone VARCHAR(50) DEFAULT '',
      teamName VARCHAR(200) DEFAULT '',
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // 新增 teamName 列（如果不存在）
  try {
    await pool.execute('ALTER TABLE managers ADD COLUMN teamName VARCHAR(200) DEFAULT "" AFTER phone')
  } catch (e) { /* 列可能已存在，忽略错误 */ }

  // 用户表
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(100) PRIMARY KEY,
      phone VARCHAR(50) DEFAULT '',
      password VARCHAR(500) NOT NULL DEFAULT '',
      nickname VARCHAR(200) DEFAULT '',
      teamName VARCHAR(200) DEFAULT '',
      role VARCHAR(50) NOT NULL DEFAULT 'user',
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      alipayUserId VARCHAR(200) DEFAULT '',
      wechatOpenId VARCHAR(200) DEFAULT '',
      loginMethods JSON DEFAULT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // 新增 teamName 列（如果不存在）
  try {
    await pool.execute('ALTER TABLE users ADD COLUMN teamName VARCHAR(200) DEFAULT "" AFTER nickname')
  } catch (e) { /* 列可能已存在，忽略错误 */ }

  // 订单表
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(100) PRIMARY KEY,
      productId VARCHAR(100) DEFAULT '',
      userId VARCHAR(100) DEFAULT '',
      managerId VARCHAR(100) DEFAULT '',
      productName VARCHAR(500) DEFAULT '',
      productPrice DECIMAL(10,2) DEFAULT 0,
      optionLabel VARCHAR(500) DEFAULT '',
      redirectUrl VARCHAR(2000) DEFAULT '',
      userName VARCHAR(200) DEFAULT '',
      userPhone VARCHAR(50) DEFAULT '',
      teamName VARCHAR(200) DEFAULT '',
      fundAccount VARCHAR(200) DEFAULT '',
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      reviewedAt DATETIME DEFAULT NULL,
      rejectReason TEXT DEFAULT NULL,
      addedToPaymentAt DATETIME DEFAULT NULL,
      settledAt DATETIME DEFAULT NULL,
      transferredFromManager VARCHAR(200) DEFAULT '',
      transferredAt DATETIME DEFAULT NULL,
      managedBy VARCHAR(50) DEFAULT 'manager',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted TINYINT(1) DEFAULT 0,
      deletedAt DATETIME DEFAULT NULL,
      INDEX idx_deleted (deleted),
      INDEX idx_deleted_manager (deleted, managerId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // 新增 deleted 相关列（如果不存在）
  try {
    await pool.execute('ALTER TABLE orders ADD COLUMN deleted TINYINT(1) DEFAULT 0')
  } catch (e) { /* 列可能已存在，忽略错误 */ }
  try {
    await pool.execute('ALTER TABLE orders ADD COLUMN deletedAt DATETIME DEFAULT NULL')
  } catch (e) { /* 列可能已存在，忽略错误 */ }
  // 新增 userName、userPhone 和 teamName 列（如果不存在）
  try {
    await pool.execute('ALTER TABLE orders ADD COLUMN userName VARCHAR(200) DEFAULT "" AFTER redirectUrl')
  } catch (e) { /* 列可能已存在，忽略错误 */ }
  try {
    await pool.execute('ALTER TABLE orders ADD COLUMN userPhone VARCHAR(50) DEFAULT "" AFTER userName')
  } catch (e) { /* 列可能已存在，忽略错误 */ }
  try {
    await pool.execute('ALTER TABLE orders ADD COLUMN teamName VARCHAR(200) DEFAULT "" AFTER userPhone')
  } catch (e) { /* 列可能已存在，忽略错误 */ }
  // 新增 fundAccount 列（如果不存在）
  try {
    await pool.execute('ALTER TABLE orders ADD COLUMN fundAccount VARCHAR(200) DEFAULT "" AFTER teamName')
  } catch (e) { /* 列可能已存在，忽略错误 */ }
  // 添加 deleted 相关索引（如果不存在）
  try {
    await pool.execute('ALTER TABLE orders ADD INDEX idx_deleted (deleted)')
  } catch (e) { /* 索引可能已存在，忽略错误 */ }
  try {
    await pool.execute('ALTER TABLE orders ADD INDEX idx_deleted_manager (deleted, managerId)')
  } catch (e) { /* 索引可能已存在，忽略错误 */ }

  // 佣金表
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS commissions (
      id VARCHAR(100) PRIMARY KEY,
      orderId VARCHAR(100) DEFAULT '',
      userId VARCHAR(100) DEFAULT '',
      managerId VARCHAR(100) DEFAULT '',
      productName VARCHAR(500) DEFAULT '',
      amount DECIMAL(10,2) DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      approvedAt DATETIME DEFAULT NULL,
      paidAt DATETIME DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // 员工子账户表
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS employees (
      id VARCHAR(100) PRIMARY KEY,
      userId VARCHAR(100) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      password VARCHAR(500) NOT NULL,
      nickname VARCHAR(200) DEFAULT '',
      expiresAt DATETIME NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_userId (userId),
      INDEX idx_phone (phone),
      INDEX idx_expiresAt (expiresAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // 确保 employees 表的所有列都存在
  try {
    await pool.execute('ALTER TABLE employees ADD COLUMN userId VARCHAR(100) NOT NULL AFTER id')
  } catch (e) { /* 忽略错误 */ }
  try {
    await pool.execute('ALTER TABLE employees ADD COLUMN phone VARCHAR(50) NOT NULL AFTER userId')
  } catch (e) { /* 忽略错误 */ }
  try {
    await pool.execute('ALTER TABLE employees ADD COLUMN password VARCHAR(500) NOT NULL AFTER phone')
  } catch (e) { /* 忽略错误 */ }
  try {
    await pool.execute('ALTER TABLE employees ADD COLUMN nickname VARCHAR(200) DEFAULT "" AFTER password')
  } catch (e) { /* 忽略错误 */ }
  try {
    await pool.execute('ALTER TABLE employees ADD COLUMN expiresAt DATETIME NOT NULL AFTER nickname')
  } catch (e) { /* 忽略错误 */ }
  try {
    await pool.execute('ALTER TABLE employees ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT "active" AFTER expiresAt')
  } catch (e) { /* 忽略错误 */ }
  try {
    await pool.execute('ALTER TABLE employees ADD COLUMN createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER status')
  } catch (e) { /* 忽略错误 */ }
  try {
    await pool.execute('ALTER TABLE employees ADD COLUMN updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER createdAt')
  } catch (e) { /* 忽略错误 */ }

  // 确保索引存在
  try {
    await pool.execute('ALTER TABLE employees ADD INDEX idx_userId (userId)')
  } catch (e) { /* 忽略错误 */ }
  try {
    await pool.execute('ALTER TABLE employees ADD INDEX idx_phone (phone)')
  } catch (e) { /* 忽略错误 */ }
  try {
    await pool.execute('ALTER TABLE employees ADD INDEX idx_expiresAt (expiresAt)')
  } catch (e) { /* 忽略错误 */ }

  // 管理员表
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS admins (
      id VARCHAR(100) PRIMARY KEY,
      phone VARCHAR(50) NOT NULL,
      password VARCHAR(500) NOT NULL,
      name VARCHAR(200) DEFAULT '超级管理员',
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // 操作日志表
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id VARCHAR(100) PRIMARY KEY,
      adminId VARCHAR(100) DEFAULT '',
      adminPhone VARCHAR(50) DEFAULT '',
      adminName VARCHAR(200) DEFAULT '',
      operationType VARCHAR(100) NOT NULL,
      targetType VARCHAR(100) NOT NULL,
      targetId VARCHAR(100) DEFAULT '',
      targetName VARCHAR(500) DEFAULT '',
      reason VARCHAR(1000) DEFAULT '',
      detail TEXT DEFAULT '',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // 购物车表
  await pool.execute(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // 产品分类表
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS product_categories (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(200) NOT NULL COMMENT '分类名称',
      value VARCHAR(200) NOT NULL COMMENT '分类值（兼容旧数据）',
      sort INT NOT NULL DEFAULT 0 COMMENT '排序',
      status VARCHAR(50) NOT NULL DEFAULT 'active' COMMENT '状态：active/archived',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_sort (sort)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // 修改产品表，添加分类ID和分类快照字段
  try {
    await pool.execute('ALTER TABLE products ADD COLUMN categoryId VARCHAR(100) DEFAULT "" AFTER category')
  } catch (e) { /* 列可能已存在，忽略错误 */ }
  try {
    await pool.execute('ALTER TABLE products ADD COLUMN categoryNameSnapshot VARCHAR(200) DEFAULT "" AFTER categoryId')
  } catch (e) { /* 列可能已存在，忽略错误 */ }

  // 分类表由管理后台手动维护，不再自动创建默认分类
  console.log('[DB] Product categories table exists, managed by admin panel')

  // 检查是否有管理员账号，没有则创建默认账号
  const [adminRows] = await pool.execute('SELECT COUNT(*) as count FROM admins')
  const adminCount = (adminRows as any[])[0].count
  if (adminCount === 0) {
    await pool.execute(
      'INSERT INTO admins (id, phone, password, name, status) VALUES (?, ?, ?, ?, ?)',
      ['admin_1', '[REDACTED_ADMIN_PHONE]', '[REDACTED_ADMIN_PASSWORD]', '超级管理员', 'active']
    )
    console.log('[DB] Default admin account created: [REDACTED_ADMIN_PHONE] / [REDACTED_ADMIN_PASSWORD]')
  }

  console.log('[DB] MySQL tables initialized successfully')
}

export default pool
