@echo off
REM ===== One-click launcher for IGL Portal (HRMS) =====
REM Double-click this file to start the app and open it in your browser.
cd /d "%~dp0"

echo Starting IGL Portal...
echo.

REM Start the backend API (port 4000) in its own window
start "IGL Portal - Server" cmd /k "cd /d "%~dp0server" && npm start"

REM Start the frontend (port 5173) in its own window
start "IGL Portal - Client" cmd /k "cd /d "%~dp0client" && npm run dev"

REM Give the servers a few seconds to boot, then open the browser
echo Waiting for the app to start...
timeout /t 7 /nobreak >nul
start "" http://localhost:5173

echo.
echo IGL Portal is starting in two windows. Keep them open while you use the app.
echo Close those two windows to stop the app.
echo You can close THIS window now.
timeout /t 4 /nobreak >nul
