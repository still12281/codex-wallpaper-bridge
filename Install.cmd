@echo off
setlocal
title Codex Wallpaper Bridge - Install
set "cwb_installer_pwsh="
set "cwb_installer_readonly="
set "cwb_installer_nopause="
for %%A in (%*) do if /I "%%~A"=="-NoPause" set "cwb_installer_nopause=1"
for %%A in (%*) do if /I "%%~A"=="-CheckOnly" set "cwb_installer_readonly=1"
for %%A in (%*) do if /I "%%~A"=="-SkipDependencyInstall" set "cwb_installer_readonly=1"
if defined CODEX_WALLPAPER_PWSH if exist "%CODEX_WALLPAPER_PWSH%" set "cwb_installer_pwsh=%CODEX_WALLPAPER_PWSH%"
if not defined cwb_installer_pwsh for /f "delims=" %%I in ('where pwsh.exe 2^>nul') do if not defined cwb_installer_pwsh set "cwb_installer_pwsh=%%I"
if not defined cwb_installer_pwsh if exist "%ProgramFiles%\PowerShell\7\pwsh.exe" set "cwb_installer_pwsh=%ProgramFiles%\PowerShell\7\pwsh.exe"
if defined cwb_installer_pwsh goto run
if defined cwb_installer_readonly goto missing
where winget.exe >nul 2>&1
if errorlevel 1 goto missing
echo Installing PowerShell 7 ...
winget.exe install --id Microsoft.PowerShell --exact --source winget --architecture x64 --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
if errorlevel 1 goto missing
if exist "%ProgramFiles%\PowerShell\7\pwsh.exe" set "cwb_installer_pwsh=%ProgramFiles%\PowerShell\7\pwsh.exe"
if not defined cwb_installer_pwsh goto missing
:run
"%cwb_installer_pwsh%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\Install-Wallpaper.ps1" %*
set "cwb_install_exit=%errorlevel%"
goto finish
:missing
echo PowerShell 7 is required. Install it with WinGet or set CODEX_WALLPAPER_PWSH.
echo See docs\INSTALL.zh-CN.md for manual installation.
set "cwb_install_exit=1"
:finish
echo.
if not "%cwb_install_exit%"=="0" echo Installation failed. Read the message above, then run Install.cmd again.
if not defined cwb_installer_nopause pause
exit /b %cwb_install_exit%
