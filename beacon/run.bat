@echo off
cd /d "%~dp0"

for /f "usebackq tokens=1,2 delims==" %%A in (".env") do (
  set "%%A=%%B"
)

:loop
node control.js
echo 프로세스가 종료됨, 5초 후 재시작...
timeout /t 5 /nobreak >nul
goto loop
