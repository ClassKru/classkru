@echo off
setlocal
cd /d "%~dp0"
node scripts\open-classkru.cjs
if errorlevel 1 (
  echo.
  echo Could not start ClassKru. Check that Node.js is installed and local ports 3511 and 3513 are available.
  pause
)
