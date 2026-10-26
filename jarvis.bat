@echo off
setlocal enabledelayedexpansion
title Jarvis AI Assistant

cd /d "C:\work\softwares\jarvis"
set "PROJECT_DIR=C:\work\softwares\jarvis"
set "PID_FILE=%PROJECT_DIR%\.jarvis.pid"

echo ==================================================
echo           JARVIS AI LAUNCHER & RESTART
echo ==================================================

set "RESTART=0"

:: 1. Check PID file and terminate if alive
if exist "%PID_FILE%" (
    set /p OLD_PID=<"%PID_FILE%"
    if defined OLD_PID (
        powershell -NoProfile -Command "if (Get-Process -Id !OLD_PID! -ErrorAction SilentlyContinue) { Stop-Process -Id !OLD_PID! -Force -ErrorAction SilentlyContinue; exit 0 } else { exit 1 }" >nul 2>&1
        if not errorlevel 1 (
            echo [Jarvis Launcher] Active process !OLD_PID! terminated.
            set "RESTART=1"
        )
    )
    del /f /q "%PID_FILE%" >nul 2>&1
)

:: 2. Terminate any process occupying port 5173 or stray jarvis electron
powershell -NoProfile -Command "$killed = $false; Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; $killed = $true }; Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { ($_.CommandLine -like '*electron-vite*dev*' -or ($_.Name -eq 'electron.exe' -and $_.CommandLine -like '*softwares\jarvis*')) -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $killed = $true }; if ($killed) { exit 0 } else { exit 1 }" >nul 2>&1
if not errorlevel 1 (
    set "RESTART=1"
)

if "!RESTART!"=="1" (
    echo [Jarvis Launcher] Existing instance detected. Server restarted!
    timeout /t 1 /nobreak >nul
) else (
    echo [Jarvis Launcher] Launching Jarvis for the first time...
)

echo.
echo [Jarvis Launcher] Starting dev server (npm run dev)...
echo.

:: Save PID of current process
for /f "tokens=2 delims==" %%p in ('wmic process where "name='cmd.exe' and commandline like '%%jarvis.bat%%'" get processid /value 2^>nul ^| findstr "="') do (
    echo %%p > "%PID_FILE%"
)

npm run dev

if exist "%PID_FILE%" del /f /q "%PID_FILE%" >nul 2>&1
pause
