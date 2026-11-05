@echo off
rem CENTA REALTY OS - database and photo backup into the "backups" folder.
cd /d "%~dp0.."
node scripts\dbtool.mjs backup
echo.
echo Copy the "backups" folder to an external drive or cloud storage as well.
pause
