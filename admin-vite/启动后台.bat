@echo off
chcp 65001 >nul
title 高洲罗氏族谱 - Web后台

echo ========================================
echo   高洲罗氏族谱 Web后台管理系统
echo ========================================
echo.

cd /d "%~dp0"

echo [1/1] 正在启动开发服务器...
echo.
npm run dev

pause
