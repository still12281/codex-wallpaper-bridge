[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Root,[switch]$Uninstall,[switch]$InspectOnly)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'UpdateReconnectPolicy.ps1')
$installMutex=[Threading.Mutex]::new($false,'Local\CodexWallpaperBridge.AfterUpdate');$installOwned=$false
try{
  try{$installOwned=$installMutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$installOwned=$true}
  if(-not $installOwned){throw 'An update reconnect is running; installation preserved'}
$Root=[IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath($Root))
$userId=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$name='CodexWallpaperBridge-AfterUpdate-'+$userId
$entry=Join-Path $Root 'CodexEntry.exe'
$existing=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
if($existing -and ($existing.Principal.UserId -ne $userId -or $existing.Actions.Execute -ine $entry -or $existing.Actions.Arguments -cne '--after-update-event $(UpdateRecordId)')){throw 'Existing task identity does not match this installation'}
if($Uninstall){if($existing){Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction Stop};[pscustomobject]@{removed=$true;task=$name};return}
$runtime=Get-Content -LiteralPath (Join-Path $Root 'launcher-runtime.json') -Raw -ErrorAction Stop|ConvertFrom-Json
if(-not [IO.Path]::IsPathFullyQualified($runtime.powerShell) -or [IO.Path]::GetFileName($runtime.powerShell) -ine 'pwsh.exe' -or -not (Test-Path -LiteralPath $runtime.powerShell -PathType Leaf)){throw 'Recorded PowerShell unavailable'}
$bootstrap=(Get-Content -LiteralPath (Join-Path $Root 'launch-script.txt') -Raw -ErrorAction Stop).Trim()
if(-not (Test-Path -LiteralPath $entry -PathType Leaf) -or -not (Test-Path -LiteralPath (Join-Path (Split-Path -Parent $bootstrap) 'AfterUpdateReconnect.ps1') -PathType Leaf)){throw 'Build the integrated entry and install the update runner first'}
. (Join-Path (Split-Path -Parent (Split-Path -Parent $bootstrap)) 'vendor/codex-dynamic-skin/scripts/common-windows.ps1')
$installed=Get-DreamSkinCodexInstall
$log=Get-WinEvent -ListLog 'Microsoft-Windows-AppXDeploymentServer/Operational' -ErrorAction Stop
if(-not $log.IsEnabled){throw 'AppX deployment event log is disabled; no global log settings changed'}
$xml=New-WallpaperUpdateTaskXml -UserId $userId -Entry $entry -Root $Root
# Ask Task Scheduler to validate without registering or running a task.
$service=New-Object -ComObject Schedule.Service;$service.Connect();$folder=$service.GetFolder('\')
[void]$folder.RegisterTask($name,$xml,1,$null,$null,3,$null)
if($InspectOnly){[pscustomobject]@{validated=$true;task=$name;kind='event-only-no-repetition';package=$installed.PackageFullName};return}
$previous=$null;$statePath=Join-Path $Root 'update-reconnect.json'
if(Test-Path -LiteralPath $statePath){$previous=Get-Content -LiteralPath $statePath -Raw -ErrorAction Stop|ConvertFrom-Json -AsHashtable}
$latest=Get-WinEvent -LogName 'Microsoft-Windows-AppXDeploymentServer/Operational' -MaxEvents 1 -ErrorAction Stop
$state=[ordered]@{schemaVersion=1;userId=$userId;taskName=$name;armedAt=[DateTimeOffset]::UtcNow.ToString('o');baselineRecordId=[long]$latest.RecordId;observedVersion="$($installed.Version)";phase='armed-for-future-updates';attempt=$previous.attempt}
Save-WallpaperUpdateState $Root $state
try{Register-ScheduledTask -TaskName $name -Xml $xml -Force -ErrorAction Stop|Out-Null}catch{if($previous){Save-WallpaperUpdateState $Root $previous};throw}
$actual=Get-ScheduledTask -TaskName $name -ErrorAction Stop
[pscustomobject]@{installed=$true;task=$name;state="$($actual.State)";baselineVersion=$state.observedVersion;baselineRecordId=$state.baselineRecordId;residentProcess=$false;currentSessionReconnected=$false}

}finally{if($installOwned){$installMutex.ReleaseMutex()};$installMutex.Dispose()}
