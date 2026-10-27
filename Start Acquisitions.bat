@echo off
cd /d "%~dp0"
where node >nul 2>nul && (node serve.js & goto :end)
echo Starting PowerShell server...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
:end
echo.
echo Server stopped. If the browser showed "can't be reached", send me the text above.
pause
