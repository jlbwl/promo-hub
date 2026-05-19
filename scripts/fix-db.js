// ============================================================
// 数据库修复脚本
// 使用方法：
//   方式1: node scripts/fix-db.js
//   方式2: node scripts/fix-db.js --password=your_password
//   方式3: DB_PASSWORD=your_password node scripts/fix-db.js
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

async function fixDatabase() {
  let connection;
  
  try {
    // 检查密码是否设置
    if (!dbPassword) {
      console.error('❌ 请提供数据库密码！');
      console.error('使用方法:');
      console.error('  node scripts/fix-db.js --password=your_password');
      console.error('  或');
      console.error('  DB_PASSWORD=your_password node scripts/fix-db.js');
      process.exit(1);
    }

    console.log('🔧 开始修复数据库...');
    console.log(`📊 连接信息: ${config.user}@${config.host}:${config.port}/${config.database}`);
    console.log('');

    // 连接数据库
    console.log('🔌 正在连接数据库...');
    connection = await mysql.createConnection(config);
    console.log('✅ 数据库连接成功');

    // 修复 orders 表
    console.log('');
    console.log('📝 修复 orders 表...');

    console.log('  → 添加 teamName 字段');
    await connection.execute(
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS teamName VARCHAR(200) DEFAULT \'\' AFTER userPhone'
    );
    console.log('  ✅ teamName 字段已添加或已存在');

    console.log('  → 添加 userName 字段');
    await connection.execute(
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS userName VARCHAR(200) DEFAULT \'\' AFTER redirectUrl'
    );
    console.log('  ✅ userName 字段已添加或已存在');

    console.log('  → 添加 userPhone 字段');
    await connection.execute(
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS userPhone VARCHAR(50) DEFAULT \'\' AFTER userName'
    );
    console.log('  ✅ userPhone 字段已添加或已存在');

    // 修复 products 表
    console.log('');
    console.log('📝 修复 products 表...');

    console.log('  → 添加 requireName 字段');
    await connection.execute(
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS requireName TINYINT(1) NOT NULL DEFAULT 0 AFTER offlineAt'
    );
    console.log('  ✅ requireName 字段已添加或已存在');

    console.log('  → 添加 requirePhone 字段');
    await connection.execute(
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS requirePhone TINYINT(1) NOT NULL DEFAULT 0 AFTER requireName'
    );
    console.log('  ✅ requirePhone 字段已添加或已存在');

    // 验证修复结果
    console.log('');
    console.log('🔍 验证修复结果...');
    const [rows] = await connection.execute('DESCRIBE orders');
    const fields = rows.map((row) => row.Field);
    console.log('orders 表字段:', fields.filter(f => ['teamName', 'userName', 'userPhone'].includes(f)));

    // 清理数据库中的反引号数据
    console.log('');
    console.log('🧹 清理产品选项中的反引号...');
    const [result] = await connection.execute(
      "UPDATE products SET options = REPLACE(options, '`', '') WHERE options LIKE '%`%'"
    );
    console.log(`✅ 清理完成，影响 ${result.affectedRows} 行`);

    console.log('');
    console.log('🎉 数据库修复完成！');
    console.log('');
    console.log('现在可以测试做单功能了！');

  } catch (error) {
    console.error('');
    console.error('❌ 数据库修复失败:', error.message);
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

fixDatabase();