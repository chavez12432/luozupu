/**
 * 通过 adminApi 批量更新族人详细信息
 * 
 * 使用方法：
 * 1. 先确保 adminApi 云函数已部署
 * 2. 获取 adminApi 的 HTTP 访问地址
 * 3. 运行此脚本
 */

const https = require('https');
const fs = require('fs');

// 族人详细信息数据
const memberDetails = require('./member_details_data.json');

// 配置 - 请修改为你的 adminApi 地址
const API_BASE_URL = 'https://your-api-id.tcloudbaseapp.com/adminApi'; // 修改这里！

async function callAdminApi(action, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE_URL);
    
    const postData = JSON.stringify({
      action,
      ...data
    });
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('解析响应失败: ' + data));
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('开始批量更新族人详细信息...');
  console.log(`共 ${Object.keys(memberDetails).length} 位族人`);
  
  try {
    const result = await callAdminApi('batchUpdateDetails', { memberDetails });
    console.log('\n=== 更新结果 ===');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ 更新成功！');
    } else {
      console.log('\n❌ 更新失败:', result.message);
    }
  } catch (err) {
    console.error('调用 API 失败:', err.message);
    console.log('\n请确保：');
    console.log('1. adminApi 云函数已部署');
    console.log('2. HTTP 访问已开启');
    console.log('3. API_BASE_URL 配置正确');
  }
}

main();
