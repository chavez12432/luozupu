/**
 * 打包云函数脚本
 * 运行: node pack.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sourceDir = path.join(__dirname, 'adminApi');
const zipPath = path.join(__dirname, 'adminApi.zip');

console.log('打包云函数目录...');
console.log('源目录:', sourceDir);

// 检查目录
if (!fs.existsSync(sourceDir)) {
    console.error('错误: adminApi 目录不存在');
    process.exit(1);
}

// 使用 PowerShell 的 Compress-Archive（从源目录内部打包）
const psScript = `
$ErrorActionPreference = 'Stop'
Set-Location '${sourceDir}'
Compress-Archive -Path './*' -DestinationPath '${zipPath}' -Force
Write-Output 'DONE'
`;

try {
    const result = execSync(`powershell -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024
    });
    
    if (fs.existsSync(zipPath)) {
        const stats = fs.statSync(zipPath);
        console.log('打包成功!');
        console.log('ZIP 文件:', zipPath);
        console.log('大小:', stats.size, 'bytes');
    }
} catch (err) {
    console.error('打包失败:', err.message);
}
