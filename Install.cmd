@echo off
setlocal
title Codex Wallpaper Bridge - Install
set "cwb_installer_pwsh="
set "cwb_installer_winget="
set "cwb_installer_readonly="
set "cwb_installer_nopause="
for %%A in (%*) do if /I "%%~A"=="-NoPause" set "cwb_installer_nopause=1"
for %%A in (%*) do if /I "%%~A"=="-CheckOnly" set "cwb_installer_readonly=1"
for %%A in (%*) do if /I "%%~A"=="-SkipDependencyInstall" set "cwb_installer_readonly=1"
set "cwb_where=%SystemRoot%\System32\where.exe"
for %%D in ("%CD%") do (
  set "cwb_cwd=%%~fD"
  set "cwb_cwd_short=%%~sfD"
)
if not "%cwb_cwd:~-1%"=="\" set "cwb_cwd=%cwb_cwd%\"
if not "%cwb_cwd_short:~-1%"=="\" set "cwb_cwd_short=%cwb_cwd_short%\"
for %%D in ("%~dp0.") do (
  set "cwb_script_dir=%%~fD"
  set "cwb_script_short=%%~sfD"
)
if not "%cwb_script_dir:~-1%"=="\" set "cwb_script_dir=%cwb_script_dir%\"
if not "%cwb_script_short:~-1%"=="\" set "cwb_script_short=%cwb_script_short%\"
if defined CODEX_WALLPAPER_PWSH if exist "%CODEX_WALLPAPER_PWSH%" set "cwb_installer_pwsh=%CODEX_WALLPAPER_PWSH%"
if not defined cwb_installer_pwsh if exist "%ProgramFiles%\PowerShell\7\pwsh.exe" set "cwb_installer_pwsh=%ProgramFiles%\PowerShell\7\pwsh.exe"
if not defined cwb_installer_pwsh if exist "%LOCALAPPDATA%\Microsoft\WindowsApps\pwsh.exe" set "cwb_installer_pwsh=%LOCALAPPDATA%\Microsoft\WindowsApps\pwsh.exe"
if not defined cwb_installer_pwsh call :find_nonlocal pwsh.exe cwb_installer_pwsh
if defined cwb_installer_pwsh goto run
if defined cwb_installer_readonly goto missing
if exist "%LOCALAPPDATA%\Microsoft\WindowsApps\winget.exe" set "cwb_installer_winget=%LOCALAPPDATA%\Microsoft\WindowsApps\winget.exe"
if not defined cwb_installer_winget call :find_nonlocal winget.exe cwb_installer_winget
if not defined cwb_installer_winget goto missing
echo Installing PowerShell 7 ...
"%cwb_installer_winget%" install --id Microsoft.PowerShell --exact --source winget --architecture x64 --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
if errorlevel 1 goto missing
if exist "%ProgramFiles%\PowerShell\7\pwsh.exe" set "cwb_installer_pwsh=%ProgramFiles%\PowerShell\7\pwsh.exe"
if not defined cwb_installer_pwsh if exist "%LOCALAPPDATA%\Microsoft\WindowsApps\pwsh.exe" set "cwb_installer_pwsh=%LOCALAPPDATA%\Microsoft\WindowsApps\pwsh.exe"
if not defined cwb_installer_pwsh call :find_nonlocal pwsh.exe cwb_installer_pwsh
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
:find_nonlocal
if not exist "%cwb_where%" exit /b 0
for /f "usebackq delims=" %%I in (`"%cwb_where%" $PATH:%~1 2^>nul`) do call :accept_nonlocal "%%~fI" "%%~dpI" "%%~sdpI" "%~2"
exit /b 0
:accept_nonlocal
if defined %~4 exit /b 0
if /I "%~2"=="%cwb_cwd%" exit /b 0
if /I "%~2"=="%cwb_script_dir%" exit /b 0
if /I "%~3"=="%cwb_cwd_short%" exit /b 0
if /I "%~3"=="%cwb_script_short%" exit /b 0
set "%~4=%~1"
exit /b 0
