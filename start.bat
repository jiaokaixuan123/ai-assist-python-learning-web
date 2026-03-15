@echo off
echo ================================
echo Python 教学网站 - 一键启动
echo ================================
echo.

echo [1/3] 检查 MongoDB...
tasklist /FI "IMAGENAME eq mongod.exe" 2>NUL | find /I /N "mongod.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo MongoDB 已运行
) else (
    echo 启动 MongoDB...
    start mongod
    timeout /t 3 >nul
)

echo.
echo [2/3] 启动后端 (FastAPI)...
cd backend
start cmd /k ".venv\Scripts\activate && uvicorn main:app --reload"
cd ..

echo.
echo [3/3] 启动前端 (React)...
timeout /t 2 >nul
start cmd /k "npm run dev"

echo.
echo ================================
echo 启动完成！
echo 前端: http://localhost:5173
echo 后端: http://localhost:8000
echo API文档: http://localhost:8000/docs
echo ================================
pause
