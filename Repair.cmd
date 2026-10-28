@echo off
setlocal
title Codex Wallpaper Bridge - Manual Recovery
if not exist "%~dp0CodexEntry.exe" goto missing
if not exist "%~dp0launcher-runtime.json" goto missing
if not exist "%~dp0launch-script.txt" goto missing
if /I "%~1"=="--check" (
  echo Manual recovery entry is ready. No client was started or closed.
  exit /b 0
)
echo Save your work and EXIT Codex normally before continuing.
echo If it is still running in the background, use the app's Exit command.
echo This tool does not close processes or reset your wallpaper settings.
echo.
echo After you have exited Codex, press any key to reopen through the wallpaper entry.
pause >nul
start "" "%~dp0CodexEntry.exe"
exit /b %errorlevel%
:missing
echo Run Repair.cmd from the installed data directory beside CodexEntry.exe.
echo Default: %%LOCALAPPDATA%%\CodexWallpaperBridge
echo Custom installation: use your chosen data directory.
echo If installation files are missing, reinstall the release package using the same directory.
if /I not "%~1"=="--check" pause
exit /b 1
