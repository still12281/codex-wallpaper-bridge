[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Root,[string]$LogPath,[switch]$InspectOnly)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'UninstallSupport.ps1')
. (Join-Path $PSScriptRoot 'LoginStartup.ps1')
$uninstallMutex=[Threading.Mutex]::new($false,'Local\CodexWallpaperBridge.Install');$uninstallOwned=$false;$uninstallTranscript=$false
try{
  if($LogPath){Start-Transcript -LiteralPath $LogPath -Force -ErrorAction Stop|Out-Null;$uninstallTranscript=$true}
  try{$uninstallOwned=$uninstallMutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$uninstallOwned=$true}
  if(-not $uninstallOwned){throw 'Another installation is running; retry after it finishes.'}
  if(-not [IO.Path]::IsPathFullyQualified($Root)){throw 'Data directory must be absolute.'}
  $Root=[IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($Root))
  if([IO.Path]::GetPathRoot($Root) -eq $Root -or -not (Test-Path -LiteralPath (Join-Path $Root 'launcher-runtime.json') -PathType Leaf)){throw 'Installed data directory identity is unavailable; preserved.'}
  $paths=@((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Codex Wallpaper.lnk'),(Join-Path ([Environment]::GetFolderPath('Desktop')) 'Codex.lnk'),(Join-Path ([Environment]::GetFolderPath('Programs')) 'Codex Wallpaper Bridge/Codex Wallpaper.lnk'))
  $startup=[Environment]::GetFolderPath('Startup');$login=Get-WallpaperUninstallLoginRecord $Root $startup
  # Inspect before applying changes. Modified user shortcuts are deliberately kept.
  $null=@(Remove-WallpaperManagedShortcuts -Root $Root -AllowedPaths $paths -InspectOnly)
  $restore=@(& (Join-Path $PSScriptRoot 'Restore-Shortcuts.ps1') -Root $Root -InspectOnly)
  if(@($restore|Where-Object error).Count){throw 'Original shortcut backups could not be verified; see Restore-Shortcuts.ps1.'}
  if($InspectOnly){[pscustomobject]@{inspectOnly=$true;dataPreserved=$true;clientStarted=$false};return}
  if($login){Set-WallpaperLoginStartup -Root $Root -StartupDirectory $startup -RegistryPath $login.registryPath -Mode disable|Out-Null}
  $taskName='CodexWallpaperBridge-AfterUpdate-'+[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $task=Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  if($task -and $task.Actions.Execute -ieq (Join-Path $Root 'CodexEntry.exe') -and $task.Actions.Arguments -ceq '--after-update-event $(UpdateRecordId)'){
    & (Join-Path $PSScriptRoot 'Install-UpdateReconnect.ps1') -Root $Root -Uninstall|Out-Null
  }elseif($task){Write-Host 'Preserved update task belonging to another installation or modified by its owner.'}
  $restore=@(& (Join-Path $PSScriptRoot 'Restore-Shortcuts.ps1') -Root $Root)
  if(@($restore|Where-Object error).Count){throw 'Could not restore all original shortcuts; data and recovery files were preserved.'}
  $shortcuts=@(Remove-WallpaperManagedShortcuts -Root $Root -AllowedPaths $paths)
  [ordered]@{uninstalled=$true;dataPreserved=$true;dataDirectory=$Root;shortcuts=$shortcuts;clientStarted=$false}|ConvertTo-Json -Depth 5
}catch{Write-Error $_ -ErrorAction Continue;exit 1}
finally{if($uninstallOwned){$uninstallMutex.ReleaseMutex()};$uninstallMutex.Dispose();if($uninstallTranscript){Stop-Transcript|Out-Null}}
