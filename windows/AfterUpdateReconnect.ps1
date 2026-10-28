[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Root,[string]$EventRecordId,[switch]$InspectOnly)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'UpdateReconnectPolicy.ps1')
$Root=[IO.Path]::GetFullPath($Root)
$updateMutex=[Threading.Mutex]::new($false,'Local\CodexWallpaperBridge.AfterUpdate')
$updateOwned=$false;$bootstrapOwned=$false;$bootstrapMutex=$null;$state=$null;$dirty=$false;$runnerFailed=$false
try{
  try{$updateOwned=$updateMutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$updateOwned=$true}
  if(-not $updateOwned){return}
  $state=Get-Content -LiteralPath (Join-Path $Root 'update-reconnect.json') -Raw -ErrorAction Stop | ConvertFrom-Json -AsHashtable
  $userId=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  if($state.userId -cne $userId){throw 'Update rule belongs to another user'}
  [long]$record=0;if(-not [long]::TryParse($EventRecordId,[ref]$record) -or $record -le 0){return}
  $eventRecord=Get-WinEvent -LogName 'Microsoft-Windows-AppXDeploymentServer/Operational' -FilterXPath "*[System[EventRecordID=$record]]" -MaxEvents 1 -ErrorAction Stop
  $event=Get-WallpaperUpdateEvent -Xml ([xml]$eventRecord.ToXml())
  $bootstrap=(Get-Content -LiteralPath (Join-Path $Root 'launch-script.txt') -Raw -ErrorAction Stop).Trim()
  if(-not [IO.Path]::IsPathFullyQualified($bootstrap) -or [IO.Path]::GetFileName($bootstrap) -cne 'Start-CodexWallpaper.ps1' -or -not (Test-Path -LiteralPath $bootstrap -PathType Leaf)){throw 'Integrated bootstrap path is invalid'}
  $codeRoot=Split-Path -Parent (Split-Path -Parent $bootstrap)
  if(-not ([IO.File]::ReadAllText($bootstrap).Contains('[switch]$AfterUpdate'))){throw 'Bootstrap has no safe automatic update mode'}
  $runtime=Get-Content -LiteralPath (Join-Path $Root 'launcher-runtime.json') -Raw -ErrorAction Stop | ConvertFrom-Json
  foreach($item in @(@($runtime.powerShell,'pwsh.exe'),@($runtime.node,'node.exe'))){if(-not [IO.Path]::IsPathFullyQualified($item[0]) -or [IO.Path]::GetFileName($item[0]) -ine $item[1] -or -not (Test-Path -LiteralPath $item[0] -PathType Leaf)){throw 'Recorded runtime is unavailable'}}
  . (Join-Path (Split-Path -Parent $bootstrap) 'LaunchPolicy.ps1')
  . (Join-Path $codeRoot 'vendor/codex-dynamic-skin/scripts/common-windows.ps1')
  $installed=Get-WallpaperRegisteredCodex
  $decision=Get-WallpaperUpdateDecision -Event $event -State $state -Installed $installed -UserId $userId
  $validationState=@{armedAt=$state.armedAt;baselineRecordId=$state.baselineRecordId;observedVersion=$state.observedVersion}
  if($InspectOnly){[ordered]@{inspectOnly=$true;decision=$decision;eventRecordId=$record;currentClientUnchanged=$true}|ConvertTo-Json -Depth 5;return}
  if(-not $decision.eligible){return}
  # Consume this version BEFORE any side effect. Duplicates and failures never retry.
  $dirty=$true;$state.observedVersion=$decision.version;$state.lastEventRecordId=$record;$state.phase='checking-new-version';$state.updatedAt=[DateTimeOffset]::UtcNow.ToString('o');Save-WallpaperUpdateState $Root $state
  $bootstrapMutex=[Threading.Mutex]::new($false,'Local\CodexWallpaperBridgeBootstrap')
  try{$bootstrapOwned=$bootstrapMutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$bootstrapOwned=$true}
  if(-not $bootstrapOwned){$state.phase='bootstrap-busy-preserved';return}
  function UpdateRoots {
    @(Get-WallpaperCodexProcesses | Where-Object {$_.CommandLine -notmatch '--type=|--monitor-self'} | ForEach-Object {Get-WallpaperExactUpdateSnapshot $_})
  }
  $roots=@(UpdateRoots)
  $healthyInfo=Get-DreamSkinVerifiedCdpIdentityForAnyRegistered -Port 9335
  $healthy=$null -ne $healthyInfo
  $clientDecision=Get-WallpaperUpdateClientDecision -Roots $roots -Executable $installed.Executable -EventAt $event.at -HealthyCdp $healthy
  $reattach=$false
  if($healthy -and $healthyInfo.Codex.PackageFullName -ceq $installed.PackageFullName -and (Get-WallpaperUpdateClientDecision -Roots $roots -Executable $installed.Executable -EventAt $event.at) -eq 'close-once'){
    $hostReady=$false
    try{$runtimeStatus=Get-Content -LiteralPath (Join-Path $Root 'runtime-status.json') -Raw -ErrorAction Stop|ConvertFrom-Json;$age=([DateTimeOffset]::UtcNow-([DateTimeOffset]$runtimeStatus.updatedAt)).TotalSeconds;$hostReady=$runtimeStatus.browserId -eq $healthyInfo.Identity.BrowserId -and $age -ge 0 -and $age -le 12 -and $runtimeStatus.phase -in @('background-rendered','background-disabled','realtime-capture-active','realtime-capture-paused')}catch{}
    $reattach=-not $hostReady
  }
  if($clientDecision -ne 'close-once' -and -not $reattach){$state.phase=$clientDecision;return}
  $snapshot=$roots[0]
  $state.attempt=[ordered]@{package=$event.package;eventRecordId=$record;processId=$snapshot.id;createdAt=$snapshot.createdAt;closeRequired=(-not $reattach);at=[DateTimeOffset]::UtcNow.ToString('o')};$state.phase='one-reconnect-attempt';Save-WallpaperUpdateState $Root $state
  if($reattach){$state.phase='ready-to-relaunch'}else{$state.phase=Invoke-WallpaperUpdateCloseOnce -Close {
    $freshInstall=Get-WallpaperRegisteredCodex
    if($freshInstall.Executable -ine $snapshot.path -or -not (Get-WallpaperUpdateDecision -Event $event -State $validationState -Installed $freshInstall -UserId $userId).eligible){return $false}
    $current=@(UpdateRoots);if($current.Count -ne 1 -or $current[0].id -ne $snapshot.id -or $current[0].ticks -ne $snapshot.ticks -or $current[0].path -ine $snapshot.path){return $false}
    $process=Get-Process -Id $snapshot.id -ErrorAction Stop
    try{if($process.StartTime.ToUniversalTime().Ticks -ne $snapshot.ticks -or $process.MainModule.FileName -ine $snapshot.path){return $false};return $process.CloseMainWindow()}finally{$process.Dispose()}
  } -Remaining { @(Get-WallpaperCodexProcesses).Count -gt 0 } -NewRoot { @(UpdateRoots | Where-Object {$_.id -ne $snapshot.id -or $_.ticks -ne $snapshot.ticks}).Count -gt 0 }}
  $bootstrapMutex.ReleaseMutex();$bootstrapOwned=$false
  if($state.phase -ne 'ready-to-relaunch'){return}
  $state.phase='starting-integrated-bootstrap';Save-WallpaperUpdateState $Root $state
  $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=$runtime.powerShell;$info.Arguments='-NoProfile -NonInteractive -File "'+$bootstrap+'" -AfterUpdate';$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden;$info.WorkingDirectory=Split-Path -Parent $bootstrap
  $info.EnvironmentVariables['CODEX_WALLPAPER_DATA_DIR']=$Root;$info.EnvironmentVariables['CODEX_WALLPAPER_PWSH']=$runtime.powerShell;$info.EnvironmentVariables['CODEX_WALLPAPER_NODE']=$runtime.node
  $child=[Diagnostics.Process]::Start($info)
  try{if(-not $child.WaitForExit(110000)){$state.phase='bootstrap-timeout-client-preserved';return};$bootstrapExit=$child.ExitCode}finally{$child.Dispose()}
  $launch=Get-Content -LiteralPath (Join-Path $Root 'launch-status.json') -Raw -ErrorAction Stop|ConvertFrom-Json
  $state.phase=if($bootstrapExit -eq 0 -and $launch.phase -eq 'background-rendered' -and ([DateTimeOffset]$launch.updatedAt) -ge ([DateTimeOffset]$state.attempt.at)){'reconnect-finished'}else{'reconnect-failed-client-preserved'}
}catch{$runnerFailed=$true;if($dirty){$state.phase='failed-no-retry';$state.error=$_.Exception.Message}else{Write-Error -Message $_.Exception.Message -ErrorAction Continue}}
finally{
  try{if($dirty -and -not $InspectOnly){$state.updatedAt=[DateTimeOffset]::UtcNow.ToString('o');Save-WallpaperUpdateState $Root $state}}
  finally{if($bootstrapOwned){$bootstrapMutex.ReleaseMutex()};if($bootstrapMutex){$bootstrapMutex.Dispose()};if($updateOwned){$updateMutex.ReleaseMutex()};$updateMutex.Dispose()}
}
if($runnerFailed){exit 1}
