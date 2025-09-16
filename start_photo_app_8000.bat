@echo off

SET PYTHON_DIR=%~dp0python-portable

cd /d "%~dp0"

start cmd /k "%PYTHON_DIR%\python.exe" -m http.server 8000

timeout /t 3 >nul
start chrome http://localhost:8000/genba_photo_1.36.html
exit