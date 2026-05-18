const http = require('http');

function testEmployeesAPI() {
  console.log('=== 测试员工列表 API ===');
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/employees?userId=test123',
    method: 'GET',
    timeout: 10000
  };
  
  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('✓ API 请求成功');
      console.log('响应状态:', res.statusCode);
      try {
        const jsonData = JSON.parse(data);
        console.log('响应数据:', JSON.stringify(jsonData, null, 2));
      } catch (e) {
        console.log('响应内容:', data);
      }
      console.log('=== 测试结束 ===');
    });
  });
  
  req.on('error', (e) => {
    console.error('✗ API 请求失败:', e.message);
    if (e.code === 'ECONNREFUSED') {
      console.error('❌ 无法连接到后端服务器，请检查服务器是否启动');
    } else if (e.code === 'ECONNRESET') {
      console.error('❌ 连接被重置');
    } else if (e.code === 'ETIMEDOUT') {
      console.error('❌ 请求超时');
    }
    console.log('=== 测试结束 ===');
  });
  
  req.setTimeout(10000, () => {
    console.error('❌ 请求超时');
    req.destroy();
    console.log('=== 测试结束 ===');
  });
  
  req.end();
}

testEmployeesAPI();
