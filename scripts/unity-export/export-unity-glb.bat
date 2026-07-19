@echo off
setlocal
REM Unity → GLB orchestrator for Dark Elf Camp + dungeons
set UNITY_PROJECT=%UNITY_PROJECT%
if "%UNITY_PROJECT%"=="" set UNITY_PROJECT=D:\repos\FRESH-GRUDGE
set GRUDGE_GLB_OUT=%~dp0..\..\artifacts\grudge-game\public\models\unity
cd /d "%~dp0..\.."
node scripts\unity-export\export-unity-glb.mjs %*
endlocal
