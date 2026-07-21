@echo off
chcp 65001 >nul
title 高洲罗氏族谱 - Web后台一键启动
cd /d "%~dp0"

echo ========================================
echo   高洲罗氏族谱 Web 后台一键启动
echo ========================================
echo.
echo   代理: http://127.0.0.1:3000
echo   后台: http://127.0.0.1:8080
echo ========================================
echo.

where npm >nul 2>&1
if errorlevel 1 (
  echo [错误] 未找到 npm，请先安装 Node.js
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [准备] 安装后台依赖...
  call npm install
  if errorlevel 1 (
    echo [错误] 后台依赖安装失败
    pause
    exit /b 1
  )
)

if not exist "proxy-server\node_modules\" (
  echo [准备] 安装代理依赖...
  pushd proxy-server
  call npm install
  if errorlevel 1 (
    popd
    echo [错误] 代理依赖安装失败
    pause
    exit /b 1
  )
  popd
)

if not exist "proxy-server\.env" (
  echo [提示] 未找到 proxy-server\.env
  if exist "proxy-server\.env.example" (
    copy /Y "proxy-server\.env.example" "proxy-server\.env" >nul
    echo [提示] 已从 .env.example 复制，请填写云开发密钥后再用运营功能
  ) else (
    echo [警告] 缺少 .env，登录账号等云功能可能不可用
  )
  echo.
)

echo [1/2] 启动云函数代理 ^(端口 3000^)...
start "罗氏后台-云代理:3000" cmd /k "cd /d "%~dp0proxy-server" && npm start"

timeout /t 2 /nobreak >nul

echo [2/2] 启动 Vite 后台 ^(端口 8080，将自动打开浏览器^)...
echo.
echo 关闭本窗口不会停代理；请一并关闭标题为「罗氏后台-云代理」的窗口。
echo.
call npm run dev

pause
