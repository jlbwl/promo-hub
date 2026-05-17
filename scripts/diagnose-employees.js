
#!/usr/bin/env node
/**
 * 员工子账户功能诊断工具
 * 用于快速检查和验证员工子账户功能的前后端连接
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  // 根据您的实际部署情况修改这些配置
  BASE_URL: 'https://your-domain.com', // 或者 'http://your-server-ip'
  API_BASE: '/api',
  TEST_USER_ID: 'test-user-id', // 替换为一个实际的用户ID用于测试
  TIMEOUT: 10000
};

// 日志函数
const log = (msg, type = 'info') => {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    warning: '\x1b[33m',
    error: '\x1b[31m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[type]}[${type.toUpperCase()}]${colors.reset} ${msg}`);
};

// 发送HTTP请求
const makeRequest = (method, url, data = null) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: CONFIG.TIMEOUT
    };

    const req = protocol.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({ status: res.statusCode, data: jsonBody });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
};

// 诊断流程
const runDiagnostics = async () => {
  console.log('========================================');
  console.log('    员工子账户功能诊断工具');
  console.log('========================================\n');

  // 1. 检查项目文件
  log('步骤 1/5: 检查项目文件结构...', 'info');
  
  const projectFiles = [
    'apps/user/src/views/ProfileView.vue',
    'apps/api/src/index.ts',
    'apps/api/src/data.ts',
    'packages/shared/src/utils/request.ts'
  ];

  let allFilesExist = true;
  for (const file of projectFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      log(`  ✓ ${file} 存在`, 'success');
    } else {
      log(`  ✗ ${file} 不存在`, 'error');
      allFilesExist = false;
    }
  }
  
  if (!allFilesExist) {
    log('项目文件不完整，请检查！', 'error');
    return;
  }
  log('项目文件检查完成\n', 'success');

  // 2. 检查API服务是否在线
  log('步骤 2/5: 检查API服务是否在线...', 'info');
  
  try {
    const result = await makeRequest('GET', `${CONFIG.BASE_URL}${CONFIG.API_BASE}/health`);
    log(`API服务响应: ${result.status}`, 'success');
  } catch (e) {
    log(`API服务可能不在线: ${e.message}`, 'warning');
    log('尝试不使用 /health 端点进行测试...', 'info');
  }
  
  // 3. 测试员工列表API
  log('\n步骤 3/5: 测试获取员工列表API...', 'info');
  
  try {
    const testUrl = `${CONFIG.BASE_URL}${CONFIG.API_BASE}/employees?userId=${CONFIG.TEST_USER_ID}`;
    log(`请求: GET ${testUrl}`, 'info');
    
    const result = await makeRequest('GET', testUrl);
    log(`响应状态: ${result.status}`, result.status === 200 ? 'success' : 'warning');
    
    if (typeof result.data === 'object' && result.data !== null) {
      log(`响应数据:`, 'info');
      console.log(JSON.stringify(result.data, null, 2));
      
      if (result.data.code === 0) {
        log('API调用成功！', 'success');
      } else {
        log(`API返回错误: ${result.data.message}`, 'warning');
      }
    } else {
      log('响应不是JSON格式', 'warning');
      console.log(result.data);
    }
  } catch (e) {
    log(`API请求失败: ${e.message}`, 'error');
  }

  // 4. 检查前端代码中的API调用
  log('\n步骤 4/5: 检查前端代码中的API调用...', 'info');
  
  const profileViewPath = path.join(__dirname, '..', 'apps/user/src/views/ProfileView.vue');
  const profileViewContent = fs.readFileSync(profileViewPath, 'utf8');
  
  const hasEmployeeAPI = profileViewContent.includes('/employees');
  const hasGetEmployees = profileViewContent.includes('get(\'/employees\'');
  
  if (hasEmployeeAPI && hasGetEmployees) {
    log('  ✓ 前端代码包含员工列表API调用', 'success');
    
    // 查找具体的调用位置
    const lines = profileViewContent.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('/employees')) {
        log(`    行 ${idx + 1}: ${line.trim()}`, 'info');
      }
    });
  } else {
    log('  ✗ 前端代码中可能缺少员工列表API调用', 'warning');
  }

  // 5. 检查后端API路由
  log('\n步骤 5/5: 检查后端API路由...', 'info');
  
  const apiIndexPath = path.join(__dirname, '..', 'apps/api/src/index.ts');
  const apiIndexContent = fs.readFileSync(apiIndexPath, 'utf8');
  
  const hasGetEmployeesRoute = apiIndexContent.includes("app.get('/api/employees'");
  const hasPostEmployeesRoute = apiIndexContent.includes("app.post('/api/employees'");
  
  if (hasGetEmployeesRoute) {
    log('  ✓ 后端包含 GET /api/employees 路由', 'success');
  } else {
    log('  ✗ 后端缺少 GET /api/employees 路由', 'error');
  }
  
  if (hasPostEmployeesRoute) {
    log('  ✓ 后端包含 POST /api/employees 路由', 'success');
  } else {
    log('  ✗ 后端缺少 POST /api/employees 路由', 'error');
  }

  // 总结
  console.log('\n========================================');
  log('诊断完成！', 'success');
  console.log('========================================');
  console.log('\n建议:');
  console.log('1. 确保已成功部署最新代码');
  console.log('2. 检查数据库中employees表是否存在');
  console.log('3. 打开浏览器开发者工具的Network标签，查看实际API请求');
  console.log('4. 检查前端是否正确传递了userId参数');
};

// 主函数
const main = async () => {
  // 允许从命令行参数覆盖配置
  if (process.argv[2]) {
    CONFIG.BASE_URL = process.argv[2];
  }
  if (process.argv[3]) {
    CONFIG.TEST_USER_ID = process.argv[3];
  }
  
  await runDiagnostics();
};

main().catch(console.error);

