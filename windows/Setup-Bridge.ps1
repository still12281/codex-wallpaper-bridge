# Windows PowerShell 5.1 bootstrap for the graphical installer.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$DataDirectory,[Parameter(Mandatory=$true)][string]$ResultPath,[Parameter(Mandatory=$true)][string]$LogPath,
  [ValidateSet('ask','separate','replace','none')][string]$ShortcutMode='ask',
  [ValidateSet('keep','enable','disable')][string]$UpdateReconnect='keep',
  [ValidateSet('keep','enable','disable')][string]$LoginStartup='keep',[switch]$SkipPreparation)
$ErrorActionPreference='Stop';$setupTranscript=$false
try{
  Start-Transcript -LiteralPath $LogPath -Force -ErrorAction Stop|Out-Null;$setupTranscript=$true
  $candidates=@($env:CODEX_WALLPAPER_PWSH)
  $candidates+=@(Get-Command pwsh.exe -CommandType Application -ErrorAction SilentlyContinue|ForEach-Object Source)
  $candidates+=Join-Path $env:ProgramFiles 'PowerShell/7/pwsh.exe'
  $powerShell=@($candidates|Where-Object {$_ -and (Test-Path -LiteralPath $_ -PathType Leaf)}|Select-Object -Unique|Select-Object -First 1)
  if(-not $powerShell.Count){
    $winget=Get-Command winget.exe -ErrorAction SilentlyContinue
    if(-not $winget){throw 'Install Microsoft App Installer from the Store, then retry setup.'}
    & $winget.Source install --id Microsoft.PowerShell --exact --source winget --architecture x64 --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
    if($LASTEXITCODE -ne 0){throw 'PowerShell 7 installation failed.'}
    $powerShell=@(Join-Path $env:ProgramFiles 'PowerShell/7/pwsh.exe')
  }
  $powerShell=[IO.Path]::GetFullPath([string]$powerShell[0])
  $arguments=@('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'Install-Wallpaper.ps1'),'-DataDirectory',$DataDirectory,'-ShortcutMode',$ShortcutMode,'-UpdateReconnect',$UpdateReconnect,'-LoginStartup',$LoginStartup,'-NonInteractive','-NoPause')
  if($SkipPreparation){$arguments+='-SkipPreparation'}
  & $powerShell @arguments
  if($LASTEXITCODE -ne 0){throw ('Installation failed with exit code '+$LASTEXITCODE+'. See '+$LogPath)}
  [IO.File]::WriteAllText($ResultPath,("[Install]`r`nDataDirectory="+[IO.Path]::GetFullPath($DataDirectory)+"`r`nPowerShell="+$powerShell+"`r`n"),[Text.Encoding]::Unicode)
}catch{Write-Error $_ -ErrorAction Continue;exit 1}
finally{if($setupTranscript){Stop-Transcript|Out-Null}}
