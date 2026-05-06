import mysql from 'mysql2/promise'

// 数据库连接配置（从环境变量读取，生产环境通过 .env 配置）
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'rm-2zed47q2696h20ai9.mysql.rds.aliyuncs.com',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'promo_admin',
  password: process.env.DB_PASSWORD || 'jlbwl@416',
  database: process.env.DB_NAME || 'promo_hub',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
})

// 通用查询方法
export async function query(sql: string, params?: any[]): Promise<any> {
  const [rows] = await pool.execute(sql, params)
  return rows
}

export async function queryOne(sql: string, params?: any[]): Promise<any> {
  const [rows] = await pool.execute(sql, params)
  return (rows as any[])[0] || null
}

// 初始化数据库表
export async function initDatabase(): Promise<void> {
  // 产品表
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(100) PRIMARY KEY,
      title VARCHAR(500) NOT NULL DEFAULT '',
      description TEXT,
      coverImage VARCHAR(1000) DEFAULT '',
      images JSON DEFAULT NULL,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      originalPrice DECIMAL(10,2) DEFAULT 0,
      commission DECIMAL(10,2) DEFAULT 0,
      commissionRate DECIMAL(5,2) DEFAULT 0,
      category VARCHAR(100) DEFAULT '',
      tags JSON DEFAULT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'draft',
      managerId VARCHAR(100) DEFAULT '',
      stock INT NOT NULL DEFAULT 0,
      options JSON DEFAULT NULL,
      publishedBy VARCHAR(200) DEFAULT '',
      publishedAt DATETIME DEFAULT NULL,
      offlineReason TEXT DEFAULT NULL,
      offlineAt DATETIME DEFAULT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // 推广经理表
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS managers (
      id VARCHAR(100) PRIMARY KEY,
      username VARCHAR(200) NOT NULL,
      password VARCHAR(500) NOT NULL DEFAULT '',
      name VARCHAR(200) DEFAULT '',
      phone VARCHAR(50) DEFAULT '',
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // 用户表
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(100) PRIMARY KEY,
      phone VARCHAR(50) DEFAULT '',
      password VARCHAR(500) NOT NULL DEFAULT '',
      nickname VARCHAR(200) DEFAULT '',
      role VARCHAR(50) NOT NULL DEFAULT 'user',
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      alipayUserId VARCHAR(200) DEFAULT '',
      wechatOpenId VARCHAR(200) DEFAULT '',
      loginMethods JSON DEFAULT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

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
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      reviewedAt DATETIME DEFAULT NULL,
      rejectReason TEXT DEFAULT NULL,
      addedToPaymentAt DATETIME DEFAULT NULL,
      settledAt DATETIME DEFAULT NULL,
      transferredFromManager VARCHAR(200) DEFAULT '',
      transferredAt DATETIME DEFAULT NULL,
      managedBy VARCHAR(50) DEFAULT 'manager',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

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

  console.log('[DB] MySQL tables initialized successfully')
}

export default pool
