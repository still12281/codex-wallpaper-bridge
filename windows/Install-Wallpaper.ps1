[CmdletBinding()]
param([string]$DataDirectory,[switch]$CheckOnly,[switch]$SkipDependencyInstall,[switch]$SkipPreparation,[switch]$NoShortcuts,
  [ValidateSet('ask','separate','replace','none')][string]$ShortcutMode='ask',
  [ValidateSet('ask','enable','keep','disable')][string]$UpdateReconnect='ask',
  [switch]$NonInteractive,[switch]$NoPause)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'InstallSupport.ps1')
$installSourceRoot=Split-Path -Parent $PSScriptRoot
$installDataRoot=if($DataDirectory){$DataDirectory}elseif($env:CODEX_WALLPAPER_DATA_DIR){$env:CODEX_WALLPAPER_DATA_DIR}else{Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'CodexWallpaperBridge'}
$installMutex=$null;$installLockOwned=$false
try{
  if(-not $CheckOnly){
    $installMutex=[Threading.Mutex]::new($false,'Local\CodexWallpaperBridge.Install')
    try{$installLockOwned=$installMutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$installLockOwned=$true}
    if(-not $installLockOwned){throw 'Another wallpaper installation is running. Finish or close it before trying again.'}
  }
  if(-not [Environment]::Is64BitOperatingSystem -or $env:OS -ne 'Windows_NT'){throw 'Windows x64 is required.'}
  if($env:PROCESSOR_ARCHITECTURE -ne 'AMD64' -and $env:PROCESSOR_ARCHITEW6432 -ne 'AMD64'){throw 'This launcher targets Windows x64.'}
  if(-not [IO.Path]::IsPathRooted($installDataRoot) -or $installDataRoot -match '^[A-Za-z]:[^\\/]'){throw 'DataDirectory must be absolute.'}
  $installDataRoot=[IO.Path]::GetFullPath($installDataRoot)
  # Discover only; do not activate, close or change the official client.
  . (Join-Path $installSourceRoot 'vendor/codex-dynamic-skin/scripts/common-windows.ps1')
  . (Join-Path $PSScriptRoot 'LaunchPolicy.ps1')
  $installCodex=Get-WallpaperRegisteredCodex
  $installPolicyPath=Join-Path $installDataRoot 'installation.json';$installPrevious=$null
  if(Test-Path -LiteralPath $installPolicyPath){$installPrevious=Get-Content -LiteralPath $installPolicyPath -Raw -ErrorAction Stop|ConvertFrom-Json}
  if($NoShortcuts){$ShortcutMode='none'}
  $installChoices=Resolve-WallpaperInstallChoices -ShortcutMode $ShortcutMode -UpdateReconnect $UpdateReconnect -Existing $installPrevious -NonInteractive:($NonInteractive -or $CheckOnly)
  $installSpecs=@(
    @{name='pwsh';package='Microsoft.PowerShell'},
    @{name='node';package='OpenJS.NodeJS.LTS'},
    @{name='ffmpeg';package='Gyan.FFmpeg'},
    @{name='uv';package='astral-sh.uv'}
  )
  $installResolved=@{};$installMissing=@()
  foreach($spec in $installSpecs){
    $executable=Get-WallpaperInstallDependency $spec.name
    if($executable){$installResolved[$spec.name]=$executable}else{$installMissing+=$spec}
  }
  if($CheckOnly){
    [ordered]@{checkOnly=$true;codex="$($installCodex.Version)";dataDirectory=$installDataRoot;dependencies=$installResolved;missing=@($installMissing|ForEach-Object package);choices=$installChoices;willStartClient=$false} | ConvertTo-Json -Depth 4
    if($installMissing.Count){exit 2};exit 0
  }
  if($installMissing.Count -and $SkipDependencyInstall){throw ('Missing dependencies: '+(($installMissing|ForEach-Object package)-join ', '))}
  if($installMissing.Count){
    $installWinget=Get-Command winget.exe -ErrorAction SilentlyContinue
    if(-not $installWinget){throw 'WinGet is unavailable. Install App Installer from Microsoft Store, then run Install.cmd again. Manual commands: docs/INSTALL.zh-CN.md'}
    foreach($spec in $installMissing){
      Write-Host ('Installing '+$spec.package+' ...')
      & $installWinget.Source install --id $spec.package --exact --source winget --architecture x64 --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
      if($LASTEXITCODE -ne 0){throw ('WinGet failed for '+$spec.package+' (exit '+$LASTEXITCODE+'). See docs/INSTALL.zh-CN.md.')}
      Update-WallpaperInstallPath
      $executable=Get-WallpaperInstallDependency $spec.name
      if(-not $executable){throw ('Cannot resolve '+$spec.name+' after installation. Set its CODEX_WALLPAPER executable override; see docs/INSTALL.zh-CN.md.')}
      $installResolved[$spec.name]=$executable
    }
  }
  $env:CODEX_WALLPAPER_DATA_DIR=$installDataRoot
  $env:CODEX_WALLPAPER_PWSH=$installResolved.pwsh;$env:CODEX_WALLPAPER_NODE=$installResolved.node
  $env:CODEX_WALLPAPER_FFMPEG=$installResolved.ffmpeg;$env:CODEX_WALLPAPER_UV=$installResolved.uv
  Write-Host 'Checking release files ...'
  & $installResolved.node (Join-Path $installSourceRoot 'tools/check-release.mjs')
  if($LASTEXITCODE -ne 0){throw 'Release file verification failed. Extract a clean copy and retry.'}
  $installCopy=& $installResolved.node (Join-Path $installSourceRoot 'tools/install-source.mjs') --data-dir $installDataRoot
  if($LASTEXITCODE -ne 0){throw 'Source installation failed; existing settings and versions were preserved.'}
  $installDirectory=($installCopy|ConvertFrom-Json).directory
  if(-not $SkipPreparation){
    Write-Host 'Preparing GPU scene runtime ...'
    & $installResolved.node (Join-Path $installDirectory 'tools/prepare-webwallgl.mjs')
    if($LASTEXITCODE -ne 0){throw 'GPU runtime download failed; rerun Install.cmd when the network is available.'}
    Write-Host 'Preparing native capture (Python 3.12 and locked dependencies) ...'
    & $installResolved.pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $installDirectory 'windows/Prepare-Realtime.ps1')
    if($LASTEXITCODE -ne 0){throw 'Native capture preparation failed; rerun Install.cmd when the network is available.'}
  }
  Write-Host 'Building the unified entry ...'
  & $installResolved.pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $installDirectory 'windows/Build-Launcher.ps1')
  if($LASTEXITCODE -ne 0){throw 'Entry build failed; see the compiler message above.'}
  & $installResolved.pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $installDirectory 'windows/Prepare-TaskbarEntry.ps1')
  if($LASTEXITCODE -ne 0){throw 'Shortcut preparation failed; see the message above.'}
  Copy-Item -LiteralPath (Join-Path $installDirectory 'Repair.cmd') -Destination (Join-Path $installDataRoot 'Repair.cmd') -Force -ErrorAction Stop
  $installEntry=Join-Path $installDataRoot 'CodexEntry.exe';$installLink=Join-Path $installDataRoot 'Codex.lnk'
  if($installChoices.shortcutMode -eq 'separate' -and $installPrevious.shortcutMode -eq 'replace'){
    $restored=@(& (Join-Path $installDirectory 'windows/Restore-Shortcuts.ps1') -Root $installDataRoot)
    if(@($restored|Where-Object error).Count){throw 'Could not restore all original shortcuts. Inspect Restore-Shortcuts.ps1 output before switching modes.'}
    if(@($restored|Where-Object reason -eq 'shortcut-modified-preserved').Count){Write-Warning 'User-modified shortcuts were preserved while switching to separate mode.'}
  }
  $installPolicy=[ordered]@{schemaVersion=1;shortcutMode=$installChoices.shortcutMode;updateReconnect=$installChoices.updateReconnect}
  [IO.File]::WriteAllText($installPolicyPath,($installPolicy|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
  if($installChoices.shortcutMode -eq 'separate'){
    $installDesktop=Join-Path ([Environment]::GetFolderPath('Desktop')) 'Codex Wallpaper.lnk'
    $installMenu=Join-Path ([Environment]::GetFolderPath('Programs')) 'Codex Wallpaper Bridge/Codex Wallpaper.lnk'
    Publish-WallpaperInstallShortcut $installLink $installDesktop $installEntry
    Publish-WallpaperInstallShortcut $installLink $installMenu $installEntry
  }
  elseif($installChoices.shortcutMode -eq 'replace'){
    . (Join-Path $installDirectory 'windows/StartupHealth.ps1')
    $replacement=Install-WallpaperReplacementShortcuts -Root $installDataRoot -CodexAppId $installCodex.AppUserModelId
    if($replacement.createdFallback){Write-Host 'No original or existing managed .lnk found. Created a desktop Codex shortcut; Store registration and taskbar pins remain unchanged.'}
  }
  if($installChoices.updateReconnect -in @('enable','disable')){
    $updateArguments=@('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $installDirectory 'windows/Install-UpdateReconnect.ps1'),'-Root',$installDataRoot)
    if($installChoices.updateReconnect -eq 'disable'){$updateArguments+='-Uninstall'}
    & $installResolved.pwsh @updateArguments
    if($LASTEXITCODE -ne 0){throw 'Base installation completed, but the update-recovery task could not be changed. See docs/INSTALL.zh-CN.md.'}
  }
  [ordered]@{installed=$true;source=$installDirectory;entry=$installEntry;dataDirectory=$installDataRoot;shortcutMode=$installChoices.shortcutMode;updateReconnect=$installChoices.updateReconnect;preparationSkipped=[bool]$SkipPreparation;clientStarted=$false} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $installDataRoot 'install-status.json') -Encoding UTF8 -ErrorAction Stop
  Write-Host ''
  Write-Host 'Installed. Save drafts, exit ordinary Codex normally, then open the selected wallpaper entry.' -ForegroundColor Green
  Write-Host ('Entry: '+$installEntry)
  Write-Host ('Data:  '+$installDataRoot)
  exit 0
}catch{Write-Error $_ -ErrorAction Continue;exit 1}
finally{if($installLockOwned){$installMutex.ReleaseMutex()};if($installMutex){$installMutex.Dispose()}}
