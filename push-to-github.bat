@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
set LOG=%~dp0push-result.log
echo ===== Flare-Boss-Arena push started %date% %time% ===== > "%LOG%"

REM LFS objects were uploaded separately; skip re-upload to save time
set GIT_LFS_SKIP_PUSH=1
set GIT_TERMINAL_PROMPT=0
set GIT_HTTP_LOW_SPEED_LIMIT=0
set GIT_HTTP_LOW_SPEED_TIME=999999

git config http.postBuffer 524288000
git config http.lowSpeedLimit 0
git config http.lowSpeedTime 999999
git config core.compression 0
git config pack.windowMemory 256m
git config pack.packSizeLimit 2g

echo Local HEAD: >> "%LOG%"
git log --oneline -1 >> "%LOG%" 2>&1
echo. >> "%LOG%"
echo Remote before: >> "%LOG%"
git ls-remote origin refs/heads/main >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo [%time%] Pushing main to origin... >> "%LOG%"
git push -u origin main >> "%LOG%" 2>&1
set EXIT=%ERRORLEVEL%

if %EXIT% NEQ 0 (
  echo [%time%] HTTPS push failed (%EXIT%), trying SSH remote... >> "%LOG%"
  git remote set-url origin git@github.com:MolochDaGod/Flare-Boss-Arena.git
  git push -u origin main >> "%LOG%" 2>&1
  set EXIT=!ERRORLEVEL!
  if !EXIT! NEQ 0 (
    echo [%time%] SSH failed, restoring HTTPS and retrying... >> "%LOG%"
    git remote set-url origin https://github.com/MolochDaGod/Flare-Boss-Arena.git
    timeout /t 10 /nobreak >nul
    git push -u origin main >> "%LOG%" 2>&1
    set EXIT=!ERRORLEVEL!
  )
)

echo. >> "%LOG%"
echo Remote after: >> "%LOG%"
git ls-remote origin refs/heads/main >> "%LOG%" 2>&1
echo ===== Finished %date% %time% exit=%EXIT% ===== >> "%LOG%"

type "%LOG%"
echo.
echo Full log: %LOG%
pause
exit /b %EXIT%