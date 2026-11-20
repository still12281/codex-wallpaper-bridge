# Windows PowerShell 5.1 bootstrap for the graphical installer.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$DataDirectory,[Parameter(Mandatory=$true)][string]$ResultPath,[Parameter(Mandatory=$true)][string]$LogPath,
  [ValidateSet('ask','separate','replace','none')][string]$ShortcutMode='ask',
  [ValidateSet('keep','enable','disable')][string]$UpdateReconnect='keep',
  [ValidateSet('keep','enable','disable')][string]$LoginStartup='keep',[switch]$SkipPreparation,
  [switch]$InstallVideoTools,[switch]$InstallNativeCapture,
  [ValidatePattern('^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$')][string]$PanelUpdateId)
$ErrorActionPreference='Stop';$setupTranscript=$false
try{
  Start-Transcript -LiteralPath $LogPath -Force -ErrorAction Stop|Out-Null;$setupTranscript=$true
  . (Join-Path $PSScriptRoot 'InstallSupport.ps1')
  $powerShell=Get-WallpaperInstallDependency 'pwsh'
  if(-not $powerShell){
    if($PanelUpdateId){throw 'PowerShell 7 could not be started. Run the setup wizard to repair the runtime.'}
    $winget=Get-Command winget.exe -ErrorAction SilentlyContinue
    if(-not $winget){throw 'Install Microsoft App Installer from the Store, then retry setup.'}
    & $winget.Source install --id Microsoft.PowerShell --exact --source winget --architecture x64 --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
    $wingetExit=$LASTEXITCODE
    Update-WallpaperInstallPath
    $powerShell=Get-WallpaperInstallDependency 'pwsh'
    if(-not $powerShell){throw "WinGet returned $wingetExit and no usable PowerShell 7 was found. Install PowerShell 7 or enable its pwsh.exe app execution alias."}
  }
  $env:CODEX_WALLPAPER_PWSH=$powerShell
  $arguments=@('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'Install-Wallpaper.ps1'),'-DataDirectory',$DataDirectory,'-ShortcutMode',$ShortcutMode,'-UpdateReconnect',$UpdateReconnect,'-LoginStartup',$LoginStartup,'-NonInteractive','-NoPause')
  if($SkipPreparation){$arguments+='-SkipPreparation'}
  if($InstallVideoTools){$arguments+='-InstallVideoTools'}
  if($InstallNativeCapture){$arguments+='-InstallNativeCapture'}
  if($PanelUpdateId){$arguments+=@('-PanelUpdateId',$PanelUpdateId)}
  & $powerShell @arguments
  if($LASTEXITCODE -ne 0){throw ('Installation failed with exit code '+$LASTEXITCODE+'. See '+$LogPath)}
  [IO.File]::WriteAllText($ResultPath,("[Install]`r`nDataDirectory="+[IO.Path]::GetFullPath($DataDirectory)+"`r`nPowerShell="+$powerShell+"`r`n"),[Text.Encoding]::Unicode)
}catch{Write-Error $_ -ErrorAction Continue;exit 1}
finally{if($setupTranscript){Stop-Transcript|Out-Null}}
