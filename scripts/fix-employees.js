// ============================================================
// 修复 employees 表的数据库脚本
// 使用方法：
//   node scripts/fix-employees.js --password=your_password
// ============================================================

require('dotenv').config({ path: './apps/api/.env' });
const mysql = require('mysql2/promise');

// 从命令行参数或环境变量获取密码
let dbPassword = process.env.DB_PASSWORD || '';

// 解析命令行参数
process.argv.forEach((arg) => {
  if (arg.startsWith('--password=')) {
    dbPassword = arg.split('=')[1];
  }
});

const config = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: dbPassword,
  database: process.env.DB_NAME,
  connectTimeout: 10000,
};

async function fixEmployeesTable() {
  let connection;
  
  try {
    // 检查密码是否设置
    if (!dbPassword || dbPassword === 'your_database_password_here') {
      console.error('❌ 请提供正确的数据库密码！');
      console.error('使用方法:');
      console.error('  node scripts/fix-employees.js --password=your_password');
      process.exit(1);
    }

    console.log('🔧 开始修复 employees 表...');
    console.log(`📊 连接信息: ${config.user}@${config.host}:${config.port}/${config.database}`);
    console.log('');

    // 连接数据库
    console.log('🔌 正在连接数据库...');
    connection = await mysql.createConnection(config);
    console.log('✅ 数据库连接成功');

    // 检查 employees 表是否存在
    console.log('');
    console.log('🔍 检查 employees 表...');
    const [tables] = await connection.execute("SHOW TABLES LIKE 'employees'");
    if (tables.length === 0) {
      console.log('⚠️ employees 表不存在，正在创建...');
      
      // 创建 employees 表
      await connection.execute(`
        CREATE TABLE employees (
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
      console.log('✅ employees 表创建成功');
    } else {
      console.log('✅ employees 表已存在');
      
      // 检查表结构是否完整
      console.log('');
      console.log('🔍 检查 employees 表结构...');
      const [columns] = await connection.execute('DESCRIBE employees');
      const columnNames = columns.map(col => col.Field);
      console.log('  现有字段:', columnNames);
      
      const requiredFields = ['id', 'userId', 'phone', 'password', 'nickname', 'expiresAt', 'status', 'createdAt', 'updatedAt'];
      const missingFields = requiredFields.filter(f => !columnNames.includes(f));
      
      if (missingFields.length > 0) {
        console.log('  ⚠️ 缺少字段:', missingFields);
        console.log('  正在修复...');
        
        // 尝试添加缺失的字段
        for (const field of missingFields) {
          try {
            let alterSQL = '';
            switch (field) {
              case 'id':
                alterSQL = 'ALTER TABLE employees ADD COLUMN id VARCHAR(100) PRIMARY KEY FIRST';
                break;
              case 'userId':
                alterSQL = 'ALTER TABLE employees ADD COLUMN userId VARCHAR(100) NOT NULL AFTER id';
                break;
              case 'phone':
                alterSQL = 'ALTER TABLE employees ADD COLUMN phone VARCHAR(50) NOT NULL AFTER userId';
                break;
              case 'password':
                alterSQL = 'ALTER TABLE employees ADD COLUMN password VARCHAR(500) NOT NULL AFTER phone';
                break;
              case 'nickname':
                alterSQL = 'ALTER TABLE employees ADD COLUMN nickname VARCHAR(200) DEFAULT "" AFTER password';
                break;
              case 'expiresAt':
                alterSQL = 'ALTER TABLE employees ADD COLUMN expiresAt DATETIME NOT NULL AFTER nickname';
                break;
              case 'status':
                alterSQL = 'ALTER TABLE employees ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT "active" AFTER expiresAt';
                break;
              case 'createdAt':
                alterSQL = 'ALTER TABLE employees ADD COLUMN createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER status';
                break;
              case 'updatedAt':
                alterSQL = 'ALTER TABLE employees ADD COLUMN updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER createdAt';
                break;
            }
            if (alterSQL) {
              await connection.execute(alterSQL);
              console.log(`    ✅ 添加字段 ${field} 成功`);
            }
          } catch (e) {
            console.log(`    ⚠️ 添加字段 ${field} 失败，可能已存在:`, e.message);
          }
        }
      } else {
        console.log('  ✅ 所有必需字段都存在');
      }
      
      // 检查索引是否存在
      console.log('');
      console.log('🔍 检查 employees 表索引...');
      const [indexes] = await connection.execute('SHOW INDEX FROM employees');
      const indexNames = indexes.map(idx => idx.Key_name);
      console.log('  现有索引:', indexNames);
      
      const requiredIndexes = ['idx_userId', 'idx_phone', 'idx_expiresAt'];
      const missingIndexes = requiredIndexes.filter(idx => !indexNames.includes(idx));
      
      if (missingIndexes.length > 0) {
        console.log('  ⚠️ 缺少索引:', missingIndexes);
        console.log('  正在修复...');
        
        for (const idx of missingIndexes) {
          try {
            let alterSQL = '';
            switch (idx) {
              case 'idx_userId':
                alterSQL = 'ALTER TABLE employees ADD INDEX idx_userId (userId)';
                break;
              case 'idx_phone':
                alterSQL = 'ALTER TABLE employees ADD INDEX idx_phone (phone)';
                break;
              case 'idx_expiresAt':
                alterSQL = 'ALTER TABLE employees ADD INDEX idx_expiresAt (expiresAt)';
                break;
            }
            if (alterSQL) {
              await connection.execute(alterSQL);
              console.log(`    ✅ 添加索引 ${idx} 成功`);
            }
          } catch (e) {
            console.log(`    ⚠️ 添加索引 ${idx} 失败，可能已存在:`, e.message);
          }
        }
      } else {
        console.log('  ✅ 所有必需索引都存在');
      }
    }
    
    // 显示表中有多少条记录
    console.log('');
    console.log('📊 检查 employees 表数据...');
    const [countResult] = await connection.execute('SELECT COUNT(*) as count FROM employees');
    console.log(`  当前共有 ${countResult[0].count} 条员工记录`);

    console.log('');
    console.log('🎉 employees 表修复完成！');
    console.log('');
    console.log('现在可以测试员工子账户列表功能了！');

  } catch (error) {
    console.error('');
    console.error('❌ 修复失败:', error.message);
    console.error('');
    console.error('可能的原因：');
    console.error('  1. 数据库密码不正确');
    console.error('  2. 数据库服务器不可访问');
    console.error('  3. 网络问题');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('');
      console.log('🔌 数据库连接已关闭');
    }
  }
}

fixEmployeesTable();
