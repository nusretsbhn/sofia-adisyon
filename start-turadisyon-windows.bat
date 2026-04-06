@echo off
chcp 65001 >nul
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

REM Önce API (üretim: watch yok), 2–3 sn sonra POS geliştirici modu
start "TurAdisyon Backend" /D "%ROOT%" cmd /k "npm run start --workspace backend"
timeout /t 3 /nobreak >nul
start "TurAdisyon POS" /D "%ROOT%" cmd /k "npm run pos"
