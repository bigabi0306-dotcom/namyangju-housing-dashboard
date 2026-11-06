@echo off
rem CENTA REALTY OS - update to the latest version. Close the program (black window) first.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update.ps1"
echo.
pause
