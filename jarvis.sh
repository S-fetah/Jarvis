#!/usr/bin/env bash

# ==============================================================================
# Jarvis AI Assistant - Direct Launch & Auto-Restart Script
# 
# Usage:
#   ./jarvis.sh
#
# Logic:
#   1. Checks if Jarvis or its dev server (port 5173 / electron) is already running.
#   2. If running, cleanly terminates the old process tree to restart.
#   3. Launches `npm run dev` in the project directory.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="C:/work/softwares/jarvis"

if [ -d "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/package.json" ]; then
  PROJECT_DIR="$SCRIPT_DIR"
else
  PROJECT_DIR="$TARGET_DIR"
fi

cd "$PROJECT_DIR" || exit 1
PID_FILE="$PROJECT_DIR/.jarvis.pid"

echo "=================================================="
echo "          JARVIS AI LAUNCHER & WATCHDOG           "
echo "=================================================="

RESTART=0

# 1. Terminate running instance from PID file if alive
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE" 2>/dev/null | tr -d '\r\n')
  if [ -n "$OLD_PID" ]; then
    powershell.exe -NoProfile -Command "
      if (Get-Process -Id $OLD_PID -ErrorAction SilentlyContinue) {
        Write-Output 'FOUND'
        Stop-Process -Id $OLD_PID -Force -ErrorAction SilentlyContinue
      }
    " 2>/dev/null | grep -q "FOUND" && {
      echo "[Jarvis] Terminated previous instance (PID: $OLD_PID)."
      RESTART=1
    }
  fi
  rm -f "$PID_FILE"
fi

# 2. Check and terminate any process occupying port 5173 or orphan electron
powershell.exe -NoProfile -Command "
  `$killed = `$false
  Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id `$_.OwningProcess -Force -ErrorAction SilentlyContinue
    `$killed = `$true
  }
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    (`$_.CommandLine -like '*electron-vite*dev*' -or (`$_.Name -eq 'electron.exe' -and `$_.CommandLine -like '*softwares\jarvis*')) -and `$_.ProcessId -ne `$PID
  } | ForEach-Object {
    Stop-Process -Id `$_.ProcessId -Force -ErrorAction SilentlyContinue
    `$killed = `$true
  }
  if (`$killed) { Write-Output 'RESTARTED' }
" 2>/dev/null | grep -q "RESTARTED" && {
  RESTART=1
}

if [ "$RESTART" -eq 1 ]; then
  echo "[Jarvis] Active instance detected and terminated. Restarting now..."
  sleep 1
else
  echo "[Jarvis] Starting fresh instance..."
fi

echo ""
echo "[Jarvis] Executing: npm run dev"
echo ""

# Record bash subshell PID
echo "$$" > "$PID_FILE"

# Execute dev server
npm run dev

# Cleanup on exit
rm -f "$PID_FILE"
