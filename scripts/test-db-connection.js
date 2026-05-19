#!/usr/bin/env node

/**
 * 数据库连接测试脚本
 * 
 * 使用方法：
 * 1. 确保 apps/api/.env 文件存在并配置了数据库信息
 * 2. 运行: node scripts/test-db-connection.js
 */

const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectTimeout: 10000,
};

async function testConnection() {
  console.log('🔌 测试阿里云 RDS 数据库连接...\n');
  console.log(`📊 连接信息:`);
  console.log(`   Host: ${config.host}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   User: ${config.user}`);
  console.log(`   Database: ${config.database}`);
  console.log(`   Password: ${config.password ? '******' : '❌ 未设置'}\n`);

  // 验证必需的配置
  if (!config.host) {
    console.error('❌ 错误: DB_HOST 未设置');
    console.error('\n请确保 apps/api/.env 文件存在并配置了正确的数据库信息');
    return;
  }
  
  if (!config.user) {
    console.error('❌ 错误: DB_USER 未设置');
    console.error('\n请确保 apps/api/.env 文件存在并配置了正确的数据库信息');
    return;
  }

  if (!config.password) {
    console.error('❌ 错误: 数据库密码未设置');
    console.error('\n请编辑 apps/api/.env 文件，设置正确的数据库密码:');
    console.error('   DB_PASSWORD=您的实际数据库密码\n');
    return;
  }

  let connection;
  try {
    console.log('🔗 正在连接数据库...');
    connection = await mysql.createConnection(config);
    console.log('✅ 数据库连接成功！\n');

    console.log('📋 检查 employees 表...');
    const [tables] = await connection.execute("SHOW TABLES LIKE 'employees'");

    if (tables.length === 0) {
      console.log('⚠️ employees 表不存在，正在创建...\n');

      await connection.execute(`
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
      `);
      console.log('✅ employees 表创建成功！\n');
    } else {
      console.log('✅ employees 表已存在\n');
    }

    const [countResult] = await connection.execute('SELECT COUNT(*) as count FROM employees');
    console.log(`📊 employees 表中共有 ${countResult[0].count} 条记录\n`);

    console.log('🎉 数据库连接和 employees 表检查完成！');

  } catch (error) {
    console.error('\n❌ 连接失败:', error.message);
    console.error('\n可能的原因：');
    console.error('   1. 数据库密码不正确');
    console.error('   2. 数据库服务器不可访问');
    console.error('   3. 网络问题或防火墙阻止');
    console.error('   4. 数据库用户权限不足');
    console.error('\n请检查 apps/api/.env 文件中的数据库配置是否正确。\n');
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testConnection();
