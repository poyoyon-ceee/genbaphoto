@echo off

SET PYTHON_DIR=%~dp0python-portable


cd /d "%~dp0"


start "" "%PYTHON_DIR%\python.exe" -m http.server 8000


timeout /t 3 >nul
start chrome "http://localhost:8000/genba_photo_v1.0.html"

timeout /t 5 >nul
taskkill /f /im python.exe >nul 2>&1
exit