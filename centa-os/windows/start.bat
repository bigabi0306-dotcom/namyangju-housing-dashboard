@echo off
rem CENTA REALTY OS - start (this PC only). Close this window to stop.
cd /d "%~dp0.."
if not exist ".next\BUILD_ID" (
  echo First run: building the app. This takes a few minutes...
  call npm run build
)
echo.
echo CENTA REALTY OS is starting at http://localhost:3000
echo Keep this window open while using the system. Close it to stop.
echo.
start "" /b cmd /c "timeout /t 10 /nobreak >nul && start http://localhost:3000"
call npx next start -p 3000 -H 127.0.0.1
pause
