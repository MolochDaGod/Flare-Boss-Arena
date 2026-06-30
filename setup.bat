@echo off
setlocal
cd /d "%~dp0"

echo === Flare-Boss-Arena setup ===
echo Repo: %CD%
echo.

echo [1/2] pnpm install...
call pnpm install
set INSTALL_ERR=%ERRORLEVEL%
if not "%INSTALL_ERR%"=="0" (
  echo pnpm install FAILED with exit %INSTALL_ERR%
  exit /b %INSTALL_ERR%
)

echo.
echo [2/2] pnpm run typecheck...
call pnpm run typecheck
set TC_ERR=%ERRORLEVEL%
if not "%TC_ERR%"=="0" (
  echo typecheck FAILED with exit %TC_ERR%
  exit /b %TC_ERR%
)

echo.
echo Setup complete.
exit /b 0