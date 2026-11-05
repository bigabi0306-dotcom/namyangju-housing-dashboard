@echo off
rem CENTA REALTY OS - start for other devices on the same network (phone, other PC).
rem Requires COOKIE_SECURE="false" in .env (see docs\INSTALL_WINDOWS.md section 6). Use only on a trusted network.
cd /d "%~dp0.."
if not exist ".next\BUILD_ID" (
  echo First run: building the app. This takes a few minutes...
  call npm run build
)
echo.
echo Starting for LAN access on port 3000. Find this PC's IPv4 address with: ipconfig
echo Keep this window open while using the system. Close it to stop.
echo.
call npx next start -p 3000 -H 0.0.0.0
pause
