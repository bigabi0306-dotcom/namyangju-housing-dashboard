# CENTA REALTY OS - update this PC's copy to the latest version on GitHub.
# Keeps: .env, uploads, backups, node_modules. Makes a database backup first and stops if the backup fails.
# Stop the program (close the black window) before running. NOT TESTED ON WINDOWS yet.
param([string]$AppDir)   # first update only: path of the centa-os folder
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
if ($AppDir) { $app = $AppDir } else { $app = Split-Path -Parent $PSScriptRoot }
$zipUrl = 'https://github.com/bigabi0306-dotcom/namyangju-housing-dashboard/archive/refs/heads/claude/admiring-feynman-g4r5oz.zip'
Set-Location $app

Write-Host '1/5 Backing up the database first...'
node scripts\dbtool.mjs backup
if ($LASTEXITCODE -ne 0) { throw 'Backup failed. Update stopped. Nothing was changed.' }

Write-Host '2/5 Downloading the latest version...'
$tmp = Join-Path $env:TEMP 'centa-update'
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory $tmp | Out-Null
Invoke-WebRequest $zipUrl -OutFile (Join-Path $tmp 'u.zip')
Expand-Archive (Join-Path $tmp 'u.zip') -DestinationPath $tmp -Force
$new = Join-Path (Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName 'centa-os'
if (-not (Test-Path (Join-Path $new 'package.json'))) { throw 'Downloaded files look wrong. Update stopped.' }

Write-Host '3/5 Copying new files (your settings, photos and backups are kept)...'
robocopy $new $app /E /XD node_modules .next uploads backups /XF .env | Out-Null   # exit codes 1-7 mean success

Write-Host '4/5 Installing parts and updating the database tables...'
npm.cmd install
npx.cmd prisma db push

Write-Host '5/5 Building the program (a few minutes)...'
npm.cmd run build
Write-Host ''
Write-Host 'Update finished. Start the program with windows\start.bat'
