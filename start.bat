@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   爱因斯坦棋 - 联机对战服务器
echo ========================================
echo.

:: 检查 Node.js 是否安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装！
    echo.
    echo 下载地址:
    echo   https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi
    echo.
    echo 安装后重新运行此脚本即可。
    echo.
    pause
    exit /b 1
)

echo [1/2] 检查依赖...
if not exist "node_modules" (
    echo 依赖未安装，正在安装...
    call npm install
) else (
    echo 依赖已就绪。
)

echo.
echo [2/2] 启动服务器...
echo.
echo 服务器地址: http://localhost:3000
echo 按 Ctrl+C 停止服务
echo ========================================
echo.

start http://localhost:3000
node server.js

pause
