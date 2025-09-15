@echo off
SET PYTHON_DIR=%~dp0python-portable
cd /d "%~dp0"

REM Pythonサーバーの起動
start "" "%PYTHON_DIR%\python.exe" -m http.server 8000

REM ブラウザの優先順位付き起動
timeout /t 3 >nul
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start chrome "http://localhost:8000/genba.html"
) else if exist "C:\Program Files\Microsoft\Edge\Application\msedge.exe" (
    start msedge "http://localhost:8000/genba.html"
) else if exist "C:\Program Files\Mozilla Firefox\firefox.exe" (
    start firefox "http://localhost:8000/genba.html"
) else (
    start "http://localhost:8000/genba.html"
)

timeout /t 5 >nul
taskkill /f /im python.exe >nul 2>&1
exit