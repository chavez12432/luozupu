# 打包 adminApi 云函数脚本
$sourceDir = "d:\DNS\luozupu\project\cloudfunctions\adminApi"
$zipPath = "d:\DNS\luozupu\project\cloudfunctions\adminApi.zip"

Write-Host "正在打包 adminApi 云函数..."

# 删除旧文件
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

# 切换到源目录再打包，确保不包含外层目录
Push-Location $sourceDir
Compress-Archive -Path "./*" -DestinationPath $zipPath -Force
Pop-Location

# 验证
if (Test-Path $zipPath) {
    $size = (Get-Item $zipPath).Length
    Write-Host "打包完成: $zipPath (大小: $size bytes)"
    
    # 显示 zip 内容
    Write-Host ""
    Write-Host "ZIP 内容:"
    Get-Item $zipPath | Expand-Archive -DestinationPath "$env:TEMP\testzip" -Force
    Get-ChildItem "$env:TEMP\testzip" | ForEach-Object { Write-Host "  - $($_.Name)" }
    Remove-Item "$env:TEMP\testzip" -Recurse -Force -ErrorAction SilentlyContinue
}
